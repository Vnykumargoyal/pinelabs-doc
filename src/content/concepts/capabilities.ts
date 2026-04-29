export const capabilitiesContent = `
# Capability Matrix

Not every transport supports every feature. This page lists which features are
available on each transport and platform.

---

## Feature matrix

| Feature | APP_TO_APP | BLE | USB | TCP |
|---|---|---|---|---|
| \`doTransaction\` (Sale) | ✅ | ✅ | ✅ | ✅ |
| \`doTransaction\` (Refund) | ✅ | ✅ | ✅ | ✅ |
| \`doTransaction\` (Void) | ✅ | ✅ | ✅ | ✅ |
| \`doTransaction\` (Auth/Capture) | ✅ | ✅ | ✅ | ✅ |
| \`testPrint\` | ✅ | ❌ | ✅ | ✅ |
| \`getStatus\` | ✅ | ✅ | ✅ | ✅ |
| \`abortTransaction\` | ⚠️ best-effort | ✅ | ✅ | ✅ |
| Receipt CSV download | ✅ | ❌ | ✅ | ✅ |
| Offline queuing | ❌ | ❌ | ❌ | ❌ |
| Multi-terminal routing | ❌ | ❌ | ❌ | ✅ |

---

## Platform matrix

| Platform | APP_TO_APP | BLE | USB | TCP |
|---|---|---|---|---|
| Android | ✅ | ✅ | ✅ | ✅ |
| iOS | ❌ | ✅ | ❌ | ✅ |
| Python | ❌ | ❌ | ✅ | ✅ |
| Node.js | ❌ | ❌ | ✅ | ✅ |
| C / C++ | ❌ | ❌ | ✅ | ✅ |

---

## Notes

### \`testPrint\` over BLE

BLE does not expose the printer endpoint in v1 firmware. Use USB or TCP if
you need to test the printer on a non-Android device.

### \`abortTransaction\` on APP_TO_APP

MasterApp owns the transaction once submitted. The SDK sends the abort
Intent, but MasterApp may ignore it if the transaction is already with the
acquirer. Always reconcile using \`event_id\` after an abort attempt.

### Multi-terminal routing (TCP only)

You can specify a \`terminalId\` in \`SdkConfig.tcpTerminalId\` when using TCP.
The terminal gateway will route the request to the correct physical terminal.
This is useful for a server process managing a fleet of terminals.
`

