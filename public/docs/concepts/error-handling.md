# Error handling

Every failure surfaces as a typed `SdkError` variant. This page is
the reference for what each variant means, when it can fire, how to
recover, and whether you'll see it synchronously thrown or
asynchronously delivered to a listener.

For the threading rules around callbacks, see
[`lifecycle.md`](./lifecycle.md).

---

## The `SdkError` taxonomy

| Variant | Carries | Synchronous? | Async via listener? |
|---|---|---|---|
| `InvalidInput(detail)` | Short, non-PII description | ✓ | — |
| `TransportUnavailable(detail)` | Diagnostic (e.g. "MasterApp not installed") | ✓ (bind step) | ✓ (mid-flight) |
| `Timeout(detail)` | Stage name | — | ✓ |
| `TransactionFailed(detail, terminalResponseCode?)` | Raw acquirer/terminal message + code | — | ✓ |
| `Internal(detail)` | Diagnostic; SDK-side defect | ✓ or ✓ | ✓ |
| `NotConnected()` | — | ✓ | — |
| `OperationInProgress(activeEventId)` | Id of the in-flight op | ✓ | — |
| `Cancelled()` | — | — | ✓ |
| `TransportError(detail)` | Mid-flight transport failure | — | ✓ |
| `NotSupported(detail)` | Method name (do not parse) | ✓ | — |

Two delivery channels exist for the listener-based methods
(`doTransaction`, `testPrint`, `discoverTerminals`):

* **Synchronously thrown**: the call returns/raises before any
  callback fires. Caused by caller-side validation
  (`InvalidInput`), invalid SDK state for the call
  (`NotConnected`, `OperationInProgress`, `NotSupported`,
  `TransportUnavailable` at bind-time), or the transport refusing
  to start. **No callback fires.**
* **Asynchronously via the listener**: the call returns; later
  `onFailure(error)` fires on a worker thread. All transport,
  terminal, timeout, and cancellation outcomes after the SDK has
  accepted the call.

---

## Variant-by-variant reference

### `InvalidInput(detail)`

**Fires when** caller-supplied input fails validation. Always
synchronous; never via a listener.

Common triggers:

* `amount <= 0` or `amount > 99_999_999`.
* `billingRefNo` is blank after trim.
* `currency` (when set) is not exactly 3 ASCII uppercase letters.
* `originalEventId` is missing for `Refund` / `Void` / `Capture`,
  or supplied for `Sale` / `PreAuth` / `BalanceInquiry`.
* `referenceId` longer than 64 chars.
* `metadata` has more than 10 entries, or any value longer than
  256 chars.
* `transportOptions` variant does not match the active transport.
* On Cloud, `transportOptions` is null (the
  `transactionNumber` / `sequenceNumber` keys are mandatory).
* `cancel` / `checkStatus` `options` mismatch the active transport.

**Recovery:** fix the caller's input. Treat as a programmer-side
bug; never retry blindly.

**Retryable:** No.

---

### `TransportUnavailable(detail)`

**Fires when** the active transport could not be reached or bound
at the start of a call (synchronous), or the transport reports the
link is gone (asynchronous, mid-flight).

Common triggers:

* App-to-App: `MasterApp not installed`, `bindService failure`,
  `service died` mid-flight.
* Cloud: TCP-connect failure to `cloudBaseUrl`, DNS failure.
* PADController: local PADController service not running, named
  pipe unreachable.

