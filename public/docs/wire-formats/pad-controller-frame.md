# PAD Controller TCP Frame Format

> **Status:** Authoritative for the Pine Billing SDK PADController
> transport adapter. **Internal only** — the codec is `pub(crate)`,
> not in the UDL, not in any generated binding, not in per-language
> docs. SDK users never see this. Sourced from the Pinelabs
> `PlutusTransport_JAR` repo
> (`src/main/java/com/pinelabs/billingapp/TCPIPforECR.java`).
> When this doc and that source disagree, **the source code wins**;
> raise a PR to update this doc.
>
> The CSV body inside the frame is unrelated to this doc — see
> `docs/wire-formats/csv.md` for the body format.

---

## 1. Transport-level overview

| Aspect | Value |
|---|---|
| Carrier | Single TCP socket (`java.net.Socket`) |
| Default endpoint | `127.0.0.1:8082` (loopback to PADController on the same device) |
| Connection model | **One-shot**: connect → send request → receive response → disconnect, per transaction |
| Connect timeout | 5 000 ms |
| Socket (read) timeout | 245 000 ms default; configurable; minimum 245 000 ms (long enough for cardholder PIN entry) |
| Receive buffer size | `MAX_MESSAGE_LENGTH * 3` = 6 144 bytes (set on the socket via `setReceiveBufferSize`) |
| Frame max size | `MAX_MESSAGE_LENGTH = 2 048` bytes (whole envelope including header + body + terminator) |
| Endianness | Big-endian for all multi-byte fields |
| Charset | ASCII (CSV body is ASCII; bytes copied as `(byte)(char & 0xFF)`) |

> **Two layered length caps.** The CSV body format itself caps at
> `MAX_CSV_LEN = 50 000` (see `csv.md`). The PADController transport
> caps the **whole frame** (header + body + terminator) at 2 048
> bytes, leaving ≈ 2 041 bytes for the CSV body. Each layer rejects
> oversize independently. The PADController adapter's encoder
> rejects with `SdkError::InvalidInput("csv body exceeds 2041 bytes
> for PADController transport")`.

---

## 2. Request frame

```
┌─────────────────┬─────────────────┬─────────────────┬───────────────┬───────────┐
│   Source ID     │  Function Code  │    Data Length  │   CSV body    │ End mark  │
│   2 bytes       │     2 bytes     │     2 bytes     │   N bytes     │  1 byte   │
│   0x10 0x00     │  0x09 0x97      │   (big-endian)  │   ASCII CSV   │   0xFF    │
└─────────────────┴─────────────────┴─────────────────┴───────────────┴───────────┘
```

| Offset | Bytes | Field | Value |
|---:|---:|---|---|
| 0 | 2 | Source ID | `0x10 0x00` (fixed; identifies the billing app) |
| 2 | 2 | Function Code | `0x0997` = `PLUTUS_BILLING_DATA_REQ` |
| 4 | 2 | Data Length (N) | length of CSV body in bytes, big-endian uint16 |
| 6 | N | CSV body | per `docs/wire-formats/csv.md` |
| 6+N | 1 | End marker | `0xFF` |

Total frame size = `7 + N` bytes; must be ≤ 2 048.

**Heartbeat function code** `0x0887` (`PLUTUS_BILLING_HEART_BEAT_REQ`)
is implemented in v1 via `Connectable::heartbeat()` (see §5). Response
function code is `0x0897` (`PLUTUS_BILLING_HEART_BEAT_RES`).

---

## 3. Response frame

