# `event_id` and reconciliation

Every transaction the SDK handles is identified by an **`event_id`**
— a UUIDv4 the SDK allocates on `doTransaction` and hands back via
`TransactionListener.onStarted`. This page explains what that id is
for and exactly how to use it for crash-recovery and bookkeeping.

---

## 1. Who allocates the `event_id`

**The SDK.** Always. You never construct it, you never guess it,
you do not get to pick the format.

```kotlin
sdk.doTransaction(request, object : TransactionListener {
    override fun onStarted(eventId: String) {
        // The SDK has allocated a UUIDv4 for this op.
        // Persist it NOW (see §3 below) before showing any UI.
    }
    override fun onSuccess(result: TransactionResult) { /* … */ }
    override fun onFailure(error: SdkError) { /* … */ }
})
```

`onStarted` fires before `onSuccess` / `onFailure` iff the SDK
accepted the call. If `doTransaction` raised `SdkError` synchronously
(e.g. `InvalidInput`, `OperationInProgress`, `TransportUnavailable`
during bind), no `event_id` was allocated and no callback fires.

---

## 2. Lifecycle states

```
                   ┌───────────────────────┐
                   │      Pending          │   SDK accepted, transport not yet engaged
                   └───────────┬───────────┘
                               │
                               ▼
                   ┌───────────────────────┐
                   │      InFlight         │   transport engaged, awaiting reply
                   └─┬────────┬──────────┬─┘
                     │        │          │
            success  │        │ failure  │ cancel
                     ▼        ▼          ▼
       ┌─────────────────┐  ┌────────┐  ┌───────────┐
       │   Completed     │  │ Failed │  │ Cancelled │
       └─────────────────┘  └────────┘  └───────────┘

       Unknown ─── reserved for "SDK has no record of this id"
                   (process restarted, never allocated, etc.)
```

Query the current state with `checkStatus`:

```kotlin
val status = sdk.checkStatus(eventId, options)
when (status.state) {
    OperationState.Pending,
    OperationState.InFlight  -> showSpinner()
    OperationState.Completed -> renderResult(status.result!!)
    OperationState.Failed    -> showError(status.failureDetail, status.terminalResponseCode)
    OperationState.Cancelled -> showCancelled()
    OperationState.Unknown   -> // see §4
}
```

---

## 3. The persistence contract

This is the rule that keeps you reconciled:

> **Persist the `event_id` to durable storage in `onStarted`,
> before you show any "in progress" UI.** Persist the same id in
> `onSuccess` / `onFailure` together with the terminal-state
> outcome.

```kotlin
override fun onStarted(eventId: String) {
    db.insertOpInFlight(orderId = currentOrderId, eventId = eventId, startedAt = now())
    // … then update the UI
}

override fun onSuccess(result: TransactionResult) {
    db.markOpCompleted(eventId = result.eventId, txnId = result.transactionId)
}

override fun onFailure(error: SdkError) {
    db.markOpFailed(eventId = currentEventId, error = error.toString())
}
```

Why: if your app crashes between `onStarted` and the terminal-state
callback (process killed, OOM, OS reboot, user force-stop), the
**only** thing that lets you find out what really happened is the
`event_id`. Without it the customer's card may have been charged
and you have no way to discover it from the SDK alone.

---

## 4. `OperationState.Unknown` — what to do

`Unknown` is returned in three legitimate situations:

| Situation | Recovery |
|---|---|
| **The SDK was restarted.** The in-memory registry was wiped. The op may have completed at the terminal before the crash. | On App-to-App / PADController / TCP, the answer is irretrievable from the SDK; reconcile via Pinelabs back-office reports keyed by `billingRefNo` / `invoiceNo` / `referenceId`. **On Cloud, call `checkStatus(eventId)` again — the cloud server is the source of truth, not the SDK's registry.** |
| **The id was never allocated by *this* SDK.** Two SDK instances ran in the same process; the id came from the other. | Consolidate to a single SDK instance ([`lifecycle.md` §1](./lifecycle.md)). |
| **Memory pressure / explicit purge.** Long-lived processes may purge completed ops from the registry after some time. | Same as the restart case. |

