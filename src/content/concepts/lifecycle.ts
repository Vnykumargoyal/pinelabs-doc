export const lifecycleContent = `
# Lifecycle & Threading

The SDK's threading model is designed to keep your UI responsive while ensuring
all terminal I/O is handled safely and without race conditions.

---

## SDK Construction

Create the SDK instance once, at application startup (or before your first
transaction). Construction is synchronous and inexpensive.

\`\`\`kotlin
// Android
val sdk = PineBillingSdk(context, TransportOpt.APP_TO_APP)
\`\`\`

\`\`\`swift
// iOS
let sdk = PineBillingSdk(transport: .ble(peripheralId: uuid))
\`\`\`

\`\`\`python
# Python
sdk = PineBillingSdk(transport=TransportOpt.TCP, host="192.168.1.100", port=9100)
\`\`\`

> **Tip:** Store the SDK instance as a singleton or in your dependency-injection
> container. Re-creating it on every transaction wastes resources.

---

## The Listener contract

Every top-level SDK call (\`doTransaction\`, \`testPrint\`, \`getStatus\`,
\`abortTransaction\`) accepts a **listener** / **callback** object with three
methods:

| Method | Called when | Notes |
|---|---|---|
| \`onStarted(eventId)\` | The terminal has accepted the request | **Persist \`eventId\` here.** |
| \`onSuccess(result)\` | Terminal confirms a successful outcome | \`result\` contains receipt data |
| \`onFailure(error)\` | Terminal rejects, times out, or an error occurs | Always called — never both |

### Critical: Persist event_id in \`onStarted\`

\`\`\`text
Your app
  │
  ├─ doTransaction(request, listener)
  │
  │   SDK internal
  │   ├─ Sends request to terminal
  │   ├─ Terminal ACKs ──► listener.onStarted(eventId)   ← PERSIST HERE
  │   │
  │   ├─ Terminal processes …
  │   │
  │   ├─ Success ──────────► listener.onSuccess(result)
  │   └─ Failure ──────────► listener.onFailure(error)
\`\`\`

If your process crashes between \`onStarted\` and \`onSuccess\`, you can use
\`eventId\` to query the terminal and recover the result.

---

## Threading guarantees

1. **Caller thread** — you may call \`doTransaction\` from any thread.
2. **I/O thread** — the SDK performs all transport I/O on its own internal thread pool.
3. **Callback thread** — \`onStarted\`, \`onSuccess\`, \`onFailure\` are always called
   on a **background thread** managed by the SDK. You must marshal to the UI
   thread yourself.

### Android — marshal to main thread

\`\`\`kotlin
sdk.doTransaction(request, object : TransactionListener {
    override fun onStarted(eventId: String) {
        db.saveEventId(eventId)          // safe — background is fine
    }
    override fun onSuccess(result: TransactionResult) {
        runOnUiThread { showReceipt(result) }
    }
    override fun onFailure(error: SdkError) {
        runOnUiThread { showError(error) }
    }
})
\`\`\`

### iOS — dispatch to main queue

\`\`\`swift
sdk.doTransaction(request: req) { event in
    switch event {
    case .started(let eventId):
        self.persist(eventId)
    case .success(let result):
        DispatchQueue.main.async { self.showReceipt(result) }
    case .failure(let error):
        DispatchQueue.main.async { self.showError(error) }
    }
}
\`\`\`

---

## Connection lifecycle

| State | Description |
|---|---|
| **Idle** | No active transaction; transport may be disconnected |
| **Connecting** | SDK is establishing the transport connection |
| **Active** | Transaction in progress |
| **Reconnecting** | Transport dropped mid-transaction; SDK is retrying |
| **Terminal error** | Cannot recover; \`onFailure\` called |

---

## Timeouts

| Parameter | Default | Description |
|---|---|---|
| \`connectTimeoutMs\` | 15 000 | Maximum time to establish transport connection |
| \`transactionTimeoutMs\` | 120 000 | Maximum time for a full transaction cycle |
| \`reconnectAttempts\` | 3 | How many reconnect attempts before giving up |

Override at SDK construction:

\`\`\`kotlin
val sdk = PineBillingSdk(
    context,
    TransportOpt.APP_TO_APP,
    SdkConfig(transactionTimeoutMs = 180_000)
)
\`\`\`

---

## Concurrency — one transaction at a time

The SDK serialises all calls internally. If you call \`doTransaction\` while
another transaction is in flight, the new call immediately invokes
\`onFailure(SdkError.BUSY)\`. Your application is responsible for
preventing the user from initiating a second payment while one is pending.
`

