# Transports

A **transport** is the channel between the SDK (running inside your
app) and the Pinelabs payment terminal. v1 ships four transports;
each has very different prerequisites, latency characteristics, and
capability footprints.

```text
┌────────────────────┐     ┌───────────────────┐
│ Your app + SDK     │     │ Pinelabs terminal │
└──────────┬─────────┘     └─────────┬─────────┘
           │                         │
           │  one of …               │
           │                         │
   ┌───────┴────┐  ┌──────────┐  ┌───┴─────────┐  ┌───────────────┐
   │ App-to-App │  │ Cloud    │  │ PADController│  │ TCP direct    │
   │ (Android   │  │ REST     │  │ (BT/USB/Ser) │  │ (LAN; v1     │
   │  IPC)      │  │ (HTTPS)  │  │              │  │  placeholder) │
   └────────────┘  └──────────┘  └─────────────┘  └───────────────┘
```

This page is a decision guide. The
[capability matrix](./capabilities.md) is the formal reference.

---

## At a glance

| Transport | Where the terminal is | OS prereq | Latency | v1 status |
|---|---|---|---|---|
| **App-to-App** | Same Android device, running MasterApp | Android 5.0+ (API 21) | ~100–300 ms IPC + cardholder time | Shipping |
| **Cloud REST** | Anywhere reachable from Pinelabs cloud | Any platform with HTTPS egress | ~500 ms upload + cardholder time + poll | Shipping (Phase 7a) |
| **PADController** | Same host as your app, via BT / USB / Serial | Linux / Android / Windows / macOS (varies by adapter) | ~50–200 ms link + cardholder time | Shipping (Phase 7c) |
| **TCP direct** | LAN-reachable terminal | Any platform with TCP egress to LAN | TBD | **Placeholder** — `NotSupported` until 7.x |

---

## App-to-App

**Use when:** your app runs on a Pinelabs all-in-one Android device
(or an Android terminal where MasterApp is the system-side payment
host).

**How it works:** the SDK binds to the MasterApp `Messenger` service
(`com.pinelabs.masterapp.SERVER`), sends a JSON envelope as a
`Bundle`, awaits a single reply, and unbinds. You see this as a
typed `TransactionResult`; you never see the JSON, the bundle, or
the IPC.

**Prerequisites — Android side:**

* **MasterApp** installed on the device (Pinelabs ships it on every
  in-store terminal). If absent, calls fail with
  `SdkError.TransportUnavailable` and the detail mentions
  "MasterApp not installed".
* Your app's `AndroidManifest.xml` declares the package query so
  Android 11+ doesn't filter it out:
  ```xml
  <queries>
      <package android:name="com.pinelabs.masterapp" />
  </queries>
  ```
* `SdkConfig.applicationId` is set to the **Pinelabs-provisioned
  identifier** for your installing package. (The MasterService
  validates it server-side for `MethodId="1001"` Sale; it bypasses
  validation for `MethodId="1002"` test-print.)
* `SdkConfig.appToApp` carries `userId` and `version` — `version`
  must be `"1.0"` (the production `MASTERAPP_API_VERSION`); other
  values are rejected by the MasterService.

**Capability footprint:** see the matrix —
`doTransaction` / `testPrint` only. **No** `cancel` (the protocol
does not expose a cancel endpoint), **no** `discoverTerminals`,
**no** diagnostics. `connect` / `disconnect` are accepted as
no-ops; `isConnected()` returns `true` only while a call is in
flight.

**Threading:** the SDK binds the service per call, on a worker
thread; bind / send / await / unbind happen synchronously inside
one `doTransaction`. There is no long-lived connection.

**Wire format:** JSON, owned by the Android binding (delta D14).
The Rust core hands a typed `TransactionRequest` to the Kotlin
bridge and receives a typed `TransactionResult` back. You will
never see the JSON in your code or in your logs.

---

## Cloud REST

**Use when:** your app runs anywhere with HTTPS egress and the
terminal is anywhere reachable from the Pinelabs cloud (typical for
multi-store retail back-offices, call-center pay-by-link, headless
billing services).

**How it works:** the SDK posts an `UploadBilledTransaction` body to
the configured `cloudBaseUrl`. On `ResponseCode == 0` the listener
fires `onSuccess(TransactionResult { status = Pending,
transactionId = PlutusTransactionReferenceID, … })`. The merchant
then drives the rest of the lifecycle via `checkStatus(eventId,
CheckStatusOptions::Cloud { merchantStorePosCode })` until the
state moves to `Completed` or `Failed` (the SDK does **not**
auto-poll in v1).

**Prerequisites:**

* `SdkConfig.transport = Cloud` and `SdkConfig.cloudBaseUrl =
  "https://<env>.pinelabs.example"` (no trailing slash; one URL
  per environment, supplied by Pinelabs ops at integration time).
* `cloudConnectTimeoutMs` (default 30 s) and `cloudReadTimeoutMs`
  (default 60 s) — tune for your network.
