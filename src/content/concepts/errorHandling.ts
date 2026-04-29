export const errorHandlingContent = `
# Error Handling

All errors surface through the \`onFailure(error: SdkError)\` callback. The
SDK never throws exceptions from listener callbacks.

---

## SdkError structure

\`\`\`kotlin
data class SdkError(
    val code: ErrorCode,
    val message: String,
    val terminalCode: String? = null,
    val retryable: Boolean
)
\`\`\`

---

## Error codes

| Code | Retryable | Meaning |
|---|---|---|
| \`TRANSPORT_TIMEOUT\` | ✅ | Transport layer timed out |
| \`TERMINAL_BUSY\` | ✅ | Terminal is processing another transaction |
| \`SDK_BUSY\` | ❌ | SDK has an in-flight transaction |
| \`MASTERAPP_NOT_FOUND\` | ❌ | MasterApp not installed (Android A2A only) |
| \`MASTERAPP_VERSION_TOO_OLD\` | ❌ | MasterApp version < 3.4 |
| \`INVALID_REQUEST\` | ❌ | Bad field values (e.g., amount = 0) |
| \`PERMISSION_DENIED\` | ❌ | Missing BLE/USB permission |
| \`DECLINED\` | ❌ | Card declined by acquirer |
| \`CANCELLED_BY_USER\` | ❌ | Cardholder cancelled at terminal |
| \`NETWORK_ERROR\` | ✅ | TCP connection lost mid-transaction |
| \`UNKNOWN\` | ❌ | Unexpected error; check \`message\` for details |

---

## Retry strategy

Only retry errors marked **Retryable: ✅**. For \`TRANSPORT_TIMEOUT\` and
\`NETWORK_ERROR\`, wait at least 2 seconds before retrying.

\`\`\`kotlin
override fun onFailure(error: SdkError) {
    if (error.retryable && retryCount < 3) {
        Handler(Looper.getMainLooper()).postDelayed({
            retryCount++
            sdk.doTransaction(request, this)
        }, 2000)
    } else {
        runOnUiThread { showError(error.message) }
    }
}
\`\`\`

---

## Handling \`DECLINED\`

A declined transaction is **not** a SDK error — it means the card was
presented successfully and the acquirer refused it. You should:

1. Show a user-friendly message ("Payment declined — please try another card").
2. Do **not** retry with the same card automatically.
3. Log the \`terminalCode\` for your records.

---

## MasterApp errors (Android A2A)

If \`MASTERAPP_NOT_FOUND\` is returned:
1. Prompt the user to install MasterApp from the Pine Labs portal.
2. Do not retry the transaction.

If \`MASTERAPP_VERSION_TOO_OLD\`:
1. Prompt the user to update MasterApp.
2. Provide the minimum required version (3.4) in the error message.

---

## Logging best practices

- Always log \`error.code\`, \`error.message\`, and \`error.terminalCode\`.
- Include \`eventId\` (from \`onStarted\`) in your log lines for correlation.
- Do not log full card numbers or CVV.
`

