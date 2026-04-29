# Pine Labs CSV Wire Format

> **Status:** Authoritative for the Pine Billing SDK CSV codec, but
> **incomplete**. Source-of-truth artefacts are the Kotlin
> `CsvParser`, `CsvIndexUtils`, `CsvTransactionType`, and the Dart
> `CsvParserUtils` / `IndexUtil` shipped inside the Pinelabs
> `Payment_App_Flutter` project (`hardware_wrapper` module). When this
> doc and those sources disagree, **the source code wins**; raise a PR
> to update this doc.
>
> This doc is referenced from `docs/development_requirements.md §6.5`
> and from `plan.md` (Phase 4.5 — CSV codec). The agent must consult
> this doc for every change to the CSV codec or any transport that
> uses it (TCP, USB, Serial, PADController).

---

## 1. Where CSV applies

> **Wire format is the per-language implementor's choice** (delta
> D14). The Rust core does not mandate JSON, CSV, or anything else —
> the Kotlin / Swift / Python / … facade team picks per transport
> based on what the upstream Pinelabs component accepts. This doc
> exists so any implementor who picks CSV has a single complete
> reference, and so the **Rust CSV codec utility library** in
> `pine-billing-adapters` (Phase 5.5) has a single spec to comply
> with.

Practical defaults observed in the working Pinelabs Android stack
(non-binding for other languages or future transports):

| Transport | Format observed | Notes |
|---|---|---|
| Android AppToApp (Messenger) | JSON (Gson) — dev_req §6 | Implementor chose JSON; CSV would also work over the same byte boundary. |
| Direct TCP to terminal | CSV, length-prefixed | Could be implemented with JSON if the upstream changes. |
| USB / Serial via PADController | CSV over TCP-loopback | Same. |
| Cloud (HTTPS) | JSON | — |

Pinelabs `BillingAppRequestHelper.getOperationType` confirms the
same length-prefixed byte stream can carry **either** JSON or CSV —
`JSONObject(str)` is attempted first; on parse failure it falls
through to the CSV path. Our SDK never multiplexes within a single
transport; per-transport the format is fixed at implementation
time.

---

## 2. Framing

- Carrier: `ByteArray` / `Vec<u8>`. Strings are decoded as **UTF-8**
  (Pinelabs Kotlin uses `String(byteArray)` with platform default,
  effectively UTF-8 on Android; we pin UTF-8 explicitly).
- Maximum length: `CsvConstant.MAX_CSV_LEN = 50000` bytes. Reject
  longer messages with `SdkError::Internal("csv payload exceeds
  MAX_CSV_LEN (50000)")` on both encode and decode.
- One CSV per message. No multi-record streams.
- Field separator: `,` (single ASCII comma).
- Record separator: none. Newlines (`\n`, `\r`) inside fields are
  stripped by the reference parser; we strip on decode and reject on
  encode.

---

## 3. Quoting & escaping (asymmetric)

The reference is **inconsistent**:

| Side | Behaviour |
|---|---|
| Encoder (`CsvParser.requestCSV` + `getValue()`) | Does **not** quote. Throws if any string field contains `,`. |
| Decoder (`CsvIndexUtils.getStringArrayFromCSV`) | **Quote-aware** regex split: `,(?=(?:[^"]*"[^"]*")*[^"]*$)`. Then strips leading/trailing `"`. |
| Decoder (`CsvParserUtils` Dart) | Naive `split(",")`. `replaceAll("\"", "")` and `replaceAll("\n", "")` per field. |

**SDK rule:** to be safe under the strictest reader, we adopt the
encoder rule: **fields MUST NOT contain `,`, `"`, or `\n`**. We
reject pre-encoding with `SdkError::InvalidInput`. We never emit
quotes around values; we emit raw bytes.

On decode, we tolerate both shapes: strip a single matched pair of
leading/trailing double-quotes per field, then trim. We never
honour an embedded escaped comma; we treat any unquoted comma as a
field separator (matching the Dart decoder, which is the lossier of
the two and the one most likely to be on the other side).

