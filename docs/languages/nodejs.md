# Node.js — setup

> **v1 status: Preview.** The Node.js binding ships in a Phase 7
> milestone alongside Cloud REST and PADController support. The
> public surface is locked and matches the UDL.

The Pine Labs SDK for Node.js ships as an **npm tarball**
containing the Rust core (as a prebuilt N-API addon for each
supported platform / arch) plus TypeScript bindings.

> Distribution is via the **Pinelabs Developer Portal** — the SDK is
> **not** published to npmjs.com.

> **App-to-App is Android-only.** Your Node transport choices are
> **Cloud REST** and **PADController**.

---

## Prerequisites

| | Minimum | Tested |
|---|---|---|
| Node.js | 18 LTS | latest LTS |
| TypeScript (optional, recommended) | 5.0 | 5.4 |
| Platform / arch shipped | Linux x64 / arm64; macOS x64 / arm64; Windows x64 | — |

---

## 1. Download and verify the tarball

1. Download from the Pinelabs Developer Portal:
   `pinelabs-billing-sdk-<semver>.tgz`.
2. The release page also publishes:
   * `pinelabs-billing-sdk-<semver>.tgz.sha256`
   * `pinelabs-billing-sdk-<semver>.tgz.sig`
   * `docs/site/index.html` — these docs.
   * `README.md`, `CHANGELOG.md`.
3. Verify the checksum:
   ```bash
   shasum -a 256 -c pinelabs-billing-sdk-<semver>.tgz.sha256
   ```

---

## 2. Install with npm / pnpm / yarn

```bash
npm install ./pinelabs-billing-sdk-<semver>.tgz
# or
pnpm add ./pinelabs-billing-sdk-<semver>.tgz
# or
yarn add file:./pinelabs-billing-sdk-<semver>.tgz
```

The package name is `@pinelabs/billing-sdk`. If you maintain a
private npm registry (Verdaccio / Artifactory / GitHub Packages /
JFrog), publish the tarball there and reference normally:

```bash
npm install @pinelabs/billing-sdk@<semver> --registry=https://npm.private.example/
```

---

## 3. Verify the install

```ts
// index.ts
import {
    PineBillingSdk, SdkConfig, LogLevel, TransportType,
} from "@pinelabs/billing-sdk";

const sdk = new PineBillingSdk(
    {
        defaultTimeoutMs: 60_000,
        logLevel: LogLevel.Info,
        transport: TransportType.Cloud,
        appToApp: null,
        applicationId: null,
        cloudBaseUrl: "https://uat.pinelabs.example",
        cloudConnectTimeoutMs: 30_000,
        cloudReadTimeoutMs: 60_000,
    } satisfies SdkConfig,
    null,
);

console.log("isConnected =", sdk.isConnected());
```

---

## 4. Threading and the event loop

Node.js is single-threaded. The SDK's blocking methods
(`cancel`, `checkStatus`, `connect`, `disconnect`, `ping`,
`runSelfTest`, `getLogs`, `getTerminalInfo`, `setTransport`)
release the JS event loop while the underlying C call runs (the
N-API addon uses `napi_create_async_work`), so your Express /
Fastify / Koa request handler is **not** blocked. They still take
real wall-clock time, so wrap them in async / await:

```ts
const status = await sdk.checkStatus(eventId, options);
```

`doTransaction`, `testPrint`, and `discoverTerminals` are
listener-based and return immediately; their callbacks fire on the
SDK's worker thread and are dispatched onto the Node event loop
via N-API thread-safe functions.

---

## 5. Distribution channel reminder

The SDK is **not** on npmjs.com. `npm install @pinelabs/billing-sdk`
against the public npm registry will fail. Always install from
your downloaded tarball or your private mirror.

---

## 6. Troubleshooting

| Symptom | Cause |
|---|---|
| `Error: cannot find module '../prebuilds/<plat>-<arch>/pine_billing.node'` | Missing prebuild for your platform; the portal lists which platforms each release ships. Build from source against your toolchain or pick a different platform. |
| `Error: GLIBC_2.28 not found` (Linux) | Prebuild was compiled against a newer glibc; build from source or use a newer Linux distro. |
| `Could not locate the bindings file` on Windows | Antivirus / SmartScreen quarantined the `.node` file. Whitelist the `node_modules/@pinelabs/billing-sdk/prebuilds/` path. |

---

## Next

* [Quickstart →](./quickstart.md)
* [Examples →](./examples/) — `do-transaction.ts`, `test-print.ts`,
  `error-handling.ts`, `listener.ts`.
* [Concepts →](../../concepts/)

---

# Node.js — quickstart (Cloud REST)

> **v1 status: Preview.** Ships in a Phase 7 milestone.

Run a Sale via the **Cloud REST** transport. App-to-App is
Android-only.

---

