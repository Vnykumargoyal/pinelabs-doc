# Android — setup

Pine Labs SDK for Android ships as an **AAR** that you drop into
your Gradle build alongside its three runtime dependencies
(`net.java.dev.jna:jna:5.14.0@aar`, `com.google.code.gson:gson:2.11.0`,
and the Kotlin stdlib your AGP toolchain already provides).

This page covers a full installation: AAR placement, Gradle wiring,
Manifest queries for MasterApp on Android 11+, ProGuard / R8 rules,
and how to verify the install.

For the conceptual model, read
[`docs/concepts/overview.md`](../../concepts/overview.md) first.

---

## Prerequisites

| | Minimum | Tested |
|---|---|---|
| Android Gradle Plugin | 8.6 | 8.6.1 |
| Gradle | 8.7 | 8.9 |
| Kotlin | 2.0.0 | 2.0.20 |
| `compileSdk` | 34 | 34 |
| `minSdk` | 21 (Lollipop) | 21 |
| Target device | Android 5.0+ on a Pinelabs in-store terminal (for App-to-App) | — |

The SDK targets `jvmTarget = 17` and ships ABIs for **arm64-v8a**
and **armeabi-v7a** (covers every Pinelabs in-store device in the
field). x86_64 is **not** shipped; we recommend the Cloud REST or
PADController transport for emulator development.

---

## 1. Download and verify the AAR

1. Sign in to the Pinelabs Developer Portal and download the latest
   release zip:
   `pine-billing-sdk-<semver>-android.zip`.
2. The zip contains:
   * `pine-billing-sdk-<semver>.aar` — the library.
   * `pine-billing-sdk-<semver>.aar.sha256` — checksum.
   * `pine-billing-sdk-<semver>.aar.sig` — detached signature.
   * `docs/site/index.html` — a copy of these docs.
   * `README.md`, `CHANGELOG.md`.
3. Verify the checksum on macOS / Linux:
   ```bash
   shasum -a 256 -c pine-billing-sdk-<semver>.aar.sha256
   ```
   …or on Windows PowerShell:
   ```powershell
   (Get-FileHash -Algorithm SHA256 .\pine-billing-sdk-<semver>.aar).Hash -ieq `
     (Get-Content .\pine-billing-sdk-<semver>.aar.sha256 | ForEach-Object { ($_ -split ' ')[0] })
   ```
4. **Do not** commit the AAR to source control until checksum
   verification has passed.

---

## 2. Place the AAR in your project

A common layout:

```
app/
├── libs/
│   └── pine-billing-sdk-<semver>.aar
└── build.gradle.kts
```

Tell Gradle to look in `libs/`:

```kotlin
// app/build.gradle.kts
android {
    /* … */
    sourceSets {
        getByName("main") {
            // (no special source-set config needed for AAR libs)
        }
    }
}

dependencies {
    implementation(files("libs/pine-billing-sdk-<semver>.aar"))

    // Required runtime deps (transitively used by the AAR):
    implementation("net.java.dev.jna:jna:5.14.0@aar")
    implementation("com.google.code.gson:gson:2.11.0")

    // The Kotlin stdlib that matches your AGP/Kotlin toolchain is
    // already pulled in by your existing `kotlin-android` plugin —
    // do NOT add it again.
}
```

### Why `@aar` on `jna`?

JNA publishes both a JAR and an AAR. The AAR carries the JNI
`.so` libraries; the JAR alone is **insufficient** at runtime and
fails with `UnsatisfiedLinkError`. Always pin the `@aar` classifier.

### If you maintain a `flatDir` repository

```kotlin
repositories {
    flatDir { dirs("app/libs") }
    google()
    mavenCentral()
}
```

---

## 3. Manifest queries for MasterApp (App-to-App only)

If you target `targetSdk >= 30` (Android 11+) and intend to use the
App-to-App transport, you **must** declare the MasterApp package as
a query — otherwise the `PackageManager.getPackageInfo` lookup the
SDK does as a pre-flight check returns `NameNotFoundException` and
every transaction fails with `TransportUnavailable`.

```xml
<!-- AndroidManifest.xml -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.pos">

    <queries>
        <package android:name="com.pinelabs.masterapp" />
    </queries>

    <!-- the rest of your manifest -->
</manifest>
```

Cloud-only and PADController-only integrations do **not** need this
queries block.

---

## 4. ProGuard / R8

The AAR ships consumer rules that keep:

* Every UniFFI-generated symbol under `uniffi.pine_billing.*`.
* The Gson DTOs under
  `com.pinelabs.billing.sdk.internal.MasterApp*` so the JSON
  reflection survives shrinking.

You do **not** need to add anything to your `proguard-rules.pro`
unless you do unusual reflection of your own. If you see
`MissingFieldException` from Gson at runtime, it means R8 stripped
a field of yours that you reflected over — that's an issue in your
own code, not in the SDK.

---

## 5. Permissions

| Transport | Required permissions |
|---|---|
| App-to-App | `<queries>` block above. **No** runtime permissions; the IPC is bound by package signature, not by user-granted permission. |
| Cloud REST | `<uses-permission android:name="android.permission.INTERNET" />`. (Most apps already have this.) |
| PADController | Per-link permissions: `BLUETOOTH_CONNECT` (Android 12+) for BT terminals; `USB_PERMISSION` runtime grant for USB; nothing extra for Serial. |

---

## 6. Verify the install

Drop this snippet into a worker thread (e.g. inside a unit test or
a `lifecycleScope.launch(Dispatchers.IO) { … }` in your splash
screen) and run on a Pinelabs terminal:

```kotlin
import com.pinelabs.billing.sdk.PineBillingSdk
import uniffi.pine_billing.AppToAppConfig
import uniffi.pine_billing.LogLevel
import uniffi.pine_billing.SdkConfig
import uniffi.pine_billing.TransportType

