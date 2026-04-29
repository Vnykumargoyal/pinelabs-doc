export const androidSetup = `
# Android — Setup

Pine Labs SDK for Android ships as an **AAR** that you drop into
your Gradle build alongside its runtime dependencies.

---

## Prerequisites

| Requirement | Minimum |
|---|---|
| Android Gradle Plugin | 8.0 |
| Kotlin | 1.9 |
| \`minSdkVersion\` | 26 (Android 8.0) |
| \`compileSdkVersion\` | 34 |
| JNA (AAR) | 5.14.0 |
| Gson | 2.11.0 |

---

## Step 1 — Copy the AAR

Place the SDK AAR in your project's \`libs/\` folder:

\`\`\`text
your-project/
└── app/
    └── libs/
        └── pinelabs-billing-sdk-1.0.0.aar
\`\`\`

---

## Step 2 — Add Gradle dependencies

In \`app/build.gradle.kts\`:

\`\`\`kotlin
dependencies {
    implementation(fileTree(mapOf("dir" to "libs", "include" to listOf("*.aar"))))
    implementation("net.java.dev.jna:jna:5.14.0@aar")
    implementation("com.google.code.gson:gson:2.11.0")
}
\`\`\`

---

## Step 3 — Manifest queries (Android 11+)

\`\`\`xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <queries>
        <package android:name="com.pinelabs.masterapp" />
    </queries>
    <application>
        <!-- ... -->
    </application>
</manifest>
\`\`\`

---

## Step 4 — ProGuard / R8 rules

\`\`\`proguard
-keep class com.pinelabs.billingsdk.** { *; }
-keep class com.sun.jna.** { *; }
-dontwarn com.sun.jna.**
\`\`\`

---

## Step 5 — Verify the install

\`\`\`kotlin
import com.pinelabs.billingsdk.PineBillingSdk
import com.pinelabs.billingsdk.TransportOpt

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val sdk = PineBillingSdk(this, TransportOpt.APP_TO_APP)
        Log.d("PineLabsSDK", "SDK version: " + sdk.version)
    }
}
\`\`\`

Expected logcat output:

\`\`\`text
D/PineLabsSDK: SDK version: 1.0.0
\`\`\`
`

export const androidQuickstart = `
# Android — Quickstart

This guide walks you through your first end-to-end sale transaction on Android
using the App-to-App transport.

**Prerequisites:** Complete Android Setup first.

---

## 1. Initialise the SDK

Create the SDK instance once — at \`Application.onCreate\` or via your DI
container. Never create it per-Activity.

\`\`\`kotlin
class MyApplication : Application() {
    lateinit var sdk: PineBillingSdk

    override fun onCreate() {
        super.onCreate()
        sdk = PineBillingSdk(this, TransportOpt.APP_TO_APP)
    }
}
\`\`\`

---

## 2. Build a transaction request

\`\`\`kotlin
val request = TransactionRequest(
    transactionType = TransactionType.SALE,
    amount          = 50000,   // Rs.500.00 in paise
    mobileNumber    = "9876543210",
    printReceipt    = true
)
\`\`\`

---

## 3. Call \`doTransaction\`

\`\`\`kotlin
sdk.doTransaction(request, object : TransactionListener {

    override fun onStarted(eventId: String) {
        // Terminal accepted the request.
        // PERSIST eventId NOW, before the transaction completes.
        db.save(eventId, "PENDING")
    }

    override fun onSuccess(result: TransactionResult) {
        db.update(result.eventId, "SUCCESS", result.approvalCode)
        runOnUiThread { showReceipt(result) }
    }

    override fun onFailure(error: SdkError) {
        db.update(currentEventId, "FAILED", error.code.name)
        runOnUiThread { showError(error) }
    }
})
\`\`\`

---

## 4. Handle the result

\`\`\`kotlin
fun showReceipt(result: TransactionResult) {
    tvApprovalCode.text = result.approvalCode
    tvAmount.text       = "Rs." + (result.amount / 100.0)
    tvRrn.text          = result.rrn
    tvTimestamp.text    = result.timestamp.toString()
}
\`\`\`

---

## Next steps

- Learn about Event ID & Reconciliation.
- Explore the Capability Matrix for available transaction types.
`