## 1. Construct the SDK once

```ts
// sdk.ts
import {
    PineBillingSdk, SdkConfig, LogLevel, TransportType,
} from "@pinelabs/billing-sdk";

export const sdk = new PineBillingSdk(
    {
        defaultTimeoutMs: 60_000,
        logLevel: LogLevel.Info,
        transport: TransportType.Cloud,
        appToApp: null,
        applicationId: null,
        cloudBaseUrl: "https://uat.pinelabs.example",
        cloudConnectTimeoutMs: 30_000,
        cloudReadTimeoutMs: 60_000,
    } satisfies SdkConfig,
    null, // app_to_app_bridge — Android-only
);
```

Construct once at module load and re-export. Do **not** new it up
per request — the SDK keeps in-memory operation state.

---

## 2. Build the request

```ts
import {
    TransactionRequest, TransactionType, TransportOptions,
} from "@pinelabs/billing-sdk";

export function saleRequest(orderId: string, amountPaise: bigint): TransactionRequest {
    return {
        amount: amountPaise,
        currency: "INR",
        billingRefNo: orderId,
        invoiceNo: orderId,
        transactionType: TransactionType.Sale,
        originalEventId: null,
        referenceId: null,
        metadata: null,
        merchantId: "MID-001",
        terminalId: "TID-A",
        allowedPaymentModes: null,           // ignored on Cloud
        transportOptions: TransportOptions.Cloud({
            transactionNumber: orderId,
            sequenceNumber: "1",
            allowedPaymentMode: "10",
            autoCancelDurationInMinutes: null,
            forceCancelOnBack: null,
            merchantStorePosCode: "POS-1",
        }),
    };
}
```

`amount` is `bigint` because UniFFI maps `u64` to JS `bigint` to
avoid silent precision loss for large amounts. Use the `n` suffix
for literals: `10_000n`.

---

## 3. Submit and listen

```ts
import {
    SdkError, TransactionListener, TransactionResult,
} from "@pinelabs/billing-sdk";
import { sdk } from "./sdk";
import { saleRequest } from "./request";

export function charge(orderId: string, amountPaise: bigint): Promise<TransactionResult> {
    return new Promise((resolve, reject) => {
        const listener: TransactionListener = {
            onStarted(eventId: string): void {
                // Persist BEFORE responding to anyone.
                opStore.started(orderId, eventId);
            },
            onSuccess(result: TransactionResult): void {
                opStore.completed(orderId, result);
                resolve(result);
            },
            onFailure(error: SdkError): void {
                opStore.failed(orderId, error);
                reject(error);
            },
        };
        try {
            sdk.doTransaction(saleRequest(orderId, amountPaise), listener);
        } catch (e) {
            reject(e);
        }
    });
}
```

> **Cloud `doTransaction` resolves to `Pending`.** The promise
> above resolves on `onSuccess` with `result.status =
> TransactionStatus.Pending` and `result.transactionId` set to the
> `PlutusTransactionReferenceID`. Drive the rest of the lifecycle
> via `checkStatus` until the state moves to `Completed` or
> `Failed`.

---

## 4. Reconciliation

```ts
import {
    CheckStatusOptions, OperationState,
} from "@pinelabs/billing-sdk";

const status = await sdk.checkStatus(
    transactionId,
    CheckStatusOptions.Cloud({ merchantStorePosCode: "POS-1" }),
);

switch (status.state) {
    case OperationState.Completed:
        return status.result!;
    case OperationState.Failed:
        throw new Error(status.failureDetail ?? "failed");
    case OperationState.Pending:
    case OperationState.InFlight:
        // Still in flight; show a spinner and poll again later.
        break;
    case OperationState.Unknown:
        // Process restarted; the cloud server is the source of
        // truth — re-query later.
        break;
    default:
        // Forward-compatibility default: future OperationState
        // variants are MINOR additions.
        break;
}
```

For the canonical recovery procedure see
[`docs/concepts/eventid-and-reconciliation.md`](../../concepts/eventid-and-reconciliation.md).

---

## 5. Express handler example

```ts
import express from "express";
import { charge } from "./charge";

const app = express();
app.use(express.json());

app.post("/charge", async (req, res) => {
    const { orderId, amountPaise } = req.body as {
        orderId: string; amountPaise: string;
    };
    try {
        const result = await charge(orderId, BigInt(amountPaise));
        res.json({ ok: true, transactionId: result.transactionId });
    } catch (e: any) {
        res.status(500).json({ ok: false, error: String(e) });
    }
});

app.listen(3000);
```

---

## Next

* [`examples/do-transaction.ts`](./examples/do-transaction.ts)
* [`examples/test-print.ts`](./examples/test-print.ts)
* [`examples/error-handling.ts`](./examples/error-handling.ts)
* [`examples/listener.ts`](./examples/listener.ts)