---

## 4. Sub-encodings inside fields

| Sub-format | Used in (response idx unless noted) | Shape |
|---|---|---|
| **Pipe list** | 27 (rewards/discount), 48 (originalBillingDetails), request idx 22 (transitData) | `a\|b\|c\|d` — positional |
| **Colon KV** (inside pipe items) | request idx 22 (transitData NCMC items) | `key:value` per pipe-segment |
| **Charge-slip KV** | response idx 26 | Bespoke key-value dump (`CARD_TYPE`, `TID`, `MID`, `RRN`, `APPR_CODE`, `CUSTOMER_NAME`); inter-pair delimiter **TBD — confirm from `CsvChargeSlipParsingData`** |
| **Compact date** | response idx 31 | `ddmmyyyy` (8 chars, no separators) |
| **Compact time** | response idx 32 | `HHmmss` (6 chars, no separators) |

Each sub-format gets its own codec module under
`pine-billing-adapters/src/transport/csv/subcodecs/`.

---

## 5. Request CSV — index map

Source: `Payment_App_Flutter/hardware_wrapper/.../CsvIndexUtils.kt`.

> Field count: minimum 15 (idx 0..14 always present). Maximum
> currently observed: 33 (through `gstBreakup` at idx 32). Fields
> 15..21 and 23..29 are **reserved/default** — emitted as empty
> bare slots (`,,`); we ignore on decode, never emit values.

| Idx | Field | Type / encoding | Source on encode |
|----:|---|---|---|
| 0 | `transactionType` | numeric long, decimal string | from `TransactionType` enum mapping (§7) |
| 1 | `referenceId` | string (≤?, no `,`) | merchant `billing_ref_no` |
| 2 | `amount` | numeric, paise | merchant `amount` |
| 3 | `bankId` | string | terminal-owned; SDK leaves empty |
| 4 | `track1` | string (binary) | terminal-owned |
| 5 | `track2` | string (binary) | terminal-owned |
| 6 | `invoiceNumber` | string | merchant `invoice_no` |
| 7 | `swipeTransaction` | flag string | terminal-owned |
| 8 | `terminalId` | string | merchant `terminal_id` (optional) |
| 9 | `operator` | string | merchant `operator_id` *(NEW field, see §8)* |
| 10 | `printDump` | string | terminal-owned |
| 11 | `batchId` | numeric | terminal-owned |
| 12 | `roc` | numeric | terminal-owned |
| 13 | `txnLogId` | string | terminal-owned |
| 14 | `additionalAmount` | numeric, paise | merchant `additional_amount` *(NEW, tip/cashback)* |
| 15..21 | reserved | empty | always empty |
| 22 | `transitData` | pipe-list of colon-KV | NCMC; SDK only when `transaction_type` is NCMC variant |
| 23..29 | reserved | empty | always empty |
| 30 | `invoiceDate` | string | merchant `invoice_date` *(NEW, only set for UPI-QR-online)* |
| 31 | `gstNumber` | string | merchant `gst_number` *(NEW)* |
| 32 | `gstBreakup` | string | merchant `gst_breakup` *(NEW)* |

> **Forward-compat policy.** On decode, accept any field count ≥ 15;
> ignore unknown trailing indexes. On encode, emit exactly 33 slots
> (0..32) regardless of which optionals are populated; missing slots
> are bare empties.

---

## 6. Response CSV — index map

Source: Dart `IndexUtil` (52 fields, idx 0..51) + `CsvParserUtils`.

