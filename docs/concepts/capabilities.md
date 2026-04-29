# Capability matrix

This page is the **formal reference** for what each transport can
and cannot do in v1. Every cell that says `NotSupported` corresponds
to a real `SdkError.NotSupported` raised by the SDK at call time.

For prose-style transport descriptions, see
[`transports.md`](./transports.md).

---

## Method × transport matrix (v1)

| Capability | App-to-App | TCP ※ | Cloud | PADController (BT/USB/Serial) |
|---|---|---|---|---|
| `doTransaction` | ✓ | ✓ | ✓ ✚ | ✓ |
| `testPrint` | ✓ | ✓ | ✓ ✚ | ✓ |
| `cancel` | `NotSupported` ◊ | ✓ | ✓ ✚ | ✓ |
| `checkStatus` | `NotSupported` ◊ | ✓ | ✓ ✚ | ✓ |
| `connect` / `disconnect` | no-op † | ✓ | no-op (HTTPS per call) | ✓ |
| `isConnected` | `true` only mid-call † | ✓ | always `false` | reflects link state |
| `discoverTerminals` | `NotSupported` | ✓ | `NotSupported` | ✓ ‡ |
| `ping` | `NotSupported` | ✓ | `NotSupported` | ✓ |
| `runSelfTest` | `NotSupported` | ✓ | `NotSupported` | ✓ |
| `getLogs` | `NotSupported` | ✓ | `NotSupported` | ✓ |
| `getTerminalInfo` | `NotSupported` | ✓ | `NotSupported` | ✓ |
| `setTransport` (target) | always available | placeholder ※ | always available | always available |

**Footnotes**

* **†** App-to-App binds the MasterApp service per call; explicit
  `connect` / `disconnect` are accepted as no-ops, and
  `isConnected` returns `true` only while a call is in flight.
* **◊** The MasterApp Messenger protocol exposes neither a
  server-side cancel nor a status reconciliation endpoint.
  `cancel` raises `NotSupported`; `checkStatus` raises
  `NotSupported` on App-to-App (other transports route the call
  through the SDK's in-memory operation registry).
* **‡** PADController discovery is transport-specific: Bluetooth
  ✓; USB and Serial enumerate the device list known to
  PADController.
* **※** TCP direct is a v1 placeholder (delta D24): wire protocol
  is greenfield and unspecified at the time of writing; calls may
  raise `NotSupported` until the adapter ships.
* **✚** Cloud `doTransaction` resolves with
  `TransactionStatus.Pending` (delta D23(g)); the merchant drives
  settlement via `checkStatus`. Cloud `cancel` / `checkStatus`
  require a `*Options::Cloud` extras object; see the per-method
  docs.

---

## TransactionType × transport matrix (v1)

| Operation | App-to-App | Cloud | PADController | TCP ※ |
|---|---|---|---|---|
| `Sale` | ✓ | ✓ | ✓ | ✓ |
| `Refund` | ✓ | ✓ | ✓ | ✓ |
| `Void` | ✓ | ✓ | ✓ | ✓ |
| `PreAuth` | ✓ | ✓ | ✓ | ✓ |
| `Capture` (= post-auth) | ✓ | ✓ | ✓ | ✓ |
| `BalanceInquiry` (NCMC) | ✓ | `NotSupported` | varies by terminal model | ✓ |

If a transport does **not** support a given `TransactionType`, the
SDK raises `SdkError.NotSupported` synchronously from
`doTransaction` (no callback fires).

---

## TransportOptions × transport matrix

`TransactionRequest.transportOptions` is a discriminated union; you
must pass **the variant matching the active transport** or the SDK
raises `SdkError.InvalidInput` synchronously.

| Active transport | Required / accepted variant |
|---|---|
| App-to-App | `TransportOptions::AppToApp { gstIn?, gstBrkUp?, serviceId?, serviceMi?, isTransitMode?, paymentMode?, serviceData? }` (all optional) |
| Cloud | `TransportOptions::Cloud { transactionNumber, sequenceNumber, allowedPaymentMode?, autoCancelDurationInMinutes?, forceCancelOnBack?, merchantStorePosCode? }` — `transactionNumber` and `sequenceNumber` are **required** |
| PADController | `TransportOptions::PadController { extras: Map<String,String>? }` — placeholder; concrete typed fields will be promoted from `extras` as the CSV column set stabilises |
| TCP | not yet specified |

Mismatched variant — e.g. supplying `Cloud` while the active
transport is App-to-App — raises `SdkError.InvalidInput` with a
diagnostic detail.

---

## CancelOptions × transport matrix

`PineBillingSdk.cancel(eventId, options)` accepts:

| Active transport | `options` |
|---|---|
| App-to-App | always raises `NotSupported`; `options` ignored |
| Cloud | `CancelOptions::Cloud { amount }` — **required** |
| PADController | `null` |
| TCP | `null` |

Supplying `Cloud` on a non-Cloud transport — or omitting it on
Cloud — raises `SdkError.InvalidInput`.

---

## CheckStatusOptions × transport matrix

`PineBillingSdk.checkStatus(eventId, options)` accepts:

| Active transport | `options` |
|---|---|
| App-to-App | always raises `NotSupported`; `options` ignored |
| Cloud | `CheckStatusOptions::Cloud { merchantStorePosCode }` — **required** |
| PADController | `null` (answered from in-memory state) |
| TCP | `null` (answered from in-memory state) |

---

## `allowedPaymentModes` semantics by transport

| Transport | Behaviour |
|---|---|
| App-to-App | Forwarded to the terminal verbatim. |
| Cloud | **Ignored** in v1. Use `TransportOptions::Cloud.allowedPaymentMode` (opaque string code) instead. |
| PADController | Forwarded if the underlying CSV column for that mode is in scope. |
| TCP | Behaviour TBD with the adapter. |

---

## Reading this matrix

* **`✓`** — supported and tested.
* **`NotSupported`** — call site raises `SdkError.NotSupported` at
  call time. The error's `detail` names the method; do not parse
  it programmatically (its casing varies by language binding).
* **`no-op`** — call returns successfully without doing any work.
* **`placeholder`** — supported in the API surface for forward
  compatibility, but raises `NotSupported` until the adapter
  ships.

When in doubt, write your code defensively: catch `NotSupported`
and fall back to a transport that does support the capability, or
surface the limitation to the user. The matrix above is also the
behaviour that the SDK's CI tests guard, so what you see is what
you get.