val sdk = PineBillingSdk(
    context = applicationContext,
    config = SdkConfig(
        defaultTimeoutMs = 60_000u,
        logLevel = LogLevel.INFO,
        transport = TransportType.APP_TO_APP,
        appToApp = AppToAppConfig(userId = "POS-42", version = "1.0"),
        applicationId = "MERCHANT_PROVISIONED_ID", // from Pinelabs ops
        cloudBaseUrl = null,
        cloudConnectTimeoutMs = null,
        cloudReadTimeoutMs = null,
    ),
)

// On a real terminal, this prints a no-op slip:
sdk.testPrint(object : uniffi.pine_billing.TestPrintListener {
    override fun onStarted(eventId: String) { /* persist eventId */ }
    override fun onSuccess(eventId: String)  { /* slip printed */ }
    override fun onFailure(error: uniffi.pine_billing.SdkException) { /* see error-handling */ }
})
```

If the slip prints, the install is good. If you see
`SdkException.TransportUnavailable("MasterApp not installed")`,
re-check §3 (Manifest queries) and confirm MasterApp is installed
on the terminal.

---

## 7. Troubleshooting

| Symptom | Cause |
|---|---|
| `UnsatisfiedLinkError: dlopen failed: library "libjnidispatch.so" not found` | You used the `jna` JAR instead of `jna:5.14.0@aar`. Pin `@aar`. |
| `SdkException.TransportUnavailable("MasterApp not installed")` on a known-good terminal | Missing `<queries>` block (§3). Add it and rebuild. |
| `IllegalStateException: Pine Billing SDK called from main thread` | Move the call to `Dispatchers.IO` / a worker `Executor`. |
| `MissingFieldException` from Gson at runtime | Your own R8 rules; the AAR's consumer-rules already cover the SDK's DTOs. |
| `java.lang.NoSuchMethodError: ...uniffi...` after upgrading | Cached UniFFI bindings from a previous SDK version are on the classpath. Run `./gradlew clean`. |

---

## Next

* [Quickstart →](./quickstart.md) — full Sale via App-to-App on a
  Pinelabs terminal.
* [Examples →](./examples/) — `do-transaction.kt`, `test-print.kt`,
  `error-handling.kt`, `listener.kt`.
* [Concepts →](../../concepts/) — lifecycle, threading,
  reconciliation.

---

# Android — quickstart

A five-minute path from "AAR is in `app/libs/`" to "the cardholder
just paid you and the slip printed". This walkthrough uses the
**App-to-App** transport on a Pinelabs Android terminal with
MasterApp installed.

If you have not added the AAR yet, follow [`setup.md`](./setup.md)
first.

---

## What you'll build

A single `Activity` that:

1. Constructs a `PineBillingSdk` once at startup.
2. On a button tap, runs a ₹ 100.00 Sale via App-to-App on a worker
   thread.
3. Renders the result on the UI thread.

```text
┌───────────────────────────────────┐
│  ChargeActivity                   │
│  ─────────────────────────────    │
│   ▢ Order #ORD-1029  ₹100.00      │
│   [   Charge ₹100.00   ]          │
│                                   │
│   …                               │
│                                   │
│   ✓ Approved                      │
│   AUTH-9912 RRN-22845             │
└───────────────────────────────────┘
```

---

## 1. Construct the SDK once

A canonical place is `Application.onCreate()` so the same instance
is shared by every screen.

```kotlin
// PosApp.kt
package com.example.pos

import android.app.Application
import com.pinelabs.billing.sdk.PineBillingSdk
import uniffi.pine_billing.AppToAppConfig
import uniffi.pine_billing.LogLevel
import uniffi.pine_billing.SdkConfig
import uniffi.pine_billing.TransportType

class PosApp : Application() {

    lateinit var sdk: PineBillingSdk
        private set

    override fun onCreate() {
        super.onCreate()

        sdk = PineBillingSdk(
            context = applicationContext,
            config = SdkConfig(
                defaultTimeoutMs       = 60_000u,                  // 60 s per call
                logLevel               = LogLevel.INFO,
                transport              = TransportType.APP_TO_APP,
                appToApp               = AppToAppConfig(
                    userId  = "POS-42",       // your Pinelabs user id
                    version = "1.0",          // MUST be "1.0" today
                ),
                applicationId          = "MERCHANT_PROVISIONED_ID", // from Pinelabs ops
                cloudBaseUrl           = null,
                cloudConnectTimeoutMs  = null,
                cloudReadTimeoutMs     = null,
            ),
        )
    }
}
```

…and register it in your manifest:

```xml
<application
    android:name=".PosApp"
    …>
