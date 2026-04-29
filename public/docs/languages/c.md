# C / C++ — setup

> **v1 status: Preview.** The C binding ships in a Phase 7
> milestone alongside Cloud REST and PADController support. The
> public surface is locked and matches the UDL.

The Pine Labs SDK for C ships as a **shared library** with a single
public header. Distribution is via the **Pinelabs Developer
Portal** — there is no public package archive.

> **App-to-App is Android-only.** C clients use **Cloud REST** or
> **PADController**.

The C binding is the lowest-level public surface. It is intended
for:

* Embedded POS controllers without a Java/Swift/Python/Node runtime.
* Linux back-office services that already wrap C libraries.
* Bridging the SDK into another language (Lua, Tcl, Erlang NIF,
  Rust FFI, …) that does not have a first-class binding yet.

If your application can use Kotlin / Swift / Python / Node — pick
one of those. The C surface is more verbose and demands explicit
ownership / freeing of every string and structure.

---

## Prerequisites

| | Minimum | Tested |
|---|---|---|
| C compiler | C11 (GCC ≥ 9, Clang ≥ 11, MSVC 2019+) | latest |
| C++ compiler (optional) | C++17 | latest |
| Linker | platform-default | — |
| Platforms shipped | Linux glibc 2.28+ x86_64 / aarch64; Windows x86_64 (MSVC); macOS 11+ x86_64 / arm64 | — |

---

## 1. Download and verify the archive

1. Download `pine_billing_sdk-<semver>-c-<platform>.tar.gz` from
   the Pinelabs Developer Portal.
2. The archive contains:
   * `include/pine_billing.h` — the umbrella header.
   * `lib/libpine_billing.so` (Linux), `libpine_billing.dylib`
     (macOS), or `pine_billing.dll` + `pine_billing.lib`
     (Windows).
   * `lib/pkgconfig/pine_billing.pc` — pkg-config descriptor (Unix).
   * `docs/site/index.html` — these docs.
   * `README.md`, `CHANGELOG.md`, the SHA-256 file, and the
     detached signature.
3. Verify the checksum:
   ```bash
   sha256sum -c pine_billing_sdk-<semver>-c-<platform>.tar.gz.sha256
   ```

---

## 2. Install

### Linux / macOS (system-wide)

```bash
sudo tar -C /usr/local -xzf pine_billing_sdk-<semver>-c-linux-x86_64.tar.gz
sudo ldconfig
```

…then compile with:

```bash
cc my_app.c $(pkg-config --cflags --libs pine_billing) -o my_app
```

### Linux / macOS (vendored)

```bash
mkdir -p third_party/pine_billing
tar -C third_party/pine_billing -xzf pine_billing_sdk-<semver>-c-linux-x86_64.tar.gz

# In your build:
cc my_app.c \
    -I third_party/pine_billing/include \
    -L third_party/pine_billing/lib -lpine_billing \
    -Wl,-rpath,'$ORIGIN/../third_party/pine_billing/lib' \
    -o my_app
```

### Windows (MSVC)

```cmd
:: extract pine_billing_sdk-<semver>-c-windows-x86_64.zip into third_party\pine_billing

cl my_app.c ^
    /I third_party\pine_billing\include ^
    third_party\pine_billing\lib\pine_billing.lib

:: At runtime, `pine_billing.dll` must be on PATH or beside your .exe.
```

---

## 3. Smoke test

```c
#include <stdio.h>
#include <pine_billing.h>

int main(void) {
    pine_billing_error_t err = {0};

    pine_billing_sdk_config_t config = {
        .default_timeout_ms       = 60000,
        .log_level                = PINE_BILLING_LOG_INFO,
        .transport                = PINE_BILLING_TRANSPORT_CLOUD,
        .app_to_app               = NULL,
        .application_id           = NULL,
        .cloud_base_url           = "https://uat.pinelabs.example",
        .cloud_connect_timeout_ms = 30000,
        .cloud_read_timeout_ms    = 60000,
    };

    pine_billing_sdk_t *sdk = pine_billing_sdk_new(&config, NULL, &err);
    if (sdk == NULL) {
        fprintf(stderr, "construct failed: %s\n", err.detail);
        pine_billing_error_free(&err);
        return 1;
    }

    int connected = pine_billing_sdk_is_connected(sdk);
    printf("isConnected = %d\n", connected);

    pine_billing_sdk_free(sdk);
    return 0;
}
```

