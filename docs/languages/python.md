# Python — setup

> **v1 status: Preview.** The Python binding ships in a Phase 7
> milestone alongside Cloud REST and PADController support. The
> public surface is locked and matches the UDL.

The Pine Labs SDK for Python ships as a **wheel** containing the
Rust core (as a platform-specific shared library) and the
UniFFI-generated Python wrapper. Distribution is via the **Pinelabs
Developer Portal** — the SDK is **not** published to PyPI.

> **App-to-App is Android-only.** Your Python transport choices are
> **Cloud REST** and **PADController**.

---

## Prerequisites

| | Minimum | Tested |
|---|---|---|
| Python | 3.9 | 3.12 |
| OS / arch | Linux glibc 2.28+ x86_64 / aarch64; macOS 11+ x86_64 / arm64; Windows 10+ x86_64 | — |
| `pip` | 21.3 (PEP 660 editable installs) | latest |

---

## 1. Download and verify the wheel

1. Download from the Pinelabs Developer Portal:
   `pine_billing_sdk-<semver>-cp3X-cp3X-<platform>.whl`.
2. Each platform/python combo has its own wheel. The portal lists
   them grouped by release.
3. The release page also publishes:
   * `pine_billing_sdk-<semver>-cp3X-cp3X-<platform>.whl.sha256`
   * `pine_billing_sdk-<semver>-cp3X-cp3X-<platform>.whl.sig`
   * `docs/site/index.html` — these docs.
   * `README.md`, `CHANGELOG.md`.
4. Verify the checksum:
   ```bash
   sha256sum -c pine_billing_sdk-<semver>-cp3X-cp3X-<platform>.whl.sha256
   ```

---

## 2. Install with pip

```bash
python -m pip install ./pine_billing_sdk-<semver>-cp312-cp312-manylinux_2_28_x86_64.whl
```

If you maintain an internal artifact server, host the wheel there
and reference it via a private index URL — the SDK does not require
PyPI.

```bash
pip install --index-url https://artifacts.example/simple/ pine-billing-sdk
```

---

## 3. Verify the install

```python
from pine_billing_sdk import (
    PineBillingSdk, SdkConfig, LogLevel, TransportType
)

sdk = PineBillingSdk(
    config=SdkConfig(
        default_timeout_ms=60_000,
        log_level=LogLevel.INFO,
        transport=TransportType.CLOUD,
        app_to_app=None,
        application_id=None,
        cloud_base_url="https://uat.pinelabs.example",
        cloud_connect_timeout_ms=30_000,
        cloud_read_timeout_ms=60_000,
    ),
    app_to_app_bridge=None,
)

print("isConnected =", sdk.is_connected())
```

A successful import + construct confirms the wheel is correctly
installed.

---

## 4. Distribution channel reminder

The SDK is **not** on PyPI. `pip install pine-billing-sdk` against
the public PyPI index will fail. Always install from the wheel
file you downloaded from the Pinelabs Developer Portal (or your
internal mirror of it).

---

## 5. Threading

Python's GIL does not prevent the SDK from doing real I/O on a
worker thread; releasing the GIL is handled by the binding for
each blocking call. Always submit blocking SDK calls
(`cancel`, `check_status`, `connect`, `disconnect`, `ping`,
`run_self_test`, `get_logs`, `get_terminal_info`,
`set_transport`) to a worker thread:

```python
import asyncio

result = await asyncio.to_thread(sdk.check_status, event_id, options)
```

…or `concurrent.futures.ThreadPoolExecutor` if you are not on
asyncio.

---

## 6. Troubleshooting

| Symptom | Cause |
|---|---|
| `ImportError: pine_billing_sdk._uniffi … cannot find …so` | You installed the wheel for the wrong OS/arch. Pick the matching wheel from the portal. |
| `ImportError: GLIBC_2.28 not found` | Your distro is too old. The Linux wheels target manylinux 2.28; build from source against your toolchain or upgrade. |
| `ModuleNotFoundError: No module named 'pine_billing_sdk'` | The wheel installed into a different Python; check `python -V` matches `cp3X`. |

---

## Next

* [Quickstart →](./quickstart.md)
* [Examples →](./examples/)
* [Concepts →](../../concepts/)

---

# Python — quickstart (Cloud REST)

> **v1 status: Preview.** Ships in a Phase 7 milestone.

Run a Sale via the **Cloud REST** transport. App-to-App is
Android-only; for PADController on Python see the PADController
quickstart in the same milestone.

---

## 1. Construct the SDK once

