export const cSetup = `
# C / C++ — Setup

> **v1 status: Preview.** Full release in Phase 7.

The C SDK ships as a **static library** (\`libpinebilling.a\`) and a single header (\`pine_billing_sdk.h\`).

---

## Prerequisites

| Requirement | Minimum |
|---|---|
| C standard | C11 |
| C++ standard (optional) | C++17 |
| CMake | 3.20 |

---

## Step 1 — Copy the library

\`\`\`text
your-project/
└── libs/
    ├── libpinebilling.a
    └── pine_billing_sdk.h
\`\`\`

---

## Step 2 — Link in CMake

\`\`\`cmake
target_link_libraries(your_target PRIVATE
    \${CMAKE_SOURCE_DIR}/libs/libpinebilling.a
)
target_include_directories(your_target PRIVATE
    \${CMAKE_SOURCE_DIR}/libs
)
\`\`\`

---

## Verify

\`\`\`c
#include "pine_billing_sdk.h"
#include <stdio.h>

int main(void) {
    printf("SDK version: %s\\n", pine_sdk_version());
    return 0;
}
\`\`\`
`

export const cQuickstart = `
# C / C++ — Quickstart

> **v1 status: Preview.** Full release in Phase 7.

---

## 1. Create the SDK handle

\`\`\`c
#include "pine_billing_sdk.h"

PineSdkHandle sdk = pine_sdk_create(
    PINE_TRANSPORT_TCP, "192.168.1.100", 9100, NULL
);
\`\`\`

---

## 2. Build a request

\`\`\`c
PineTransactionRequest req = {
    .transaction_type = PINE_TXN_SALE,
    .amount           = 50000
};
\`\`\`

---

## 3. Run the transaction

\`\`\`c
pine_do_transaction(sdk, &req, on_started, on_success, on_failure, NULL);
// Callbacks are called from an internal worker thread
\`\`\`

---

## 4. Cleanup

\`\`\`c
pine_sdk_destroy(sdk);
\`\`\`
`

export const cDoTransaction = `
/*
 * Pine Labs SDK — C example: do_transaction (Sale via TCP)
 * v1 status: Preview. Ships in Phase 7.
 */

#include "pine_billing_sdk.h"
#include <stdio.h>
#include <string.h>

static void on_started(const char* event_id, void* user_data) {
    printf("Started: %s\\n", event_id);
}

static void on_success(const PineTransactionResult* result, void* user_data) {
    printf("Approved: %s  RRN: %s\\n", result->approval_code, result->rrn);
}

static void on_failure(const PineSdkError* error, void* user_data) {
    printf("Failed: %d — %s\\n", error->code, error->message);
}

int main(void) {
    PineSdkHandle sdk = pine_sdk_create(
        PINE_TRANSPORT_TCP, "192.168.1.100", 9100, NULL
    );

    PineTransactionRequest req;
    memset(&req, 0, sizeof(req));
    req.transaction_type = PINE_TXN_SALE;
    req.amount           = 50000;

    pine_do_transaction(sdk, &req, on_started, on_success, on_failure, NULL);
    pine_sdk_wait(sdk);
    pine_sdk_destroy(sdk);
    return 0;
}
`

export const cTestPrint = `
/*
 * Pine Labs SDK — C testPrint example
 * v1 status: Preview.
 */

#include "pine_billing_sdk.h"
#include <stdio.h>

static void print_on_success(void* user_data) {
    printf("Print OK\\n");
}

static void print_on_failure(const PineSdkError* error, void* user_data) {
    printf("Print failed: %s\\n", error->message);
}

void run_test_print(PineSdkHandle sdk) {
    const char* lines[] = {
        "================================",
        "     PINE LABS PRINTER TEST     ",
        "================================",
        "C SDK preview",
        "================================",
        NULL
    };

    pine_test_print(sdk, lines, print_on_success, print_on_failure, NULL);
    pine_sdk_wait(sdk);
}
`

export const cErrorHandling = `
/*
 * Pine Labs SDK — C error handling example
 * v1 status: Preview.
 */

#include "pine_billing_sdk.h"
#include <stdio.h>
#include <unistd.h>

static int retry_count = 0;
static const int MAX_RETRIES = 3;

static PineSdkHandle g_sdk;
static PineTransactionRequest g_req;

static void on_started(const char* event_id, void* user_data) {
    printf("[%s] Transaction started\\n", event_id);
}

static void on_success(const PineTransactionResult* result, void* user_data) {
    retry_count = 0;
    printf("Success: %s\\n", result->approval_code);
}

static void on_failure(const PineSdkError* error, void* user_data) {
    if (error->retryable && retry_count < MAX_RETRIES) {
        retry_count++;
        int delay = retry_count * retry_count;
        printf("Retrying in %ds (attempt %d)...\\n", delay, retry_count);
        sleep(delay);
        pine_do_transaction(g_sdk, &g_req, on_started, on_success, on_failure, NULL);
    } else {
        printf("Failed after %d attempts: %s\\n", retry_count, error->message);
    }
}
`

export const cListener = `
/*
 * Pine Labs SDK — C listener callbacks example
 * v1 status: Preview.
 */

#include "pine_billing_sdk.h"
#include <stdio.h>

void logging_on_started(const char* event_id, void* user_data) {
    const char* label = (const char*)user_data;
    printf("[%s] started event_id=%s\\n", label, event_id);
}

void logging_on_success(const PineTransactionResult* result, void* user_data) {
    const char* label = (const char*)user_data;
    printf("[%s] success approval=%s rrn=%s\\n", label, result->approval_code, result->rrn);
}

void logging_on_failure(const PineSdkError* error, void* user_data) {
    const char* label = (const char*)user_data;
    printf("[%s] failure code=%d retryable=%d msg=%s\\n",
           label, error->code, error->retryable, error->message);
}
`