export const androidDoTransaction = `
/*
 * Pine Labs SDK — Android example: do_transaction (Sale via App-to-App)
 *
 * Demonstrates:
 *  - Constructing the SDK once and reusing it.
 *  - Building a TransactionRequest with the correct units (paise).
 *  - Persisting the event_id in onStarted BEFORE updating the UI.
 *  - Marshalling onSuccess / onFailure back to the UI thread.
 */

package com.example.myposapp

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.appcompat.app.AppCompatActivity
import com.pinelabs.billingsdk.PineBillingSdk
import com.pinelabs.billingsdk.SdkError
import com.pinelabs.billingsdk.TransactionListener
import com.pinelabs.billingsdk.TransactionRequest
import com.pinelabs.billingsdk.TransactionResult
import com.pinelabs.billingsdk.TransactionType
import com.pinelabs.billingsdk.TransportOpt

class CheckoutActivity : AppCompatActivity() {

    private val mainHandler = Handler(Looper.getMainLooper())

    // Obtain the SDK from your Application / DI container.
    private val sdk: PineBillingSdk by lazy {
        (application as MyApplication).sdk
    }

    private var currentEventId: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_checkout)
        btnCharge.setOnClickListener { startPayment() }
    }

    private fun startPayment() {
        val amountPaise = 50000L // Rs.500.00

        val request = TransactionRequest(
            transactionType = TransactionType.SALE,
            amount          = amountPaise,
            mobileNumber    = "9876543210",
            printReceipt    = true
        )

        showLoading(true)

        sdk.doTransaction(request, object : TransactionListener {

            override fun onStarted(eventId: String) {
                currentEventId = eventId
                AppDatabase.instance.transactions().insert(
                    TransactionEntity(eventId = eventId, amount = amountPaise, status = "PENDING")
                )
            }

            override fun onSuccess(result: TransactionResult) {
                AppDatabase.instance.transactions().update(
                    eventId      = result.eventId,
                    status       = "SUCCESS",
                    approvalCode = result.approvalCode,
                    rrn          = result.rrn
                )
                mainHandler.post {
                    showLoading(false)
                    showReceipt(result)
                }
            }

            override fun onFailure(error: SdkError) {
                currentEventId?.let { id ->
                    AppDatabase.instance.transactions().update(
                        eventId   = id,
                        status    = "FAILED",
                        errorCode = error.code.name
                    )
                }
                mainHandler.post {
                    showLoading(false)
                    showError(error)
                }
            }
        })
    }

    private fun showReceipt(result: TransactionResult) {
        tvStatus.text       = "Approved"
        tvApprovalCode.text = result.approvalCode
        tvRrn.text          = result.rrn
        tvAmount.text       = "Rs." + (result.amount / 100.0)
        tvTimestamp.text    = result.timestamp.toString()
    }

    private fun showError(error: SdkError) {
        tvStatus.text = if (error.retryable) error.message + "\\n\\nTap to retry." else error.message
    }

    private fun showLoading(visible: Boolean) {
        progressBar.visibility = if (visible) android.view.View.VISIBLE else android.view.View.GONE
        btnCharge.isEnabled    = !visible
    }
}
`

export const androidTestPrint = `
/*
 * Pine Labs SDK — Android example: testPrint
 */

package com.example.myposapp

import com.pinelabs.billingsdk.PineBillingSdk
import com.pinelabs.billingsdk.PrintListener
import com.pinelabs.billingsdk.SdkError

fun testPrinterConnection(sdk: PineBillingSdk) {
    val lines = listOf(
        "================================",
        "     PINE LABS PRINTER TEST     ",
        "================================",
        "Line 1: Normal text",
        "Line 2: 1234567890",
        "================================",
        "       END OF TEST PRINT        ",
        "================================"
    )

    sdk.testPrint(lines, object : PrintListener {
        override fun onSuccess() {
            Log.d("Print", "Test print succeeded")
        }

        override fun onFailure(error: SdkError) {
            Log.e("Print", "Test print failed: " + error.message)
        }
    })
}
`