* On every `doTransaction`, `transportOptions =
  TransportOptions::Cloud { transactionNumber, sequenceNumber, … }`.
  `transactionNumber` and `sequenceNumber` are **required** — the
  Pinelabs server uses them as part of its idempotency key.
* On every `cancel`, `cancelOptions =
  CancelOptions::Cloud { amount }`.
* On every `checkStatus`, `options =
  CheckStatusOptions::Cloud { merchantStorePosCode }`.

**Capability footprint:** full —
`doTransaction` / `cancel` / `checkStatus` / `testPrint`. No
discovery / connect (each call is its own short-lived HTTPS
request). No diagnostics.

**Threading:** every Cloud call is a synchronous blocking HTTP
exchange bounded by the configured timeouts. Bindings should call
from a worker thread or wrap in the language-idiomatic async
primitive.

**`allowedPaymentModes`:** explicitly **ignored** on Cloud in v1
(delta D23(f)) until the typed-enum-to-cloud-code mapping is
published. Pass the opaque code via
`CloudTransactionOptions.allowedPaymentMode` (commonly `"10"`).

---

## PADController

**Use when:** the terminal is physically attached to or paired with
the host machine — Bluetooth headless terminal, USB-tethered PIN
pad, RS-232 cable in a back-office.

**How it works:** the SDK frames a CSV payload with the
PADController binary header (Source ID `0x1000`, FuncCode
`0x0997` / `0x1997`, length, body, `0xFF` terminator), opens a
TCP loopback to the local PADController, sends the frame, receives
the reply, parses the CSV, returns a `TransactionResult`. Frame
limit: 2048 bytes.

**Prerequisites:**

* PADController binary running on the host as a local service.
* For Bluetooth: terminal paired at the OS level before
  `discoverTerminals()` returns it.
* For USB / Serial: device path / COM port reachable; OS-level
  drivers installed.

**Capability footprint:** the broadest in v1 —
`doTransaction` / `cancel` / `checkStatus` / `testPrint` /
`discoverTerminals` / `connect` / `disconnect` / `ping` /
`runSelfTest` / `getLogs` / `getTerminalInfo`.

**Threading:** PADController opens a one-shot TCP loopback
connection per transaction (long-lived link is not the model in
v1). `connect()` validates that PADController is reachable;
`isConnected()` reflects that liveness.

**Wire format:** CSV (positional, non-RFC) inside the framed
header. Documented internally for SDK maintainers
(`docs/wire-formats/csv.md`, `docs/wire-formats/pad-controller-frame.md`)
but **never exposed** to merchants per delta D15.

---

## TCP direct (placeholder)

**Use when:** you cannot — yet. The wire protocol is greenfield and
will be designed at implementation time. In v1, calls to
`setTransport(Tcp)` may raise `SdkError.NotSupported`.

The capability matrix lists TCP rows for forward compatibility, but
do **not** plan a v1 integration on TCP. Use App-to-App, Cloud, or
PADController.

---

## How to choose

```
                           ┌───────────────────────────┐
                           │ Where does your app run?  │
                           └───────────────┬───────────┘
                                           │
            ┌──────────────────────────────┼─────────────────────────────────┐
            │                              │                                  │
   ┌────────▼────────┐         ┌───────────▼──────────┐         ┌─────────────▼─────────────┐
   │ Pinelabs Android│         │ Server / desktop     │         │ Headless service / cloud  │
   │ all-in-one      │         │ near the terminal    │         │ no LAN to terminal        │
   └────────┬────────┘         └───────────┬──────────┘         └─────────────┬─────────────┘
            │                              │                                  │
   ┌────────▼────────┐         ┌───────────▼──────────┐         ┌─────────────▼─────────────┐
   │ App-to-App      │         │ PADController        │         │ Cloud REST                │
   │ (MasterApp IPC) │         │ (BT / USB / Serial)  │         │ (HTTPS upload + poll)     │
   └─────────────────┘         └──────────────────────┘         └───────────────────────────┘
```

You can switch transports at runtime with `setTransport(...)` — the
SDK disconnects the current transport (if any) before swapping.
Useful for environments where you want App-to-App when on a
Pinelabs device and Cloud when running the same code on a tablet.

---

## Switching transports

```kotlin
val sdk = PineBillingSdk(
    config = SdkConfig(
        defaultTimeoutMs = 60_000,
        transport = TransportType.AppToApp,
        appToApp = AppToAppConfig(userId = "POS-42", version = "1.0"),
        applicationId = "MERCHANT_PROVISIONED_ID",
        cloudBaseUrl = "https://uat.pinelabs.example",
    ),
)

// Later, on a worker thread:
sdk.setTransport(TransportType.Cloud)   // disconnect-then-swap; cloudBaseUrl already configured
sdk.doTransaction(cloudRequest, listener)
```

`setTransport` raises `SdkError.InvalidInput` if the target
transport requires config you did not supply at construction
(`AppToApp` without `appToApp`, or `Cloud` without `cloudBaseUrl`).
