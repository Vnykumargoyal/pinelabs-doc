# iOS / iPadOS — setup

> **v1 status: Preview.** The Swift binding ships in a Phase 7
> milestone alongside Cloud REST and PADController support. The
> public surface is locked and matches the UDL; this page documents
> what shipping looks like and how you'll integrate.

The Pine Labs SDK for iOS ships as an `.xcframework` containing the
Rust core, the UniFFI-generated Swift wrapper, and an umbrella
header. Distribution is via the **Pinelabs Developer Portal** — the
SDK is **not** published to CocoaPods.org or the Swift Package
Index.

> **App-to-App is Android-only.** On iOS your transport choices are
> **Cloud REST** and **PADController** (Bluetooth-paired terminals).

---

## Prerequisites

| | Minimum | Tested |
|---|---|---|
| Xcode | 15 | 16 |
| Swift | 5.9 | latest |
| iOS / iPadOS deployment target | 14.0 | latest |
| Architectures shipped | `arm64`, `arm64-simulator`, `x86_64-simulator` | — |

---

## 1. Download and verify the xcframework

1. Download `PineBillingSdk-<semver>.xcframework.zip` from the
   Pinelabs Developer Portal.
2. The zip contains:
   * `PineBillingSdk.xcframework/` — the binary.
   * `PineBillingSdk.xcframework.zip.sha256` — checksum.
   * `PineBillingSdk.xcframework.zip.sig` — detached signature.
   * `docs/site/index.html` — these docs.
   * `README.md`, `CHANGELOG.md`.
3. Verify the checksum:
   ```bash
   shasum -a 256 -c PineBillingSdk-<semver>.xcframework.zip.sha256
   ```

---

## 2. Add the framework to Xcode

### Manual integration

1. Drag `PineBillingSdk.xcframework` into your Xcode project. When
   prompted, **Copy items if needed**, and add to the targets that
   need it.
2. In your target's **General** tab, find **Frameworks, Libraries,
   and Embedded Content** and set `PineBillingSdk.xcframework` to
   **Embed & Sign**.
3. In **Build Settings** → **Other Linker Flags**, add `-ObjC` if
   you do not already have it.
4. Add the `Network` capability to your app's entitlements only if
   you do not already have outbound HTTPS allowed (most apps do).

### Swift Package Manager (binary target)

The Pinelabs Developer Portal also publishes a `Package.swift`
manifest you can vendor into your repo and reference as a local
package. **There is no public Swift Package registry URL** — the
manifest's `binaryTarget` points at the file you downloaded.

```swift
// Package.swift in a vendored copy
let package = Package(
    name: "PineBillingSdk",
    products: [
        .library(name: "PineBillingSdk", targets: ["PineBillingSdk"]),
    ],
    targets: [
        .binaryTarget(
            name: "PineBillingSdk",
            path: "PineBillingSdk.xcframework"
        ),
    ]
)
```

---

## 3. Permissions / Info.plist

| Transport | `Info.plist` keys |
|---|---|
| Cloud REST | none beyond your existing app's HTTPS allow-list. |
| PADController (BT) | `NSBluetoothAlwaysUsageDescription` — describe why your app needs Bluetooth. |

There is no equivalent of the Android `<queries>` block — iOS does
not federate apps via `Messenger`-style IPC.

---

## 4. Verify the install

```swift
import PineBillingSdk

let sdk = try PineBillingSdk(
    config: SdkConfig(
        defaultTimeoutMs: 60_000,
        logLevel: .info,
        transport: .cloud,
        appToApp: nil,
        applicationId: nil,
        cloudBaseUrl: "https://uat.pinelabs.example",
        cloudConnectTimeoutMs: 30_000,
        cloudReadTimeoutMs: 60_000
    ),
    appToAppBridge: nil
)

print("SDK constructed; isConnected = \(sdk.isConnected())")
```

A successful construction confirms the framework is correctly
linked. The actual transactional flow is in
[`quickstart.md`](./quickstart.md).

---

## 5. Troubleshooting

| Symptom | Cause |
|---|---|
| `dyld: Library not loaded: PineBillingSdk.framework/PineBillingSdk` | The xcframework is not set to **Embed & Sign**. |
| `code signature invalid` on TestFlight upload | Your team did not sign the embedded `.xcframework`. Set its sign mode to **Sign on Copy**. |
| Simulator builds fail with "missing required arch x86_64" | You are on an Intel Mac and the xcframework only contains arm64-simulator. Pinelabs ships both; re-download or check your Xcode is using the correct slice. |

---

## Next

* [Quickstart →](./quickstart.md)
* [Examples →](./examples/) — `do-transaction.swift`,
  `test-print.swift`, `error-handling.swift`, `listener.swift`.
* [Concepts →](../../concepts/) — language-neutral reference.

---

# iOS — quickstart (Cloud REST)

> **v1 status: Preview.** The Swift binding ships in a Phase 7
> milestone. This page is the locked design.

A five-minute path to a Sale via the **Cloud REST** transport on
iOS. (App-to-App is Android-only; for PADController on iOS see the
PADController quickstart in the same milestone.)

---

## 1. Construct the SDK once