If this compiles and prints `isConnected = 0` (Cloud has no
persistent link), the install is good.

---

## 4. Memory ownership conventions

The header documents ownership for every API. The base rules:

* Every `_new` / `_get_*` / `_take_*` function returns a
  newly-allocated object you must release with the matching
  `_free` function.
* Every `pine_billing_error_t` you populate via the `&err` out-param
  (after a function returned non-zero / `NULL`) **must** be
  released with `pine_billing_error_free(&err)`.
* Strings returned in struct fields are owned by that struct's
  `_free` function. Do not `free()` them directly.
* Strings you **pass in** (e.g. `cloud_base_url`) are copied
  internally; you may free your copy at any time after the call
  returns.

---

## 5. Threading

The SDK is fully re-entrant **across instances** but only
single-op **per instance** (see
[`docs/concepts/lifecycle.md` §3](../../concepts/lifecycle.md)).
Listener callbacks are invoked from an SDK-internal worker thread.
Do not call back into the same `pine_billing_sdk_t *` from inside
its own listener.

The C binding does not detect "the main thread"; you are
responsible for not calling the blocking APIs (`cancel`,
`check_status`, `connect`, `disconnect`, `ping`,
`run_self_test`, `get_logs`, `get_terminal_info`,
`set_transport`) from a UI / event thread.

---

## 6. Distribution channel reminder

The SDK is **not** in apt / yum / Homebrew / vcpkg. Always install
from the archive you downloaded.

---

## Next

* [Quickstart →](./quickstart.md)
* [Examples →](./examples/) — `do-transaction.c`, `test-print.c`,
  `error-handling.c`, `listener.c`.
* [Concepts →](../../concepts/)

---

# C — quickstart (Cloud REST)

> **v1 status: Preview.** Ships in a Phase 7 milestone.

Run a Sale via the **Cloud REST** transport. App-to-App is
Android-only.

The C binding is intentionally close to the UDL. Every function has
an `out` parameter for the result and an `&err` for failure;
`return 0` means success.

---

## 1. Construct the SDK once

```c
#include <pine_billing.h>

static pine_billing_sdk_t *g_sdk;

int sdk_init(void) {
    pine_billing_error_t err = {0};

    pine_billing_sdk_config_t config = {
        .default_timeout_ms       = 60000,
        .log_level                = PINE_BILLING_LOG_INFO,
        .transport                = PINE_BILLING_TRANSPORT_CLOUD,
        .app_to_app               = NULL,        /* Android-only */
        .application_id           = NULL,
        .cloud_base_url           = "https://uat.pinelabs.example",
        .cloud_connect_timeout_ms = 30000,
        .cloud_read_timeout_ms    = 60000,
    };

    g_sdk = pine_billing_sdk_new(&config, /* app_to_app_bridge = */ NULL, &err);
    if (g_sdk == NULL) {
        fprintf(stderr, "SDK construct failed: %s\n", err.detail);
        pine_billing_error_free(&err);
        return -1;
    }
    return 0;
}

void sdk_shutdown(void) {
    if (g_sdk) {
        pine_billing_sdk_free(g_sdk);
        g_sdk = NULL;
    }
}
```

---

## 2. Build the request

```c
pine_billing_cloud_transaction_options_t cloud = {
    .transaction_number              = order_id,    /* required */
    .sequence_number                 = "1",         /* required */
    .allowed_payment_mode            = "10",
    .auto_cancel_duration_in_minutes = NULL,
    .force_cancel_on_back            = PINE_BILLING_TRIBOOL_NULL,
    .merchant_store_pos_code         = "POS-1",
};

pine_billing_transport_options_t opts = {
    .kind = PINE_BILLING_TRANSPORT_OPTIONS_CLOUD,
    .cloud = &cloud,
};

pine_billing_transaction_request_t req = {
    .amount               = (uint64_t)amount_paise,
    .currency             = "INR",
    .billing_ref_no       = order_id,
    .invoice_no           = order_id,
    .transaction_type     = PINE_BILLING_TXN_SALE,
    .original_event_id    = NULL,
    .reference_id         = NULL,
    .metadata             = NULL,
    .merchant_id          = "MID-001",
    .terminal_id          = "TID-A",
    .allowed_payment_modes      = NULL,
    .allowed_payment_modes_len  = 0,
    .transport_options    = &opts,
};
```

