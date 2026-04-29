# `TransactionResult` payload

`TransactionResult` is the curated, normalised view of a successful
terminal-state transaction. This page documents every field, when
it is populated, and how to use the most-frequently-misunderstood
one — `chargeSlipPrintData`.

For the request side, see the per-language quickstart pages and the
UDL (`crates/pine-billing-ffi/src/pine_billing.udl`).

---

## Field reference

| Field | Type | When populated | Notes |
|---|---|---|---|
| `eventId` | `String` | Always | The same UUIDv4 the SDK delivered on `onStarted`. For the Cloud `Pending` callback, this is still the SDK event id; the cloud reference is in `transactionId`. |
| `status` | `TransactionStatus` | Always | `Success`, `Failed`, or **`Pending`** (Cloud `do_transaction` only — see [delta D23(g)](../development_requirements.md)). |
| `billingRefNo` | `String?` | When the request supplied it (always, since `billingRefNo` is required) | Echo of `TransactionRequest.billingRefNo`; pair results to requests without a side map. |
| `referenceId` | `String?` | When the request supplied one | Echo of `TransactionRequest.referenceId`. |
| `transactionId` | `String?` | App-to-App: terminal `PlutusTransactionLogID`. Cloud: `PlutusTransactionReferenceID`. PADController: terminal-assigned id. | Use this as the immutable terminal-side identifier in your reports. |
| `rrn` | `String?` | When the acquirer returned one | Retrieval Reference Number — the acquirer's id for the card transaction. |
| `authCode` | `String?` | On approved card transactions | The acquirer's authorisation code. |
| `amount` | `String?` | When the terminal echoes it | String, not numeric — formatting varies by terminal. Compare to your request `amount` only after parsing. |
| `maskedPan` | `String?` | Card transactions | E.g. `411111XXXXXX1111`. Never the full PAN. |
| `cardHolderName` | `String?` | When the card carried one and the terminal returned it | May be padded with whitespace by older terminals; the SDK trims. |
| `cardType` | `String?` | When the terminal classifies the card | E.g. `VISA`, `MASTERCARD`, `RUPAY`. Free-form; do not parse for business logic. |
| `acquirer` | `String?` | When the terminal returned it | Bank or scheme acquirer code. |
| `merchantId` | `String?` | App-to-App: terminal-derived. Cloud / PADController: echoed from request when set. | Use this to cross-reference back-office records. |
| `terminalId` | `String?` | App-to-App: terminal-derived. Cloud / PADController: echoed from request when set. | |
| `invoiceNo` | `String?` | When the terminal echoes it | App-to-App returns it as a numeric string (`"42"`). |
| `batchNo` | `String?` | When the terminal returned it | The acquirer's batch number for end-of-day settlement. |
| `date` | `String?` | When the terminal returned one | Format varies by terminal (commonly `YYYYMMDD`). |
| `time` | `String?` | When the terminal returned one | Format varies (commonly `HHmmss`, 24-hour). |
| `chargeSlipPrintData` | `String?` | App-to-App: terminal `PlutusVersion`. Cloud: not populated. PADController: vendor slip body. | See the dedicated section below. |
| `responseCode` | `String?` | Always on success path (App-to-App: `"0"`) | Raw acquirer / terminal response code. |
| `responseMessage` | `String?` | Always on success path | Raw acquirer / terminal message (e.g. `"APPROVED"`). |
| `metadata` | `Map<String,String>?` | When the transport carried extras | See "Metadata keys" below. |

---

## `chargeSlipPrintData` — what it actually is

The name is historical. The field carries different content on
different transports; treat it as a **transport-specific opaque
string** and never parse it generically.

| Transport | Content |
|---|---|
| App-to-App | The Pinelabs `PlutusVersion` returned by MasterApp (e.g. `"1.2.3"`). The terminal itself prints the slip; the SDK does not return slip text. |
| PADController | A vendor slip body that you can hand to a printer driver, if your integration includes one. Format is terminal-model-dependent. |
| Cloud | Not populated (the cloud transport has no slip-printing semantics). |
| TCP | Defined by the future TCP adapter. |

If you need to print a **separate** copy of the slip from your
own POS, do not assume `chargeSlipPrintData` is renderable text.
The terminal's printer is the canonical slip surface.

---

## Metadata keys

`TransactionResult.metadata` collects extras the SDK could not
promote to a typed field. Keys follow a `<scope>.<name>` namespacing
convention so future additions don't collide.

### App-to-App: NCMC fields

When the cardholder uses an NCMC (National Common Mobility Card),
the terminal returns transit-specific fields. The SDK projects
them under the `ncmc.` prefix:

| Key | Source field | Notes |
|---|---|---|
| `ncmc.serviceID` | `Detail.serviceID` | Issuer-assigned service id. |
| `ncmc.serviceMI` | `Detail.serviceMI` | NCMC merchant identifier. |
| `ncmc.isTransitMode` | `Detail.isTransitMode` | `"true"` / `"false"` (boolean rendered as a string for stable cross-language semantics). |
| `ncmc.paymentMode` | `Detail.paymentMode` | NCMC payment-mode code (free-form pass-through). |
| `ncmc.serviceData` | `Detail.serviceData` | Free-form NCMC service payload. |
| `ncmc.AppId` | `Detail.AppId` | NCMC application id. |

### Cloud: raw `TransactionData`

When the cloud server returns its `TransactionData` object on a
status response, every leaf field is flattened under
`cloud.transactionData.*` (delta D23(j)). Null on `status =
Pending`. Keys are stable across releases.

### PADController: stabilising

PADController returns CSV columns, most of which are promoted to
typed fields. Until the column set is locked, any unrecognised
column is preserved verbatim under `pad.<columnName>` to avoid
data loss for early adopters.

---

## Reading the result

Pattern (Kotlin):

```kotlin
override fun onSuccess(result: TransactionResult) {
    val printable = buildString {
        appendLine("Status: ${result.status}")
        appendLine("Order: ${result.billingRefNo}")
        result.transactionId?.let { appendLine("Txn id: $it") }
        result.rrn?.let { appendLine("RRN: $it") }
        result.authCode?.let { appendLine("Auth: $it") }
        result.maskedPan?.let { appendLine("Card: $it (${result.cardType ?: "—"})") }
        appendLine("Amount: ${result.amount ?: "?"}")
        appendLine("Merchant ${result.merchantId} / Terminal ${result.terminalId}")
    }
    db.markOpCompleted(result.eventId, transactionId = result.transactionId, body = printable)
    ui.post { renderReceipt(printable) }
}
```

For NCMC integrations, look in the metadata:

```kotlin
val isTransit = result.metadata?.get("ncmc.isTransitMode") == "true"
```

---

## Forward compatibility

* New typed fields **may** be added to `TransactionResult` as
  Pinelabs ops publishes new terminal capabilities; we will not
  remove existing typed fields without a major version bump.
* New `metadata` keys **may** be added at any time. Existing keys
  will not change semantics or be removed without a major version
  bump.
* `status` will not gain new variants in the v1 line; if Pinelabs
  introduces a new lifecycle state, it ships in v2.