**Recovery:** surface to the user ("The terminal is not
available"). Optionally retry with backoff. For App-to-App, prompt
the user to install MasterApp from the Pinelabs Developer Portal.

**Retryable:** Yes (with backoff).

---

### `Timeout(detail)`

**Fires when** the SDK awaited a reply for longer than the
configured timeout. Always asynchronous via the listener.

`detail` names the stage: `service-bind`, `messenger-reply`,
`http-read`, `tcp-read`, `pad-frame-reply`, etc.

**Recovery:** the request **may or may not** have committed at the
terminal. Treat as ambiguous; do **not** silently retry on a
charge-issuing operation (`Sale`, `PreAuth`, `Capture`) without
a `checkStatus` confirmation that the original did not commit.

**Retryable:** Conditionally — see "Idempotency" in
[`eventid-and-reconciliation.md` §6](./eventid-and-reconciliation.md).

---

### `TransactionFailed(detail, terminalResponseCode?)`

**Fires when** the terminal returned a non-success response. Always
asynchronous via the listener.

* `detail` is the raw acquirer/terminal message — pass it through
  to logs / diagnostic UI verbatim.
* `terminalResponseCode` is the raw acquirer code (commonly a
  short string like `"05"`, `"51"`, `"1023"`); the SDK does not
  classify these into "retryable" buckets.

**Recovery:** show the terminal's message to the cashier; let
them decide whether to retry, accept cash, or ask for another
card.

**Retryable:** No (the customer's card was processed and declined).

---

### `Internal(detail)`

**Fires when** the SDK or its bindings hit a defect — malformed
reply, panic in the Rust core, encoding error.

**Recovery:** report to Pinelabs SDK support with the `detail`,
your `event_id`, and a log capture. Do not silently retry; this
is a bug, not a transient.

**Retryable:** No.

---

### `NotConnected()`

**Fires when** a transport that requires a separate connect step
(PADController, TCP) is in a disconnected state. Always
synchronous.

**Recovery:** call `connect(terminal)` first.

**Retryable:** Yes (after `connect`).

---

### `OperationInProgress(activeEventId)`

**Fires when** the caller invoked a listener-based method while
another op is in flight on the same SDK instance. Always
synchronous.

**Recovery:** don't. This is a UI bug — the trigger control was
not disabled on `onStarted`. Disable it. The SDK refuses to silently
queue concurrent ops to avoid double-charge bugs.

**Retryable:** No (call after the in-flight op completes).

---

### `Cancelled()`

**Fires when** the caller successfully cancelled an in-flight op
that did not commit at the terminal. Asynchronous via the listener.

**Recovery:** show "Cancelled" to the user. Do not auto-retry.

**Retryable:** Caller-driven (re-issue with a new `event_id`).

---

### `TransportError(detail)`

**Fires when** the underlying transport failed mid-stream — socket
reset, IPC `linkToDeath`, HTTP body truncated. Asynchronous via
the listener.

**Recovery:** treat like `Timeout` — the request may or may not
have committed. Do not silently retry charge-issuing operations
without a `checkStatus`.

**Retryable:** Conditionally — see
[`eventid-and-reconciliation.md` §6](./eventid-and-reconciliation.md).

---

### `NotSupported(detail)`

**Fires when** the active transport does not implement the called
capability (e.g. `cancel` on App-to-App, `discoverTerminals` on
Cloud). Always synchronous.

`detail` is a human-readable diagnostic naming the method; **do
not parse it programmatically** — its casing and wording vary by
language binding (e.g. Kotlin: `"checkStatus is not supported on
AppToApp"`; Python: `"check_status is not supported on AppToApp"`).
Use `setTransport` to switch to a transport that supports the
capability, or guard the call with the
[capability matrix](./capabilities.md).

**Retryable:** No.

---

## Retryability cheat sheet

```
                 Retryable? (with reason)
─────────────────────────────────────────────────────
InvalidInput                  No   — programmer error
TransportUnavailable          Yes  — transient; backoff
Timeout                       Maybe — see §6 of eventid-and-reconciliation
TransactionFailed             No   — card declined
Internal                      No   — SDK defect; report
NotConnected                  Yes  — call `connect` first
OperationInProgress           No   — wait for in-flight op
Cancelled                     Caller-driven
TransportError                Maybe — same as Timeout
NotSupported                  No   — wrong transport
```

---

## Idiomatic handling per language

* **Kotlin:** `try { sdk.cancel(id, opts) } catch (e: SdkError.NotSupported) { … }`
  — the bindings expose each variant as a sealed-class subclass of
  `SdkError`. Use `when` for exhaustive matching.
* **Swift:** `do { … } catch SdkError.notSupported(let detail) { … }`.
* **Python:** subclasses of `SdkException`; `try/except SdkError.NotSupported`.
* **Node.js:** `instanceof SdkError.NotSupported` on the caught
  exception, or check `.kind === "NotSupported"`.
* **C:** every API returns a `pine_billing_status_t`; populate a
  `pine_billing_error_t` out-param to read the variant tag and the
  `detail` C string. Free with `pine_billing_error_free`.

---

## Top-level `try/catch` pattern (recommended)

```kotlin
fun chargeOrder(orderId: String, amountPaise: Long) {
    try {
        sdk.doTransaction(buildRequest(orderId, amountPaise), uiListener)
    } catch (e: SdkError.OperationInProgress) {
        toast("Already processing: ${e.activeEventId}")
    } catch (e: SdkError.InvalidInput) {
        log.error("Programmer error: ${e.detail}")
    } catch (e: SdkError) {
        toast("Could not start: ${e}")
    }
}
```

Inside the listener, you only need to handle the **async** variants:
`Timeout`, `TransactionFailed`, `Internal`, `Cancelled`,
`TransportError`, `TransportUnavailable` (mid-flight).