The `pine_billing_tribool_t` enum exists for "optional boolean"
fields: `PINE_BILLING_TRIBOOL_TRUE`, `PINE_BILLING_TRIBOOL_FALSE`,
`PINE_BILLING_TRIBOOL_NULL`. Avoid `bool *` to keep the ABI stable
across compilers.

---

## 3. Submit and listen

C callbacks are passed as a struct of function pointers plus a
single `void *user_data` cookie. The SDK invokes them from a worker
thread.

```c
struct ctx {
    char order_id[64];
    /* fields you want to share between callbacks */
};

static void on_started(const char *event_id, void *user_data) {
    struct ctx *c = user_data;
    op_store_started(c->order_id, event_id);   /* persist BEFORE anything else */
}

static void on_success(const pine_billing_transaction_result_t *result, void *user_data) {
    struct ctx *c = user_data;
    op_store_completed(c->order_id, result);
}

static void on_failure(const pine_billing_error_t *error, void *user_data) {
    struct ctx *c = user_data;
    op_store_failed(c->order_id, error);
}

int charge(const char *order_id, uint64_t amount_paise) {
    struct ctx *c = calloc(1, sizeof(*c));
    snprintf(c->order_id, sizeof c->order_id, "%s", order_id);

    pine_billing_transaction_listener_t listener = {
        .on_started = on_started,
        .on_success = on_success,
        .on_failure = on_failure,
        .user_data  = c,
        .free_user_data = free,        /* called by the SDK after the last callback */
    };

    pine_billing_error_t err = {0};
    pine_billing_transaction_request_t req = /* …as in §2… */;

    if (pine_billing_sdk_do_transaction(g_sdk, &req, &listener, &err) != 0) {
        fprintf(stderr, "doTransaction sync failed: %s\n", err.detail);
        pine_billing_error_free(&err);
        return -1;
    }
    return 0;
}
```

> **Cloud `do_transaction` resolves to `Pending`.** `on_success`
> fires with `result->status == PINE_BILLING_STATUS_PENDING` and
> `result->transaction_id` set to the
> `PlutusTransactionReferenceID`. Drive the rest of the lifecycle
> via `pine_billing_sdk_check_status`.

---

## 4. Reconciliation

```c
pine_billing_cloud_check_status_options_t cs_opts = {
    .merchant_store_pos_code = "POS-1",
};
pine_billing_check_status_options_t opts = {
    .kind  = PINE_BILLING_CHECK_STATUS_OPTIONS_CLOUD,
    .cloud = &cs_opts,
};

pine_billing_operation_status_t *status = NULL;
pine_billing_error_t err = {0};
if (pine_billing_sdk_check_status(g_sdk, transaction_id, &opts, &status, &err) != 0) {
    fprintf(stderr, "check_status failed: %s\n", err.detail);
    pine_billing_error_free(&err);
    return -1;
}

switch (status->state) {
case PINE_BILLING_OP_COMPLETED: handle_completed(status->result); break;
case PINE_BILLING_OP_FAILED:    handle_failed(status->failure_detail,
                                              status->terminal_response_code); break;
case PINE_BILLING_OP_PENDING:
case PINE_BILLING_OP_IN_FLIGHT: /* still in flight */ break;
case PINE_BILLING_OP_CANCELLED: /* user cancelled */ break;
case PINE_BILLING_OP_UNKNOWN:   /* re-query later */ break;
default: /* forward-compat: ignore */ break;
}

pine_billing_operation_status_free(status);
```

For the canonical recovery procedure see
[`docs/concepts/eventid-and-reconciliation.md`](../../concepts/eventid-and-reconciliation.md).

---

## Next

* [`examples/do-transaction.c`](./examples/do-transaction.c)
* [`examples/test-print.c`](./examples/test-print.c)
* [`examples/error-handling.c`](./examples/error-handling.c)
* [`examples/listener.c`](./examples/listener.c)
