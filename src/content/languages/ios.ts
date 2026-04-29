export const iosSetup = `
# iOS — Setup

> **v1 status: Preview.** Full release in Phase 7.

Pine Labs SDK for iOS is distributed as a **Swift Package** (SPM).
It has zero transitive dependencies.

---

## Prerequisites

| Requirement | Minimum |
|---|---|
| Xcode | 15 |
| iOS deployment target | 15.0 |
| Swift | 5.9 |

---

## Step 1 — Add the Swift Package

In Xcode: **File > Add Package Dependencies...**

Enter the repository URL:

\`\`\`text
https://github.com/pinelabs/billing-sdk-ios
\`\`\`

Select version **1.0.0** and add to your app target.

---

## Step 2 — Info.plist (BLE transport)

If you use the BLE transport, add to \`Info.plist\`:

\`\`\`xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>Used to communicate with the Pine Labs payment terminal.</string>
\`\`\`

---

## Step 3 — Verify

\`\`\`swift
import PineBillingSDK

let sdk = PineBillingSdk(transport: .ble(peripheralId: UUID()))
print("SDK version: " + sdk.version)
// Output: SDK version: 1.0.0
\`\`\`
`

export const iosQuickstart = `
# iOS — Quickstart

> **v1 status: Preview.** Full release in Phase 7.

---

## 1. Create the SDK

\`\`\`swift
import PineBillingSDK

let sdk = PineBillingSdk(transport: .ble(peripheralId: terminalUUID))
\`\`\`

---

## 2. Build a request

\`\`\`swift
let request = TransactionRequest(
    type:   .sale,
    amount: 50000   // Rs.500.00 in paise
)
\`\`\`

---

## 3. Run the transaction

\`\`\`swift
sdk.doTransaction(request: request) { event in
    switch event {
    case .started(let eventId):
        self.persist(eventId: eventId)

    case .success(let result):
        DispatchQueue.main.async {
            self.showReceipt(result)
        }

    case .failure(let error):
        DispatchQueue.main.async {
            self.showError(error)
        }
    }
}
\`\`\`
`

export const iosDoTransaction = `
/*
 * Pine Labs SDK — iOS example: doTransaction (Sale via BLE)
 * v1 status: Preview. Ships in Phase 7.
 */

import Foundation
import PineBillingSDK

class CheckoutViewModel: ObservableObject {

    @Published var status: String = "Ready"
    @Published var approvalCode: String = ""

    private let sdk: PineBillingSdk

    init(terminalUUID: UUID) {
        sdk = PineBillingSdk(transport: .ble(peripheralId: terminalUUID))
    }

    func charge(amountPaise: Int) {
        let request = TransactionRequest(type: .sale, amount: amountPaise)

        sdk.doTransaction(request: request) { [weak self] event in
            guard let self = self else { return }

            switch event {
            case .started(let eventId):
                PersistenceStore.shared.save(eventId: eventId, status: "PENDING")

            case .success(let result):
                PersistenceStore.shared.update(eventId: result.eventId, status: "SUCCESS")
                DispatchQueue.main.async {
                    self.approvalCode = result.approvalCode
                    self.status = "Approved"
                }

            case .failure(let error):
                DispatchQueue.main.async {
                    self.status = "Failed: " + error.message
                }
            }
        }
    }
}
`

export const iosTestPrint = `
/*
 * Pine Labs SDK — iOS: testPrint example
 * v1 status: Preview.
 */

import PineBillingSDK

func runTestPrint(sdk: PineBillingSdk) {
    let lines = [
        "================================",
        "     PINE LABS PRINTER TEST     ",
        "================================",
        "BLE transport test",
        "================================"
    ]

    sdk.testPrint(lines: lines) { result in
        switch result {
        case .success:
            print("Print OK")
        case .failure(let error):
            print("Print failed: " + error.message)
        }
    }
}
`

export const iosErrorHandling = `
/*
 * Pine Labs SDK — iOS error handling example
 * v1 status: Preview.
 */

import PineBillingSDK

func handleTransactionEvent(_ event: TransactionEvent) {
    switch event {
    case .started(let eventId):
        print("Started: " + eventId)

    case .success(let result):
        print("Success: " + result.approvalCode)

    case .failure(let error):
        switch error.code {
        case .declined:
            print("Card declined — ask customer for another card")
        case .transportTimeout where error.retryable:
            print("Timeout — will retry")
        case .permissionDenied:
            print("BLE permission missing — request permission")
        default:
            print("Error: " + error.message)
        }
    }
}
`

export const iosListener = `
/*
 * Pine Labs SDK — iOS: reusable logging listener closure
 * v1 status: Preview.
 */

import Foundation
import PineBillingSDK

func makeLoggingHandler(label: String) -> (TransactionEvent) -> Void {
    return { event in
        switch event {
        case .started(let eventId):
            print("[" + label + "] started eventId=" + eventId)
        case .success(let result):
            print("[" + label + "] success approval=" + result.approvalCode + " rrn=" + result.rrn)
        case .failure(let error):
            print("[" + label + "] failure code=" + String(describing: error.code))
        }
    }
}
`

