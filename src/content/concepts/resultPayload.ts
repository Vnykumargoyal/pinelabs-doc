export const resultPayloadContent = `
# Result Payload

A successful \`doTransaction\` call delivers a \`TransactionResult\` object to
\`onSuccess\`. This page describes every field.

---

## TransactionResult fields

| Field | Type | Always present | Description |
|---|---|---|---|
| \`eventId\` | String | ✅ | The event ID from \`onStarted\` |
| \`transactionType\` | TransactionType | ✅ | SALE, REFUND, VOID, AUTH, CAPTURE |
| \`amount\` | Long | ✅ | Amount in paise (same as request) |
| \`approvalCode\` | String | ✅ | Acquirer approval code |
| \`rrn\` | String | ✅ | Retrieval Reference Number |
| \`cardScheme\` | String | ⚠️ | VISA, MC, AMEX, etc. (absent for UPI) |
| \`maskedPan\` | String | ⚠️ | e.g. \`****-****-****-1234\` |
| \`cardholderName\` | String | ⚠️ | May be blank |
| \`mid\` | String | ✅ | Merchant ID |
| \`tid\` | String | ✅ | Terminal ID |
| \`timestamp\` | Instant | ✅ | Transaction timestamp (UTC) |
| \`receiptLines\` | List<String> | ✅ | Pre-formatted receipt lines |
| \`rawCsv\` | String | ⚠️ | Full CSV record (TCP/USB only) |
| \`signature\` | ByteArray | ⚠️ | Signature bitmap (if captured) |

> ⚠️ = present only when applicable

---

## Amount units

All amounts are in the **smallest currency unit** (paise for INR,
cents for USD, etc.). A Rs.500.00 transaction has \`amount = 50000\`.

---

## Printing a receipt

Use the \`receiptLines\` field to print. Each element is one line of
monospace text, already formatted to 42 columns.

\`\`\`kotlin
val lines = result.receiptLines
sdk.testPrint(lines, printListener)
\`\`\`

---

## Storing the result

Recommended minimal record to persist:

\`\`\`kotlin
data class StoredTransaction(
    val eventId: String,
    val approvalCode: String,
    val rrn: String,
    val amount: Long,
    val timestamp: Instant,
    val status: String          // "SUCCESS" | "FAILED" | "PENDING"
)
\`\`\`

---

## Raw CSV

If \`rawCsv\` is present, it contains the full terminal CSV record.
See CSV Format for the column layout.
`