```python
# pos/sdk_singleton.py
from pine_billing_sdk import (
    PineBillingSdk, SdkConfig, LogLevel, TransportType
)

_sdk = PineBillingSdk(
    config=SdkConfig(
        default_timeout_ms=60_000,
        log_level=LogLevel.INFO,
        transport=TransportType.CLOUD,
        app_to_app=None,
        application_id=None,
        cloud_base_url="https://uat.pinelabs.example",
        cloud_connect_timeout_ms=30_000,
        cloud_read_timeout_ms=60_000,
    ),
    app_to_app_bridge=None,
)

def get_sdk() -> PineBillingSdk:
    return _sdk
```

Construct once at import time and import `get_sdk()` everywhere.

---

## 2. Build the request

```python
from pine_billing_sdk import (
    TransactionRequest, TransactionType,
    TransportOptions, CloudTransactionOptions,
)

def sale_request(order_id: str, amount_paise: int) -> TransactionRequest:
    return TransactionRequest(
        amount=amount_paise,
        currency="INR",
        billing_ref_no=order_id,
        invoice_no=order_id,
        transaction_type=TransactionType.SALE,
        original_event_id=None,
        reference_id=None,
        metadata=None,
        merchant_id="MID-001",
        terminal_id="TID-A",
        allowed_payment_modes=None,                # ignored on Cloud
        transport_options=TransportOptions.CLOUD(
            CloudTransactionOptions(
                transaction_number=order_id,
                sequence_number="1",
                allowed_payment_mode="10",
                auto_cancel_duration_in_minutes=None,
                force_cancel_on_back=None,
                merchant_store_pos_code="POS-1",
            )
        ),
    )
```

Cloud requires the `TransportOptions.CLOUD` variant with non-None
`transaction_number` and `sequence_number`. Omitting either raises
`SdkError.InvalidInput` synchronously.

---

## 3. Submit and listen

```python
import threading
from pine_billing_sdk import (
    TransactionListener, TransactionResult, SdkError
)

class _Listener(TransactionListener):
    def __init__(self, order_id, on_approved, on_declined):
        self.order_id = order_id
        self.on_approved = on_approved
        self.on_declined = on_declined

    def on_started(self, event_id: str) -> None:
        # Persist BEFORE updating UI / web state.
        OpStore.started(self.order_id, event_id)

    def on_success(self, result: TransactionResult) -> None:
        OpStore.completed(self.order_id, result)
        self.on_approved(result)

    def on_failure(self, error: SdkError) -> None:
        OpStore.failed(self.order_id, error)
        self.on_declined(error)


def charge(sdk, order_id: str, amount_paise: int,
           on_approved, on_declined):
    def run():
        try:
            sdk.do_transaction(
                sale_request(order_id, amount_paise),
                _Listener(order_id, on_approved, on_declined),
            )
        except SdkError as e:
            on_declined(e)
    threading.Thread(target=run, name="pine-sdk-call", daemon=True).start()
```

> **Cloud `do_transaction` returns `Pending`.** On success
> `on_success` fires with `result.status = TransactionStatus.PENDING`
> and `result.transaction_id` set to the
> `PlutusTransactionReferenceID`. Drive the rest of the lifecycle
> via `check_status(event_id, options)` until the state moves to
> `Completed` or `Failed`.

---

## 4. asyncio variant

If your application is async, prefer `asyncio.to_thread` over
`threading.Thread` for the blocking calls:

```python
import asyncio

status = await asyncio.to_thread(
    sdk.check_status,
    transaction_id,
    CheckStatusOptions.CLOUD(
        CloudCheckStatusOptions(merchant_store_pos_code="POS-1")
    ),
)
```

`do_transaction` itself is non-blocking (it returns immediately
after synchronous validation), but its callbacks fire on an
SDK-internal thread. Use `asyncio.run_coroutine_threadsafe` from
within the listener if you want to bridge results back into your
event loop.

---

## 5. Reconciliation

After your process restarts with rows stuck in `Pending` /
`InFlight`, recover via:

```python
status = sdk.check_status(
    transaction_id,
    CheckStatusOptions.CLOUD(
        CloudCheckStatusOptions(merchant_store_pos_code="POS-1")
    ),
)
```

For other transports (PADController), `check_status` answers from
the SDK's in-memory registry and returns `OperationState.UNKNOWN`
for ids the SDK no longer has. See
[`docs/concepts/eventid-and-reconciliation.md`](../../concepts/eventid-and-reconciliation.md).

---

## Next

* [`examples/do_transaction.py`](./examples/do_transaction.py)
* [`examples/test_print.py`](./examples/test_print.py)
* [`examples/error_handling.py`](./examples/error_handling.py)
* [`examples/listener.py`](./examples/listener.py)
