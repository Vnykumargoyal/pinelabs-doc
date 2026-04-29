# Lifecycle and threading

This page is the contract for **when** to construct the SDK, **how
many** instances to keep around, and **which** thread your code (and
ours) is running on at every step. Get this wrong and you will see
`OperationInProgress` errors, frozen UIs, or — worst case —
double-charged customers.

---

## 1. Construction

```text
sdk = PineBillingSdk(config, appToAppBridge)
```

Rules:

| Rule | Why |
|---|---|
| **One instance per process.** Construct it once at app startup, share it everywhere. | The SDK keeps an in-memory operation registry keyed by `event_id`. Two instances → two registries → `checkStatus` returns `Unknown` for ops the *other* instance ran. |
| **Construction is fast and synchronous.** Safe on the main thread. | We do no I/O during construction. |
| **Construction validates the config.** Invalid `SdkConfig` raises `SdkError.InvalidInput` immediately. | Catch misconfiguration at app launch, not at the first transaction. |
| **`appToAppBridge` is required iff you ever call `setTransport(AppToApp)` or set `transport = AppToApp` in the config.** | The Rust core has no Android API access; the bridge is how it reaches MasterApp. On Android, the binding constructs the bridge for you when you pass `SdkConfig.appToApp`. |
| **Construction is idempotent in spirit, not by enforcement.** Calling the constructor twice will not crash, but you will leak an SDK and confuse `checkStatus`. | We do not panic on a second construction because some test harnesses legitimately need two SDKs against fakes. |

> **Single-instance pattern**, per language idiom:
>
> * Kotlin / Java: a `Singleton` object or `@Provides @Singleton` DI binding.
> * Swift: a `static let shared` on your wrapper.
> * Python: a module-level instance assigned once at import time.
> * Node.js: a default export from a single `sdk.ts` module.
> * C: a process-wide `static` pointer guarded by `pthread_once`.

---

## 2. Threading model

The SDK has three relevant thread categories:

```
┌──────────────┐     submit      ┌──────────────┐    transport I/O    ┌──────────┐
│ Caller       │ ──────────────► │ SDK worker   │ ──────────────────► │ Terminal │
│ (you)        │                 │ thread(s)    │                     │          │
│              │ ◄─────────────  │              │ ◄────────────────── │          │
└──────────────┘    callback     └──────────────┘     reply           └──────────┘
       ▲              fired
       │
       │ marshal to UI thread before touching UI
```

### 2.1 Caller thread (your code)

* **Listener-based methods** — `doTransaction`, `testPrint`,
  `discoverTerminals` — return immediately after synchronous
  validation. Safe to call from any thread, including the UI thread.
  The SDK does no blocking I/O on the caller's thread.
* **Blocking methods** — `cancel`, `checkStatus`, `connect`,
  `disconnect`, `ping`, `runSelfTest`, `getLogs`, `getTerminalInfo`,
  `setTransport` — perform I/O inline. **You MUST call them from a
  worker thread, never from the UI thread.** Most language bindings
  enforce this:
  * **Android (Kotlin):** the SDK throws `IllegalStateException`
    on detection of `Looper.getMainLooper()`. Use `Dispatchers.IO`,
    an `Executor`, `WorkManager`, etc.
  * **iOS (Swift):** the SDK does not detect the main thread
    automatically; you are responsible. Use a
    `DispatchQueue.global(qos: .userInitiated)` or `Task.detached`.
  * **Python:** call from a worker thread (`concurrent.futures`,
    `asyncio.to_thread`).
  * **Node.js:** call from a `worker_thread` or wrap with
    `setImmediate`. JS is single-threaded but blocking the event
    loop on a multi-second IPC round-trip is unacceptable.
  * **C:** call from any non-UI thread.

### 2.2 SDK worker thread

* The SDK owns a small Tokio thread pool inside the Rust core. You
  cannot configure it.
* Transport I/O — `bindService`, HTTPS posts, TCP reads, PAD
  framing — runs on this pool.
* On Android, App-to-App also spins a one-shot `HandlerThread` per
  call to host the `Messenger` reply handler; it is created and
  quit inside a single `roundTrip()`.

### 2.3 Listener callback thread

* Callbacks (`onStarted`, `onSuccess`, `onFailure`,
  `onTerminalFound`, `onCompleted`) are **always** dispatched from
  an SDK-internal thread.
* Callbacks are **serialised** — no two callbacks ever fire
  concurrently on the same listener.
* Callbacks are **never** fired on the caller's stack frame: if you
  call `doTransaction(...)` from thread *T*, no callback method
  will execute on thread *T* before `doTransaction` returns.