> **Cross-reference to AppToApp JSON.** The production
> [`MasterService`](https://github.com/PineLabs-Offline/MasterService)
> `bean/request/DoTransactionBean.kt::getCSV(csv)` parses the same
> Pinelabs CSV using Pascal-cased JSON keys. The columns line up
> 1:1 with the indexes below; only the spelling differs. A few
> notable aliases (Dart name → MasterApp JSON key, by index): `authCode`
> → `ApprovalCode` (1); `transactionResponse` → `HostResponse` (2);
> `cardholderName` → `CardholderName` (5); `acquirerName` →
> `AcquiringBankCode` (12); `merchantId` → `MerchantId` (13);
> `plutusVersion` → `PlutusVersion` (20); `chargeSlipPrintData` →
> `Field0` (26); `settlementSummary` → `Field4` (30); `transactionId`
> → `PlutusTransactionLogID` (33, **String** in JSON, not `Long`);
> `transactionAmount` → `AuthAmoutPaise` (34, **String** in JSON, paise);
> `transactionType` → `TransactionType` (35, numeric long);
> `cardEntryMode` (15) ↔ `CardEntryMode`; `schemeName` (49) ↔
> `Cardtypevariant`. The full mapping is encoded in the AppToApp
> response parser (`docs/development_requirements.md` §6.4).

| Idx | Field | Maps to `TransactionResult` field |
|----:|---|---|
| 0 | `billingRefId` | `billing_ref_no` (echoed) |
| 1 | `authCode` | `auth_code` |
| 2 | `transactionResponse` | `terminal_response_code` |
| 3 | `cardMaskedPan` | `card_number_masked` (also `customer_vpa` for UPI) |
| 4 | `expiryDate` | `card_expiry` |
| 5 | `cardholderName` | `cardholder_name` |
| 6 | `hostType` | `host_type` |
| 7 | `edcROC` | `invoice_number` *(see note)* |
| 8 | `edcBatchId` | `edc_batch_id` |
| 9 | `terminalId` | `terminal_id` |
| 10 | `loyaltyPointsReward` | `loyalty_points` |
| 11 | `remark` | `remark` |
| 12 | `acquirerName` | `acquirer` |
| 13 | `merchantId` | `merchant_id` |
| 14 | `rrn` | `rrn` |
| 15 | `cardEntryMode` | `entry_mode` |
| 16 | `printCardholderNameOnReceipt` | flag, internal |
| 17 | `merchantName` | `merchant_name` |
| 18 | `merchantAddress` | `merchant_address` |
| 19 | `merchantCity` | `merchant_city` |
| 20 | `plutusVersion` | metadata |
| 21 | `acquirerCode` | `acquirer_code` |
| 22 | `emiTenure` | `emi.tenure` |
| 23 | `emiProcessingFee` | `emi.processing_fee` |
| 24 | `rewardBalanceAmount` | metadata |
| 25 | `emiInterestRate` | `emi.interest_rate` |
| 26 | `chargeSlipPrintData` | sub-decoded; injects TID/MID/RRN/APPR_CODE/CUSTOMER_NAME if missing elsewhere; raw kept in `charge_slip_print_data` |
| 27 | `rewardsPointOrDiscount` | pipe sub-decoded |
| 28 | `amountProcessed` | (see Dart — currently disabled) |
| 29 | `rfu3` | reserved |
| 30 | `settlementSummary` | `settlement_summary` |
| 31 | `dateOfTransaction` | `txn_date` (`ddmmyyyy`) |
| 32 | `timeOfTransaction` | `txn_time` (`HHmmss`) |
| 33 | `transactionId` | `transaction_id` |
| 34 | `transactionAmount` | `amount` (after rewards/discount adjustment) |
| 35 | `transactionType` | numeric long → `TransactionType` enum |
| 36 | `reservedField` | `card_mode` |
| 37 | `emiProductCategory` | `emi.product_category` |
| 38 | `emiProductName` | `emi.product_name` |
| 39 | `emiProductDescription` | `emi.product_description` |
| 40 | `imei` | `product_serial` |
| 41 | `maskedMobileNumber` | `mobile_number_masked` |
| 42 | `emiOriginalTxnAmount` | `emi.original_amount` |
| 43 | `issuerName` | `card_issuer` |
| 44 | `emiPrincipleAmount` | `emi.loan_amount` |
| 45 | `emiAmount` | `emi.emi_amount` |
| 46 | `emiTotalAmount` | `emi.total_amount` |
| 47 | `email` | `email` |
| 48 | `originalBillingDetails` | pipe sub-decoded → `original_billing_ref_no`, `original_edc_batch_id`, `original_edc_roc` |
| 49 | `schemeName` | `card_type` |
| 50 | `transactionStatus` | numeric → `TransactionStatus` enum (mapping TBD) |
| 51 | `paymentUrlLink` | `payment_url` |

> **Note on idx 7.** Dart code stores `edcROC` into both
> `invoiceNumber` and `edcROC`. Our `TransactionResult` keeps them
> separate; we set both from this index.

---

## 7. Transaction-type code map

Source: `CsvTransactionType.kt`.

| Pinelabs constant | Code | Our `TransactionType` variant |
|---|---:|---|
| `TXN_SALE` | 4001 | `SALE` |
| `TXN_REFUND` | 4002 | `REFUND` |
| `TXN_ADJUST` | 4005 | *(no SDK variant — terminal-owned tip adjust)* |
| `TXN_VOID` | 4006 | `VOID` |
| `TXN_PRE_AUTH` | 4007 | `PRE_AUTH` |
| `TXN_POST_AUTH` | 4008 | `CAPTURE` |
| `TXN_CSV_COMMON_REFUND` | 4010 | *(internal)* |
| `TXN_TIP_ADJUST` | 4015 | *(no SDK variant; future)* |
| `TXN_CSV_SALE` | 4097 | *(internal alt-Sale)* |
| `TXN_SALE_SWITCH` | 4098 | *(internal)* |
| `NCMC_LOAD_MONEY_TXN` | 4119 | *(future NCMC)* |
| `NCMC_BALANCE_ENQUIRY_TXN` | 4121 | `BALANCE_INQUIRY` (NCMC card) |
| `CSVNCMC_SERVICE_CREATION_TXN` | 4122 | *(future)* |
| `NCMC_UPDATE_BALANCE_TXN` | 4120 | *(future)* |
| `NCMC_SERVICE_CREATION_TXN` | 4128 | *(future)* |
| `TXN_PVR_INOX` | 4131 | *(merchant-specific)* |
| `TXN_LOY_MINE_REDEMPTION` | 4201 | *(future loyalty)* |
| `TXN_P360_GV_ACTIVATION` | 4202 | *(future)* |
| `TXN_P360_GV_REDEMPTION` | 4203 | *(future)* |
| `TXN_P360_GV_BALANCEENQUIRY` | 4204 | *(future)* |
| `TXN_P360_LOYALTY_AWARD` | 4208 | *(future)* |
| `TXN_P360_LOYALTY_REDEMPTION` | 4209 | *(future)* |
| `TXN_P360_LOYALTY_BALANCEENQUIRY` | 4210 | *(future)* |
| `TXN_P360_GC_LOAD` | 4211 | *(future)* |
| `TXN_P360_GC_REDEEM` | 4212 | *(future)* |
| `TXN_P360_GC_BALANCEENQUIRY` | 4213 | *(future)* |
| `TXN_MWALLET_REDEMPTION` | 4214 | *(future)* |
| `TXN_P360_VOUCHER_REDEEEM` | 4215 | *(future)* |
| `TXN_PRINT_RECEIPT` | 4216 | *(future — `testPrint`/receipt reprint)* |
| `TXN_SHOPPERS_STOP_LOYALTY` | 4301 | *(merchant-specific)* |
| `TXN_PAYBACK_AWARD` | 4401 | *(future)* |
| `TXN_PAYBACK_REDEEM` | 4402 | *(future)* |
| `TXN_PAYBACK_VOID` | 4403 | *(future)* |
| `TXN_SALE_WITH_CASH` | 4502 | *(future — Cash@POS)* |
| `TXN_CASH_ONLY` | 4503 | *(future — Cash@POS)* |
| `AIRPORT_LOUNGE` | 4701 | *(merchant-specific)* |
| `TXN_PROMO_REDEMPTION_IN_INTEGRATON_MODE` | 4801 | *(future)* |
| `TXN_COUPON_CODE_SALE` | 5001 | *(future)* |
| `INTTEGRATION_MODE_TXN_TYPE_PHONEPE_ONLINE` | 5102 | *(future digital)* |
| `INTTEGRATION_MODE_TXN_TYPE_UPI_QR_ONLINE` | 5120 | *(future digital — UPI QR)* |
| `UPI_REFUND` | 5121 | *(future)* |
| `UPI_GET_STATUS` | 5122 | (mapped to `checkStatus` for digital) |
| `INTTEGRATION_MODE_TXN_TYPE_BHARAT_QR_ONLINE` | 5123 | *(future)* |
| `INTTEGRATION_MODE_TXN_TYPE_PAYPAL_ONLINE` | 5128 | *(future)* |
| `INTEGRATION_MODE_ICICI_UPI` | 5132 | *(future)* |
| `M_AADHAAR_TXN` | 5144 | *(future)* |
| `INTTEGRATION_MODE_TXN_TYPE_UPI_QR_OFFLINE` | 5551 | *(future)* |
| `INTTEGRATION_MODE_TXN_TYPE_BHARAT_QR_OFFLINE` | 5552 | *(future)* |
| `INTTEGRATION_MODE_TXN_TYPE_PHONEPE_OFFLINE` | 5553 | *(future)* |
| `INTTEGRATION_MODE_TXN_TYPE_PAYPAL_OFFLINE` | 5554 | *(future)* |
| `TXN_SETTLEMENT_REQ` | 6001 | *(future — merchant settlement)* |
| `SET_CONNECTION_REQUEST` | 6002 | *(internal handshake)* |
| `EReceiptRequest_withMobileNumber` | 7001 | *(future)* |
| `EReceiptRequest_withOutMobileNumber` | 7002 | *(future)* |

v0.1.0 SDK only emits 4001/4002/4006/4007/4008. All other codes are
**decode-only** for now: a response carrying an unmapped code
surfaces as `SdkError::Internal("unknown txn type code <N>")`.

---

## 8. Status code map (idx 50)

**TBD — confirm from source.** Reference parser does
`int.parse(val)` but the Dart `csvDetails.status` line is commented
out. Map to `TransactionStatus` once values are confirmed; until
then, we infer status from `Response.ResponseCode` ("0" = success)
which is the field at response idx 2 (`transactionResponse`). For
v0.1.0, we treat:

- `transactionResponse == "0"` ⇒ `TransactionStatus::SUCCESS`
- anything else ⇒ `TransactionFailed { detail = idx 11 (remark),
  terminal_response_code = idx 2 }`

This is provisional and will be replaced once the user supplies the
real status table.

---

## 9. Open gaps (input needed from Pinelabs internal sources)

1. ~~`CsvConstant.MAX_CSV_LEN` exact value.~~ **Resolved: 50000** (per user, 2026-04-28).
2. `CsvChargeSlipParsingData` inter-pair delimiter and full key list.
3. Status code table at response idx 50.
4. NCMC `transitData` colon-KV full key list — confirmed from production
   `MasterService/.../bean/request/DoTransactionBean.kt`: `DF16` =
   `serviceIdTag` (`serviceID`), `DF15` = `serviceManagementInfoTag`
   (`serviceMI`), `isTransit` flag, `accType` (`paymentMode`), `effDate`,
   `DF45` = `serviceDataTag` (`serviceData`), `blAmt`
   (`cardAvailableBalance`). Pipe (`|`) separates key:value pairs;
   colon (`:`) separates key from value. Position in the response CSV
   is owned by `DoTransactionBean.getCSV` upstream of MasterApp; in the
   AppToApp JSON these surface as top-level `Detail` fields per
   `docs/development_requirements.md` §6.4.
5. `responseStringForInvalidCsvData` canonical fallback shape — is
   this our SDK's expected "decline-on-error" format on encode
   failure too?
6. Confirm UTF-8 vs ISO-8859-1 for cardholder names with diacritics.
7. Confirm whether request CSV ever contains fields beyond idx 32
   (some terminals may emit longer payloads for newer products).