```swift
// AppDependencies.swift
import PineBillingSdk

enum AppDependencies {
    static let sdk: PineBillingSdk = {
        do {
            return try PineBillingSdk(
                config: SdkConfig(
                    defaultTimeoutMs: 60_000,
                    logLevel: .info,
                    transport: .cloud,
                    appToApp: nil,
                    applicationId: nil,
                    cloudBaseUrl: "https://uat.pinelabs.example",
                    cloudConnectTimeoutMs: 30_000,
                    cloudReadTimeoutMs: 60_000
                ),
                appToAppBridge: nil
            )
        } catch {
            fatalError("SDK construction failed: \(error)")
        }
    }()
}
```

Construct once at app launch (e.g. in `AppDelegate` or a SwiftUI
`@main` `App`'s `init`) and reference `AppDependencies.sdk`
everywhere.

---

## 2. Build the request

```swift
import PineBillingSdk

func saleRequest(orderId: String, amountPaise: UInt64) -> TransactionRequest {
    TransactionRequest(
        amount: amountPaise,
        currency: "INR",
        billingRefNo: orderId,
        invoiceNo: orderId,
        transactionType: .sale,
        originalEventId: nil,
        referenceId: nil,
        metadata: nil,
        merchantId: "MID-001",      // required for Cloud
        terminalId: "TID-A",        // required for Cloud
        allowedPaymentModes: nil,   // ignored on Cloud in v1
        transportOptions: .cloud(CloudTransactionOptions(
            transactionNumber: orderId,             // required idempotency key
            sequenceNumber:    "1",                 // required
            allowedPaymentMode: "10",               // common observed value
            autoCancelDurationInMinutes: nil,
            forceCancelOnBack: nil,
            merchantStorePosCode: "POS-1"
        ))
    )
}
```

Cloud requires `transportOptions: .cloud(...)` with a non-nil
`transactionNumber` and `sequenceNumber`. Omitting either raises
`SdkError.invalidInput` synchronously.

---

## 3. Submit and listen

`do_transaction` is a blocking call from your worker thread; the
result is delivered via a callback object.

```swift
import Foundation
import PineBillingSdk

final class TxnRunner {
    private let sdk: PineBillingSdk
    private let queue = DispatchQueue(label: "com.example.pos.sdk", qos: .userInitiated)

    init(sdk: PineBillingSdk) { self.sdk = sdk }

    func charge(orderId: String, amountPaise: UInt64,
                onApproved: @escaping (TransactionResult) -> Void,
                onDeclined: @escaping (Error) -> Void) {
        queue.async {
            do {
                try self.sdk.doTransaction(
                    request: saleRequest(orderId: orderId, amountPaise: amountPaise),
                    listener: ListenerImpl(orderId: orderId,
                                           onApproved: onApproved,
                                           onDeclined: onDeclined)
                )
            } catch {
                DispatchQueue.main.async { onDeclined(error) }
            }
        }
    }
}

private final class ListenerImpl: TransactionListener {
    let orderId: String
    let onApproved: (TransactionResult) -> Void
    let onDeclined: (Error) -> Void

    init(orderId: String,
         onApproved: @escaping (TransactionResult) -> Void,
         onDeclined: @escaping (Error) -> Void) {
        self.orderId = orderId
        self.onApproved = onApproved
        self.onDeclined = onDeclined
    }

    func onStarted(eventId: String) {
        // Persist (orderId, eventId) BEFORE updating the UI.
        OpStore.shared.started(orderId: orderId, eventId: eventId)
    }

    func onSuccess(result: TransactionResult) {
        OpStore.shared.completed(orderId: orderId, result: result)
        DispatchQueue.main.async { self.onApproved(result) }
    }

    func onFailure(error: SdkError) {
        OpStore.shared.failed(orderId: orderId, error: error)
        DispatchQueue.main.async { self.onDeclined(error) }
    }
}
```

> **Cloud `doTransaction` returns `Pending`.** On success the
> listener fires `onSuccess` with `result.status = .pending` and
> `result.transactionId = <PlutusTransactionReferenceID>`. The
> merchant drives the rest of the lifecycle via
> `checkStatus(eventId:options:)` until the state moves to
> `Completed` or `Failed`.

---

## 4. Threading

* **Listener-based methods** — `doTransaction`, `testPrint`,
  `discoverTerminals` — return immediately after synchronous
  validation. Safe to call from any thread.
* **Blocking methods** — `cancel`, `checkStatus`, `connect`,
  `disconnect`, `ping`, `runSelfTest`, `getLogs`,
  `getTerminalInfo`, `setTransport` — perform I/O inline. **Call
  from a worker thread**, never from `DispatchQueue.main`. The SDK
  does not detect the main thread automatically on iOS.
* Callbacks fire on an SDK-internal thread; marshal to
  `DispatchQueue.main` before touching UIKit / SwiftUI state.

For the full lifecycle and threading contract, see
[`docs/concepts/lifecycle.md`](../../concepts/lifecycle.md).

---

## 5. Reconciliation

After your app crashes or is force-quit between
`onStarted` and the terminal-state callback, recover via
`checkStatus(transactionId, options: .cloud(CloudCheckStatusOptions(merchantStorePosCode: "POS-1")))`.

Cloud is the only v1 iOS transport that lets you recover the truth
from the SDK alone — see
[`docs/concepts/eventid-and-reconciliation.md`](../../concepts/eventid-and-reconciliation.md).

---

## Next

* [`examples/do-transaction.swift`](./examples/do-transaction.swift)
* [`examples/test-print.swift`](./examples/test-print.swift)
* [`examples/error-handling.swift`](./examples/error-handling.swift)
* [`examples/listener.swift`](./examples/listener.swift)