* Your callback **MUST NOT block.** Hand off to a UI dispatcher
  (`runOnUiThread`, `DispatchQueue.main`, etc.) and return.
* Your callback **MUST NOT** re-enter the SDK with `doTransaction`
  / `testPrint` / `discoverTerminals` synchronously. Schedule the
  next call on your worker pool. Re-entrant blocking calls
  (`cancel`, `checkStatus`) are legal but most apps do them on
  their own worker queue.

> **Why two-step (call returns, then callback fires)?** Listener-based
> methods can take tens of seconds at the terminal (cardholder
> inserting a card, entering a PIN, acquirer responding). A
> synchronous API would either block your UI for that time or force
> you into a thread-per-transaction model. The two-step model lets
> you write the natural code: show a "tap card" UI, then update the
> screen when the callback fires.

---

## 3. Concurrency: one operation per instance

The SDK enforces a **single in-flight operation per
`PineBillingSdk` instance**:

```kotlin
sdk.doTransaction(req1, listener1)   // accepted; onStarted fires
sdk.doTransaction(req2, listener2)   // throws SdkError.OperationInProgress(activeEventId = …)
```

The synchronously-thrown `OperationInProgress` carries the
`active_event_id` of the in-flight call so your UI can show "still
busy with order #123…".

**Your UI MUST disable the trigger control** (the "Charge ₹X"
button) on `onStarted` and re-enable it on `onSuccess` /
`onFailure`. This is the canonical way to avoid double-charge bugs
and is the reason the SDK refuses to silently queue a second op.

`cancel` / `checkStatus` are **not** counted as ops — you can call
`checkStatus(activeEventId)` while another transaction is in flight
to drive a "still waiting…" spinner on the Cloud transport.

Multiple SDK instances are not a workaround to run two ops in
parallel. The single-instance-per-process rule (§1) takes
precedence; for throughput, serialise on a worker queue.

---

## 4. Lifecycle of a single op

```
T0  caller thread       sdk.doTransaction(req, listener)
                            │  validates, allocates event_id
                            │  enqueues on worker pool
                            ▼
                        (returns — caller thread is free)
T1  worker thread       listener.onStarted(event_id)
                            │
                            │  active transport: bind / connect /
                            │  send / await reply / unbind
                            ▼
T2  worker thread       terminal sees the request, cardholder
                        interaction, acquirer round-trip
                            │
                            ▼
T3  worker thread       listener.onSuccess(result)        ← terminal said yes
                          OR
                        listener.onFailure(error)         ← terminal / transport / timeout
```

Between T0 and T1 the SDK is in `OperationState.Pending`; between T1
and T3 it is in `InFlight`; after T3 it is `Completed`, `Failed`, or
`Cancelled`. See
[`eventid-and-reconciliation.md`](./eventid-and-reconciliation.md)
for how to query this state after a process restart.

---

## 5. Tear-down

The SDK does not require an explicit `close()` / `shutdown()` call.
At process exit:

* the worker pool is dropped and joined automatically;
* on Android, any per-call `HandlerThread` has already been quit
  in its own `finally` block;
* there are no persistent file handles, network sockets, or
  listening ports to leak.

If you must release transport resources before exit (long-running
service, dynamic re-config), call `disconnect()` first, then drop
your reference to the SDK. After `disconnect()`, calling any
transport-touching method raises `SdkError.NotConnected` until you
`connect()` again (or until App-to-App's per-call bind takes over).

---

## 6. Common mistakes

| Symptom | Likely cause |
|---|---|
| `IllegalStateException: Pine Labs SDK called from main thread` | You called `cancel`, `checkStatus`, `connect`, `ping`, etc. on the Android UI thread. Move to `Dispatchers.IO`. |
| `OperationInProgress(active_event_id = …)` on the very next call | You did not disable the trigger control on `onStarted`. The user tapped "Charge" twice. |
| Callback never fires | Your `TransactionListener` threw an exception in `onStarted` or `onSuccess` and you swallowed it; the SDK delivered, but you never saw it. Add a top-level `try / catch` and log. |
| `onSuccess` arrives, then your UI does nothing | Your callback ran on the SDK worker thread; you tried to update a `TextView` directly and the framework silently failed. Marshal to the UI thread. |
| `checkStatus` returns `Unknown` for an `event_id` you definitely allocated | You constructed two SDK instances. Consolidate to one (§1). |
| Cloud `cancel` hangs for 30 s and then `Timeout` | You called `cancel` on the UI thread on Android, OR you forgot `cancelOptions = CancelOptions::Cloud { amount }` and the *server* rejected, OR your `cloudConnectTimeoutMs` is too long. Check logs. |
