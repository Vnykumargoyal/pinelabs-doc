export const pythonSetup = `
# Python — Setup

> **v1 status: Preview.** Full release in Phase 7.

The Python SDK is distributed as a PyPI package.

---

## Prerequisites

| Requirement | Minimum |
|---|---|
| Python | 3.10 |
| pip | 23.0 |

---

## Install

\`\`\`bash
pip install pine-billing-sdk
\`\`\`

For USB transport, install the optional extra:

\`\`\`bash
pip install pine-billing-sdk[usb]
\`\`\`

---

## Verify

\`\`\`python
import pine_billing_sdk
print(pine_billing_sdk.__version__)
# 1.0.0
\`\`\`
`

export const pythonQuickstart = `
# Python — Quickstart

> **v1 status: Preview.** Full release in Phase 7.

---

## 1. Create the SDK

\`\`\`python
from pine_billing_sdk import PineBillingSdk, TransportOpt

sdk = PineBillingSdk(transport=TransportOpt.TCP, host="192.168.1.100", port=9100)
\`\`\`

---

## 2. Build a request

\`\`\`python
from pine_billing_sdk import TransactionRequest, TransactionType

request = TransactionRequest(
    transaction_type=TransactionType.SALE,
    amount=50000   # Rs.500.00 in paise
)
\`\`\`

---

## 3. Run the transaction

\`\`\`python
import threading

def on_started(event_id: str):
    db.save(event_id, "PENDING")

def on_success(result):
    db.update(result.event_id, "SUCCESS")
    print(f"Approved: {result.approval_code}")

def on_failure(error):
    print(f"Error: {error.code} — {error.message}")

t = threading.Thread(
    target=sdk.do_transaction,
    args=(request,),
    kwargs={"on_started": on_started, "on_success": on_success, "on_failure": on_failure}
)
t.start()
t.join()
\`\`\`
`

export const pythonDoTransaction = `
"""
Pine Labs SDK — Python example: do_transaction (Sale via TCP)
v1 status: Preview. Ships in a Phase 7 milestone.
"""

from __future__ import annotations

import threading
from typing import Callable

from pine_billing_sdk import (
    PineBillingSdk,
    TransactionRequest,
    TransactionType,
    TransactionListener,
    TransactionResult,
    TransportOpt,
    SdkError,
)


def do_sale(
    sdk: PineBillingSdk,
    amount_paise: int,
    on_done: Callable[[TransactionResult | SdkError], None],
) -> None:
    request = TransactionRequest(
        transaction_type=TransactionType.SALE,
        amount=amount_paise,
    )

    pending_event_id: list[str] = []

    class _Listener(TransactionListener):
        def on_started(self, event_id: str) -> None:
            pending_event_id.append(event_id)
            db.save(event_id=event_id, status="PENDING")

        def on_success(self, result: TransactionResult) -> None:
            db.update(event_id=result.event_id, status="SUCCESS")
            on_done(result)

        def on_failure(self, error: SdkError) -> None:
            if pending_event_id:
                db.update(event_id=pending_event_id[0], status="FAILED")
            on_done(error)

    sdk.do_transaction(request, _Listener())


if __name__ == "__main__":
    done = threading.Event()
    sdk = PineBillingSdk(transport=TransportOpt.TCP, host="192.168.1.100", port=9100)

    def handle_result(outcome: TransactionResult | SdkError) -> None:
        if isinstance(outcome, TransactionResult):
            print(f"Approved: {outcome.approval_code}  RRN: {outcome.rrn}")
        else:
            print(f"Failed: {outcome.code}  {outcome.message}")
        done.set()

    do_sale(sdk, amount_paise=50_000, on_done=handle_result)
    done.wait(timeout=120)
`

export const pythonTestPrint = `
"""
Pine Labs SDK — Python testPrint example
v1 status: Preview.
"""

from pine_billing_sdk import PineBillingSdk, PrintListener, SdkError


def run_test_print(sdk: PineBillingSdk) -> None:
    lines = [
        "================================",
        "     PINE LABS PRINTER TEST     ",
        "================================",
        "Python SDK preview",
        "================================",
    ]

    class _L(PrintListener):
        def on_success(self) -> None:
            print("Print OK")

        def on_failure(self, error: SdkError) -> None:
            print(f"Print failed: {error.message}")

    sdk.test_print(lines, _L())
`

export const pythonErrorHandling = `
"""
Pine Labs SDK — Python error handling example
v1 status: Preview.
"""

from __future__ import annotations
import time
from pine_billing_sdk import (
    PineBillingSdk, SdkError, ErrorCode,
    TransactionRequest, TransactionResult, TransactionListener
)


class RetryingListener(TransactionListener):
    def __init__(self, sdk: PineBillingSdk, request: TransactionRequest, max_retries: int = 3):
        self._sdk = sdk
        self._request = request
        self._max_retries = max_retries
        self._attempt = 0

    def on_started(self, event_id: str) -> None:
        print(f"Started: {event_id}")

    def on_success(self, result: TransactionResult) -> None:
        print(f"Success: {result.approval_code}")

    def on_failure(self, error: SdkError) -> None:
        if error.code == ErrorCode.DECLINED:
            print("Card declined — no retry")
            return

        if error.retryable and self._attempt < self._max_retries:
            self._attempt += 1
            delay = self._attempt ** 2
            print(f"Retrying in {delay}s (attempt {self._attempt})...")
            time.sleep(delay)
            self._sdk.do_transaction(self._request, self)
        else:
            print(f"Failed after {self._attempt} attempts: {error.message}")
`

export const pythonListener = `
"""
Pine Labs SDK — Python listener example
v1 status: Preview.
"""

from pine_billing_sdk import TransactionListener, TransactionResult, SdkError
import logging

logger = logging.getLogger(__name__)


class LoggingTransactionListener(TransactionListener):
    """A reusable listener that logs all events."""

    def __init__(self, label: str = "txn"):
        self._label = label
        self._event_id: str | None = None

    def on_started(self, event_id: str) -> None:
        self._event_id = event_id
        logger.info(f"[{self._label}] started event_id={event_id}")

    def on_success(self, result: TransactionResult) -> None:
        logger.info(
            f"[{self._label}] success event_id={result.event_id} "
            f"approval={result.approval_code} rrn={result.rrn}"
        )

    def on_failure(self, error: SdkError) -> None:
        logger.warning(
            f"[{self._label}] failure event_id={self._event_id} "
            f"code={error.code} retryable={error.retryable} msg={error.message}"
        )
`

