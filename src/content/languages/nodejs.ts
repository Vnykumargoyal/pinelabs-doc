export const nodejsSetup = `
# Node.js — Setup

> **v1 status: Preview.** Full release in Phase 7.

The Node.js SDK is distributed as an npm package with zero runtime dependencies.

---

## Prerequisites

| Requirement | Minimum |
|---|---|
| Node.js | 18 LTS |
| npm | 9 |
| TypeScript (optional) | 5.0 |

---

## Install

\`\`\`bash
npm install @pinelabs/billing-sdk
\`\`\`

---

## Verify

\`\`\`typescript
import { PineBillingSdk } from "@pinelabs/billing-sdk";

const sdk = new PineBillingSdk({ transport: "tcp", host: "192.168.1.100", port: 9100 });
console.log(sdk.version);  // 1.0.0
\`\`\`
`

export const nodejsQuickstart = `
# Node.js — Quickstart

> **v1 status: Preview.** Full release in Phase 7.

---

## 1. Create the SDK

\`\`\`typescript
import { PineBillingSdk } from "@pinelabs/billing-sdk";

const sdk = new PineBillingSdk({
    transport: "tcp",
    host: "192.168.1.100",
    port: 9100
});
\`\`\`

---

## 2. Build a request

\`\`\`typescript
const request = {
    transactionType: "SALE",
    amount: 50000   // Rs.500.00 in paise
};
\`\`\`

---

## 3. Run the transaction

\`\`\`typescript
await sdk.doTransaction(request, {
    onStarted: async (eventId: string) => {
        await db.save(eventId, "PENDING");
    },
    onSuccess: (result) => {
        console.log("Approved:", result.approvalCode);
    },
    onFailure: (error) => {
        console.error("Error:", error.code, error.message);
    }
});
\`\`\`
`

export const nodejsDoTransaction = `
/*
 * Pine Labs SDK — Node.js example: doTransaction (Sale via TCP)
 * v1 status: Preview. Ships in Phase 7.
 */

import { PineBillingSdk, TransactionRequest, SdkError, TransactionResult } from "@pinelabs/billing-sdk";

const sdk = new PineBillingSdk({
    transport: "tcp",
    host: "192.168.1.100",
    port: 9100,
});

async function runSale(amountPaise: number): Promise<void> {
    const request: TransactionRequest = {
        transactionType: "SALE",
        amount: amountPaise,
    };

    await sdk.doTransaction(request, {
        onStarted: async (eventId: string) => {
            await db.save({ eventId, status: "PENDING" });
        },
        onSuccess: async (result: TransactionResult) => {
            await db.update({ eventId: result.eventId, status: "SUCCESS" });
            console.log("Approved:", result.approvalCode, "RRN:", result.rrn);
        },
        onFailure: async (error: SdkError) => {
            console.error("Failed:", error.code, "—", error.message);
        },
    });
}

runSale(50_000).catch(console.error);
`

export const nodejsTestPrint = `
/*
 * Pine Labs SDK — Node.js testPrint example
 * v1 status: Preview.
 */

import { PineBillingSdk, SdkError } from "@pinelabs/billing-sdk";

async function runTestPrint(sdk: PineBillingSdk): Promise<void> {
    const lines = [
        "================================",
        "     PINE LABS PRINTER TEST     ",
        "================================",
        "Node.js SDK preview",
        "================================",
    ];

    await sdk.testPrint(lines, {
        onSuccess: () => console.log("Print OK"),
        onFailure: (error: SdkError) => console.error("Print failed:", error.message),
    });
}
`

export const nodejsErrorHandling = `
/*
 * Pine Labs SDK — Node.js error handling example
 * v1 status: Preview.
 */

import { PineBillingSdk, SdkError, ErrorCode, TransactionRequest, TransactionResult } from "@pinelabs/billing-sdk";

async function doWithRetry(
    sdk: PineBillingSdk,
    request: TransactionRequest,
    maxRetries = 3
): Promise<TransactionResult> {
    let attempt = 0;

    while (true) {
        try {
            return await new Promise<TransactionResult>((resolve, reject) => {
                sdk.doTransaction(request, {
                    onStarted: () => {},
                    onSuccess: resolve,
                    onFailure: reject,
                });
            });
        } catch (error) {
            const sdkError = error as SdkError;
            if (sdkError.code === ErrorCode.DECLINED) throw sdkError;
            if (!sdkError.retryable || attempt >= maxRetries) throw sdkError;
            attempt++;
            await new Promise(r => setTimeout(r, attempt * attempt * 1000));
        }
    }
}
`

export const nodejsListener = `
/*
 * Pine Labs SDK — Node.js listener example
 * v1 status: Preview.
 */

import { TransactionListener, TransactionResult, SdkError } from "@pinelabs/billing-sdk";

export function makeLoggingListener(label: string): TransactionListener {
    return {
        onStarted: (eventId: string) => {
            console.log("[" + label + "] started eventId=" + eventId);
        },
        onSuccess: (result: TransactionResult) => {
            console.log("[" + label + "] success approval=" + result.approvalCode + " rrn=" + result.rrn);
        },
        onFailure: (error: SdkError) => {
            console.error("[" + label + "] failure code=" + error.code + " retryable=" + error.retryable);
        },
    };
}
`

