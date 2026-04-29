export const csvContent = `
# CSV Format

The terminal's TCP and USB transports can return a raw CSV record alongside the
structured \`TransactionResult\`. This page documents the CSV column layout.

---

## Column layout

| # | Column name | Example | Notes |
|---|---|---|---|
| 1 | \`event_id\` | \`3fa85f64-...\` | UUID v4 |
| 2 | \`terminal_id\` | \`TID001\` | |
| 3 | \`merchant_id\` | \`MID12345\` | |
| 4 | \`transaction_type\` | \`SALE\` | SALE / REFUND / VOID / AUTH / CAPTURE |
| 5 | \`amount\` | \`50000\` | In paise |
| 6 | \`currency\` | \`INR\` | ISO 4217 |
| 7 | \`approval_code\` | \`AUTH123\` | |
| 8 | \`rrn\` | \`123456789012\` | 12-digit RRN |
| 9 | \`card_scheme\` | \`VISA\` | Blank for UPI |
| 10 | \`masked_pan\` | \`****1234\` | |
| 11 | \`cardholder_name\` | \`JOHN DOE\` | May be blank |
| 12 | \`mid\` | \`MID12345\` | |
| 13 | \`tid\` | \`TID001\` | |
| 14 | \`timestamp\` | \`2024-01-15T10:30:00Z\` | ISO 8601 UTC |
| 15 | \`status\` | \`SUCCESS\` | SUCCESS / FAILED / PENDING |

---

## Example record

\`\`\`csv
event_id,terminal_id,merchant_id,transaction_type,amount,currency,approval_code,rrn,card_scheme,masked_pan,cardholder_name,mid,tid,timestamp,status
3fa85f64-5717-4562-b3fc-2c963f66afa6,TID001,MID12345,SALE,50000,INR,AUTH123,123456789012,VISA,****1234,JOHN DOE,MID12345,TID001,2024-01-15T10:30:00Z,SUCCESS
\`\`\`

---

## Encoding

- UTF-8 encoding.
- Fields with commas or quotes are double-quoted.
- Empty fields are represented as two consecutive commas.

---

## Downloading CSV records

\`\`\`http
GET /api/v1/reconcile?from=2024-01-01&to=2024-01-31&format=csv
Authorization: Bearer <token>
\`\`\`
`

export const padControllerContent = `
# PAD Controller Frame

The Pine Labs terminal uses a proprietary binary protocol called the
**PAD Controller** (Payment Authorisation Device Controller) frame format
for USB HID and BLE transports.

> **Note:** You do not need to understand this format to use the SDK.
> This document is for advanced integrators who need to implement a custom
> transport or debug raw communication.

---

## Frame structure

\`\`\`text
Offset  Length  Field         Description
0       1       STX           Start of frame (0x02)
1       2       Length        Big-endian uint16: length of Data field
3       1       Command       Command byte (see table below)
4       N       Data          Command-specific payload
4+N     2       CRC16         CRC-16/CCITT of bytes 0..(4+N-1)
4+N+2   1       ETX           End of frame (0x03)
\`\`\`

---

## Command codes

| Code | Direction | Name | Description |
|---|---|---|---|
| \`0x10\` | Host to Terminal | \`CMD_SALE\` | Initiate sale transaction |
| \`0x11\` | Host to Terminal | \`CMD_REFUND\` | Initiate refund |
| \`0x12\` | Host to Terminal | \`CMD_VOID\` | Void a transaction |
| \`0x20\` | Host to Terminal | \`CMD_TEST_PRINT\` | Drive printer |
| \`0x30\` | Host to Terminal | \`CMD_GET_STATUS\` | Query terminal status |
| \`0x31\` | Host to Terminal | \`CMD_ABORT\` | Abort in-flight transaction |
| \`0x80\` | Terminal to Host | \`RESP_ACK\` | Request accepted (echoes event_id) |
| \`0x81\` | Terminal to Host | \`RESP_NACK\` | Request rejected |
| \`0x82\` | Terminal to Host | \`RESP_RESULT\` | Final transaction result |
| \`0x83\` | Terminal to Host | \`RESP_STATUS\` | Status response |

---

## Sale frame example

Request frame for a Rs.500.00 (50000 paise) sale:

\`\`\`text
02                        STX
00 3A                     Length = 58 bytes
10                        CMD_SALE
{payload bytes}           JSON-encoded TransactionRequest
{CRC high} {CRC low}      CRC16
03                        ETX
\`\`\`

### Payload (JSON)

\`\`\`json
{
  "event_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "transaction_type": "SALE",
  "amount": 50000,
  "currency": "INR"
}
\`\`\`

---

## CRC calculation

Uses CRC-16/CCITT (polynomial \`0x1021\`, initial value \`0xFFFF\`):

\`\`\`python
def crc16_ccitt(data: bytes) -> int:
    crc = 0xFFFF
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = (crc << 1) ^ 0x1021
            else:
                crc <<= 1
        crc &= 0xFFFF
    return crc
\`\`\`
`

