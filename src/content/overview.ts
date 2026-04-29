export const overviewContent = `
# Pine Labs SDK — Overview

> **Audience:** Merchant-side application developers integrating Pinelabs
> in-store / billing terminals into their own POS, restaurant, retail
> or unattended-checkout software.

---

## What the SDK is

The **Pine Labs SDK** is a single, language-idiomatic library that
your application uses to drive a Pinelabs payment terminal. From your
code's point of view, you call:

\`\`\`text
PineBillingSdk.doTransaction(request, listener)
\`\`\`

and the SDK handles everything else:

| Layer | What the SDK does |
|---|---|
| **Transport** | Speaks the right wire protocol (App-to-App Intent, Bluetooth BLE, USB HID, TCP/IP REST) |
| **Protocol** | Frames, encodes, and sends the PAD Controller byte stream |
| **Threading** | Keeps all I/O off the caller's thread |
| **Lifecycle** | Reconnects on drop, times out cleanly, surfaces errors |
| **Idempotency** | Tags every transaction with a unique \`event_id\` so you can reconcile safely |

---

## SDK vs MasterApp

On Android the SDK calls into the **MasterApp** (Pine Labs's own
POS kernel) via an Intent-based App-to-App (A2A) RPC.
On every other platform the SDK communicates with the terminal
hardware directly over a transport you choose at construction time.

\`\`\`text
Your application
  Pine Labs SDK
  - doTransaction()    testPrint()
  - getStatus()        abortTransaction()
  
  Android A2A → MasterApp
  BLE/USB/TCP → Terminal hardware
\`\`\`

---

## Quick-start checklist

1. **Pick your platform** — Android or one of the server/desktop clients.
2. **Choose a transport** — see Transports.
3. **Add the dependency** — see the per-language setup guide.
4. **Initialise the SDK** — one line, at app start.
5. **Build a request** — set amount (in paise / cents) and transaction type.
6. **Call \`doTransaction\`** — pass the request and a listener.
7. **Handle the result** — persist \`event_id\`, show the receipt.

---

## Design principles

### Language-idiomatic

The Android SDK uses Kotlin idioms (data classes, coroutines-friendly
callbacks). The Python SDK matches Python conventions (snake_case,
type hints, context managers). Every binding follows the idioms of
its host language, not a lowest-common-denominator C style.

### Single entry point, consistent API shape

All platforms expose the same four top-level calls:

| Method | Purpose |
|---|---|
| \`doTransaction(request, listener)\` | Run any payment transaction |
| \`testPrint(lines, listener)\` | Drive the receipt printer |
| \`getStatus(listener)\` | Check terminal connectivity |
| \`abortTransaction(listener)\` | Attempt to cancel in-flight transaction |

### Thread-safe, non-blocking

All calls are asynchronous. The SDK keeps I/O off your UI / main thread.
Callbacks arrive on a background thread; marshal to your UI thread yourself.

### Minimal dependencies

| Platform | Added dependencies |
|---|---|
| Android | JNA (AAR), Gson |
| iOS | None (Swift Package, zero transitive deps) |
| Python | \`pyserial\` or \`bleak\` (optional, transport-dependent) |
| Node.js | Zero dependencies |
| C | None (static lib + header) |

---

## Version history

| Version | Status | Notes |
|---|---|---|
| v1 | Shipping (Android) / Preview (others) | First public release |

See Versioning & Support for the full support matrix.
`