export const androidErrorHandling = `
/*
 * Pine Labs SDK — Android example: error handling patterns
 *
 * Demonstrates:
 *  - Distinguishing retryable vs terminal errors.
 *  - Exponential backoff for retryable errors.
 *  - Special handling for DECLINED and MASTERAPP_NOT_FOUND.
 */

package com.example.myposapp

import android.os.Handler
import android.os.Looper
import com.pinelabs.billingsdk.ErrorCode
import com.pinelabs.billingsdk.PineBillingSdk
import com.pinelabs.billingsdk.SdkError
import com.pinelabs.billingsdk.TransactionListener
import com.pinelabs.billingsdk.TransactionRequest
import com.pinelabs.billingsdk.TransactionResult

class PaymentWithRetry(
    private val sdk: PineBillingSdk,
    private val maxRetries: Int = 3
) {
    private val handler = Handler(Looper.getMainLooper())
    private var attempt = 0

    fun run(
        request: TransactionRequest,
        onFinalSuccess: (TransactionResult) -> Unit,
        onFinalFailure: (SdkError) -> Unit
    ) {
        attempt = 0
        execute(request, onFinalSuccess, onFinalFailure)
    }

    private fun execute(
        request: TransactionRequest,
        onFinalSuccess: (TransactionResult) -> Unit,
        onFinalFailure: (SdkError) -> Unit
    ) {
        sdk.doTransaction(request, object : TransactionListener {

            override fun onStarted(eventId: String) {
                AppDatabase.instance.transactions().insert(
                    TransactionEntity(eventId = eventId, status = "PENDING")
                )
            }

            override fun onSuccess(result: TransactionResult) {
                attempt = 0
                onFinalSuccess(result)
            }

            override fun onFailure(error: SdkError) {
                when {
                    error.code == ErrorCode.MASTERAPP_NOT_FOUND -> {
                        onFinalFailure(error)
                        promptInstallMasterApp()
                    }
                    error.code == ErrorCode.MASTERAPP_VERSION_TOO_OLD -> {
                        onFinalFailure(error)
                        promptUpdateMasterApp()
                    }
                    error.code == ErrorCode.DECLINED -> {
                        onFinalFailure(error)
                    }
                    error.retryable && attempt < maxRetries -> {
                        attempt++
                        val delayMs = (1000L * attempt * attempt)
                        handler.postDelayed({
                            execute(request, onFinalSuccess, onFinalFailure)
                        }, delayMs)
                    }
                    else -> onFinalFailure(error)
                }
            }
        })
    }

    private fun promptInstallMasterApp() { /* show dialog */ }
    private fun promptUpdateMasterApp() { /* show dialog */ }
}
`

export const androidListener = `
/*
 * Pine Labs SDK — Android example: full TransactionListener
 */

package com.example.myposapp

import android.util.Log
import com.pinelabs.billingsdk.SdkError
import com.pinelabs.billingsdk.TransactionListener
import com.pinelabs.billingsdk.TransactionResult

private const val TAG = "PineLabsTxnListener"

open class LoggingTransactionListener : TransactionListener {

    protected var eventId: String? = null

    override fun onStarted(eventId: String) {
        this.eventId = eventId
        Log.i(TAG, "[\${'$'}{eventId}] Transaction started")
    }

    override fun onSuccess(result: TransactionResult) {
        Log.i(TAG, "[\${'$'}{result.eventId}] SUCCESS — approval: \${'$'}{result.approvalCode}, RRN: \${'$'}{result.rrn}")
    }

    override fun onFailure(error: SdkError) {
        Log.w(TAG, "[\${'$'}{eventId ?: "?"}] FAILURE — code: \${'$'}{error.code}, retryable: \${'$'}{error.retryable}")
    }
}
`