`Unknown` is **not** an error in the SDK's view; `checkStatus`
returns it cleanly without raising `InvalidInput`.

---

## 5. `event_id` semantics by transport

The `event_id` you pass to `cancel` and `checkStatus` differs by
transport:

| Transport | What `event_id` means for `cancel` / `checkStatus` |
|---|---|
| App-to-App | The SDK-allocated UUIDv4 from `onStarted`. **Both `cancel` and `checkStatus` raise `NotSupported`** — the protocol does not expose them. |
| Cloud | The `PlutusTransactionReferenceID` returned by Upload, **not** the SDK UUIDv4. The SDK mirrors the cloud reference into `TransactionResult.transaction_id` on the `Pending` callback (delta D23(h)); pass that value to `cancel` / `checkStatus`. The SDK does not maintain an event-id ↔ cloud-ref mapping; the merchant passes the cloud ref directly. |
| PADController | The SDK-allocated UUIDv4. |
| TCP | The SDK-allocated UUIDv4. |

This asymmetry exists because the cloud server has its own opaque
identifier that the SDK can't translate back into a UUIDv4 after a
restart. Persisting the `transaction_id` returned in the Cloud
`Pending` callback is just as important as persisting the
`event_id`.

---

## 6. Idempotency

The SDK does **not** auto-retry. If `onFailure(Timeout)` fires,
your app must decide:

* **Retryable** failures (`TransportUnavailable`, `Timeout`,
  `NotConnected`, `TransportError`) — re-issue `doTransaction`
  with a **new** request and you will get a **new** `event_id`.
* **Terminal-state** failures (`TransactionFailed`,
  `InvalidInput`, `NotSupported`, `OperationInProgress`,
  `Cancelled`, `Internal`) — do not re-issue without operator
  intervention.

For the canonical retryability matrix see
[`error-handling.md`](./error-handling.md).

If you re-issue, you will burn one row in your local op table per
attempt. Some integrators reuse the merchant `referenceId` /
`billingRefNo` across attempts so back-office reconciliation can
identify them as one logical order — this is your call, not the
SDK's.

For Cloud, `CloudTransactionOptions.transactionNumber` is the
**Pinelabs server-side idempotency key**: re-uploading with the
same `transactionNumber` returns the original Pinelabs reference
without re-charging the card. Use this if your retry storm is in a
window that the cloud server still remembers.

---

## 7. `cancel` semantics

`cancel(eventId, options)` is **best-effort**:

* If the transport supports a server-side cancel and the terminal
  has not yet committed, the cancel succeeds and the eventual
  outcome moves to `OperationState.Cancelled`.
* If the terminal has already committed (the card was charged),
  `cancel` is a no-op. The eventual outcome is still `Completed`
  / `Success`. Your code MUST treat `cancel` as advisory and wait
  for the terminal-state callback / `checkStatus` to settle.

The SDK never silently auto-cancels.

---

## 8. Practical reconciliation workflow

```
1. User taps "Charge ₹X".
2. App: insert pending op row with merchant order id; show spinner.
3. App: sdk.doTransaction(req, listener).
4. listener.onStarted(eventId)
   → App: update row with event_id; persist BEFORE UI changes.
5. listener.onSuccess(result) OR onFailure(error)
   → App: update row with terminal-state result; print receipt;
     close.

Crash recovery (after a restart with a row stuck in "in flight"):
6. App start-up: fetch all rows in (Pending, InFlight); for each:
   - App-to-App / PADController / TCP: row's id is irrecoverable
     via the SDK; mark "needs back-office reconciliation".
   - Cloud: read the persisted `transaction_id` (cloud ref); call
     sdk.checkStatus(transactionId, CheckStatusOptions::Cloud { … });
     update row from result.
```

That workflow plus the persistence rule in §3 is the entirety of
"reconciliation" for an SDK-based integration.