```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│   Source ID  │ Function Code│  Error Code  │ Data Length  │   CSV body   │
│   2 bytes    │   2 bytes    │   2 bytes    │   2 bytes    │    N bytes   │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

| Offset | Bytes | Field | Notes |
|---:|---:|---|---|
| 0 | 2 | Source ID | echoed (typically `0x10 0x00`) |
| 2 | 2 | Function Code | `0x1997` = `PLUTUS_BILLING_DATA_RES` (`0x1887` for heartbeat ack) |
| 4 | 2 | Error Code | 0 on success (logged but not currently surfaced as a distinct status; we reuse CSV body's response code) |
| 6 | 2 | Data Length (N) | big-endian uint16 |
| 8 | N | CSV body | per `docs/wire-formats/csv.md` |

> **Note:** there is **no** `0xFF` end marker in responses (asymmetric
> with the request).
>
> **Note (bug in upstream JAR):** `TCPIPforECR.SendECRTxn` lines 397–
> 405 inject a space before every `,` in the response body
> (`if (c == ',') strResponse.append(' ');`). This is unintentional
> data corruption in the JAR's parser. Our adapter **does not
> replicate this**; we read the response body verbatim and pass it
> straight to the CSV decoder. If a future Pinelabs service
> intentionally depends on this corrupted shape, this assumption
> will break — flag if it ever does.

---

## 4. Error / status mapping

The JAR uses three return codes; we map as follows:

| JAR code | Meaning | SDK outcome |
|---:|---|---|
| `0` `RET_OK` | response received, body parses | continue to CSV decode → `TransactionResult` |
| `-1` `RET_NOK` | I/O error, malformed frame, empty body | `SdkError::TransportError("PADController NOK")` |
| `-2` `RET_TIMEOUT` | socket timeout, empty data length | `SdkError::Timeout` |
| `ConnectException` | PADController not listening | `SdkError::TransportUnavailable("PADController unreachable on \<host>:\<port>")`; see `Connectable::restart()` below for recovery. |

The CSV body's own response code (idx 2 `transactionResponse`
"0"=approved or otherwise) is decoded one layer up by the CSV
codec; this transport layer treats any well-formed-frame-with-non-
empty-body as success at the transport level.

Response-header `ErrCode` (bytes 4–5) semantics are unconfirmed —
the JAR logs but does not branch on it. **At Phase 7 implementation
time**, instrument the adapter to surface non-zero values via the
`Logger` port and confirm with Pinelabs whether any value in
isolation should override the CSV body's response code. Until
confirmed, we treat the CSV body as the source of truth.

---

## 5. `Connectable` capability — concrete overrides

Per delta D8, `Connectable` defines `heartbeat` and `restart` as
default-no-op methods. PADController overrides both:

| Method | PADController behaviour |
|---|---|
| `connect()` | open TCP socket to `host:port` with 5 s connect timeout; set `socket_timeout_ms` read timeout; set receive buffer to `MAX_MESSAGE_LENGTH * 3` (6 144 bytes). On `ConnectException`, attempt `restart()` once, then retry; on second failure return `SdkError::TransportUnavailable`. |
| `disconnect()` | close streams + socket; idempotent. |
| `is_connected()` | reflects the socket's open/connected state. (Note: v1 uses one-shot per-txn semantics, so this typically returns `false` between calls.) |
| `heartbeat()` | open frame with FuncCode `0x0887` (`PLUTUS_BILLING_HEART_BEAT_REQ`), empty body; expect response FuncCode `0x0897`. Returns `Ok(())` on receipt; `SdkError::Timeout` / `TransportError` on failure. Used by merchant facade for proactive liveness checks (a v1 quality-of-life addition over the JAR, which defines the opcodes but never sends them). |
| `restart()` | delegate to the `PlatformBridge::restart_pad_controller()` port. The Android implementor injects the `AndroidSystemBridge.sendRestartSignal()` equivalent (Intent broadcast / explicit start). Non-Android platforms ship a no-op or a custom relauncher. Returns `Ok(())` immediately after dispatching the bridge call; recovery success is verified by the next `connect()`. |

---

## 6. Configuration (init-time, on `SdkConfig`)

```
SdkConfig {
    pad_controller: PadControllerConfig {
        host:                String  // default "127.0.0.1"
        port:                u16     // default 8082
        connect_timeout_ms:  u32     // default 5000
        socket_timeout_ms:   u32     // default 245000, minimum 245000
    }
}
```

These are not in `TransactionRequest`. Per-call config is empty for
v0.1.0/v1 (`TransportOptions::PadController(empty)`).

---

## 7. Deliberately not implemented (deferrals)

1. **Persistent connection.** The JAR closes after every txn; we
   match that for v1. Reusable connection is a future optimisation.
2. **`PadControllerEvent` callback** for RET_OK/NOK/TIMEOUT. Folded
   into the existing `TransactionListener` paths plus
   `SdkError::Timeout` / `TransportUnavailable`; no new public
   surface.

> Heartbeat (`0x0887` / `0x0897`) and auto-restart on
> `ConnectException` are **not deferred** — both are implemented in
> v1 via `Connectable::heartbeat()` and `Connectable::restart()`
> overrides (see §5). This restores feature parity with the JAR
> (which defined heartbeat opcodes but never sent them, and used
> `AndroidSystemBridge.sendRestartSignal()` for restart) and adds
> the heartbeat as a v1 quality-of-life feature.

---

## 8. Open gaps (confirm at implementation time)

1. **Response-header `ErrCode` semantics** — the JAR logs but does
   not branch on it. During Phase 7 impl, instrument and confirm
   with Pinelabs whether any non-zero value should override the
   CSV body's response code. Until then, CSV body wins.
2. **Frame max growth** — confirm whether real-world PADController
   deployments ever exceed 2 048 bytes (newer terminals with longer
   EMI / NCMC / charge-slip payloads). If yes, a length-prefixed
   multi-segment variant is needed; out of scope for v1 unless
   confirmed during impl.