```

---

## 2. Build the request

`TransactionRequest` is the typed payload. Amounts are in **paise**
(the lowest currency unit). For ₹ 100.00, pass `10_000`.

```kotlin
import uniffi.pine_billing.TransactionRequest
import uniffi.pine_billing.TransactionType

private fun saleRequest(orderId: String, amountPaise: ULong): TransactionRequest =
    TransactionRequest(
        amount               = amountPaise,
        currency             = "INR",
        billingRefNo         = orderId,
        invoiceNo            = orderId,         // optional; many Pinelabs configs accept null
        transactionType      = TransactionType.SALE,
        originalEventId      = null,            // null for Sale; required for Refund/Void/Capture
        referenceId          = null,
        metadata             = null,
        merchantId           = null,            // App-to-App derives identity from the terminal
        terminalId           = null,
        allowedPaymentModes  = null,            // null = the terminal's default set
        transportOptions     = null,            // App-to-App accepts null; see Cloud quickstart for the required Cloud variant
    )
```

---

## 3. Call `doTransaction` on a worker thread

```kotlin
// ChargeActivity.kt
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import uniffi.pine_billing.SdkException
import uniffi.pine_billing.TransactionListener
import uniffi.pine_billing.TransactionResult

class ChargeActivity : AppCompatActivity() {

    private val sdk get() = (application as PosApp).sdk

    private fun onChargeButtonClick(orderId: String, amountPaise: ULong) {
        chargeButton.isEnabled = false
        showSpinner("Processing…")

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                sdk.doTransaction(
                    saleRequest(orderId, amountPaise),
                    TransactionListenerImpl(orderId),
                )
            } catch (e: SdkException) {
                runOnUiThread {
                    chargeButton.isEnabled = true
                    showError("Could not start: $e")
                }
            }
        }
    }

    private inner class TransactionListenerImpl(private val orderId: String) : TransactionListener {
        override fun onStarted(eventId: String) {
            // Persist BEFORE updating UI — see eventid-and-reconciliation.md.
            persistOpStarted(orderId, eventId)
        }

        override fun onSuccess(result: TransactionResult) {
            persistOpCompleted(orderId, result)
            runOnUiThread {
                chargeButton.isEnabled = true
                showApproved(result.authCode, result.rrn)
            }
        }

        override fun onFailure(error: SdkException) {
            persistOpFailed(orderId, error)
            runOnUiThread {
                chargeButton.isEnabled = true
                showError(error.toString())
            }
        }
    }
}
```

That's it. On a real Pinelabs terminal with MasterApp installed and
your `applicationId` provisioned, the cardholder will see the
prompt on the terminal display, tap or insert their card, and the
listener will fire.

---

## 4. Recommended UI rules

* **Disable the trigger button on `onStarted`**, re-enable on
  `onSuccess` / `onFailure`. This is the canonical way to avoid a
  double-charge bug.
* **Persist `eventId` BEFORE updating the screen**, even if the
  user navigates away or the OS kills you mid-call.
* **Never block the UI thread.** The `Dispatchers.IO` launch
  above keeps the listener safe; if you need to call the
  blocking methods (`cancel`, `checkStatus`, `connect`),
  do those on `Dispatchers.IO` too — the SDK actively rejects
  them on the main thread.

---

## 5. What to read next

* [`examples/do-transaction.kt`](./examples/do-transaction.kt) — same flow but with comments in-line.
* [`examples/test-print.kt`](./examples/test-print.kt) — verify printer paper without taking a payment.
* [`examples/error-handling.kt`](./examples/error-handling.kt) — full `SdkException` matching.
* [`examples/listener.kt`](./examples/listener.kt) — typed listener with structured persistence.
* [Concepts → `eventid-and-reconciliation.md`](../../concepts/eventid-and-reconciliation.md) — what to do when your app crashes mid-transaction.

---

## Troubleshooting (Android-specific)

| Symptom | Likely cause |
|---|---|
| Listener never fires; no exception | The SDK was constructed but the `applicationId` is wrong. The MasterApp server validates it for the `MethodId="1001"` Sale path; mis-provisioned ids return `BaseResponse` rejection which surfaces as `TransportError`. Double-check with Pinelabs ops. |
| `IllegalStateException: Pine Billing SDK called from main thread` | You called `cancel` / `checkStatus` / `connect` directly on the UI thread. Move to `Dispatchers.IO`. |
| `SdkException.TransportUnavailable("MasterApp not installed")` on a known-good terminal | Missing `<queries>` block in your manifest. See [`setup.md` §3](./setup.md). |
| Card was charged but listener fired `Timeout` | Treat as ambiguous. **Do not retry the Sale.** Reconcile via Pinelabs back-office reports keyed by `billingRefNo`. App-to-App does not expose `checkStatus`. |
