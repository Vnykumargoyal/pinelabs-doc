export const transportsContent = `
# Transports

The SDK supports four transport mechanisms for communicating with a Pine Labs
terminal. You select the transport at construction time; the SDK's API is
identical regardless of transport.

---

## Transport overview

| Transport | Constant | Platforms | Notes |
|---|---|---|---|
| App-to-App (Intent) | \`APP_TO_APP\` | Android only | Requires MasterApp v3.4+ |
| Bluetooth BLE | \`BLE\` | Android, iOS | Terminal must support BLE |
| USB HID | \`USB\` | Android, Python, C | Requires USB host mode / permission |
| TCP/IP (REST) | \`TCP\` | All | Terminal must be on same LAN or VPN |

---

## App-to-App (Android only)

App-to-App is the **recommended** transport on Android. It delegates all
terminal communication to **MasterApp**, which runs on the same device and
owns the USB or BLE connection to the terminal.

### How it works

\`\`\`text
Your app ──(Intent)──► MasterApp ──(USB/BLE)──► Terminal
\`\`\`

### Prerequisites

- MasterApp >= 3.4 installed on the same device.
- Declare \`<queries>\` in your \`AndroidManifest.xml\` (Android 11+).

\`\`\`xml
<manifest>
  <queries>
    <package android:name="com.pinelabs.masterapp" />
  </queries>
</manifest>
\`\`\`

### Usage

\`\`\`kotlin
val sdk = PineBillingSdk(context, TransportOpt.APP_TO_APP)
\`\`\`

### Limitations

- Single transaction at a time (MasterApp enforces this).
- \`abortTransaction\` is best-effort; MasterApp may not honour it once the
  transaction is submitted to the acquirer.

---

## Bluetooth BLE

Use BLE when your application runs directly on a device that communicates
with the terminal over Bluetooth Low Energy.

### Prerequisites

- Terminal firmware >= 2.7 with BLE module enabled.
- \`BLUETOOTH_SCAN\` + \`BLUETOOTH_CONNECT\` permissions (Android 12+) or
  \`NSBluetoothAlwaysUsageDescription\` (iOS).

### Usage

\`\`\`kotlin
// Android
val sdk = PineBillingSdk(
    context,
    TransportOpt.BLE,
    SdkConfig(blePeripheralId = "AA:BB:CC:DD:EE:FF")
)
\`\`\`

\`\`\`swift
// iOS
let sdk = PineBillingSdk(transport: .ble(peripheralId: uuid))
\`\`\`

### Limitations

- BLE range: ~10 m line-of-sight.
- Higher latency (~200 ms overhead) vs. USB or A2A.
- Reconnect on range loss adds up to 30 s of delay.

---

## USB HID

USB HID is the preferred transport for desktop / server applications that are
physically connected to the terminal via USB.

### Usage

\`\`\`python
# Python
sdk = PineBillingSdk(transport=TransportOpt.USB, usb_path="/dev/hidraw0")
\`\`\`

\`\`\`c
// C
PineSdkHandle sdk = pine_sdk_create(PINE_TRANSPORT_USB, "/dev/hidraw0", 0, NULL);
\`\`\`

---

## TCP/IP (REST)

TCP/IP is the most flexible transport and works across platforms and network
topologies. The terminal exposes an HTTP REST endpoint.

### Usage

\`\`\`kotlin
// Android
val sdk = PineBillingSdk(
    context,
    TransportOpt.TCP,
    SdkConfig(tcpHost = "192.168.1.200", tcpPort = 9100)
)
\`\`\`

\`\`\`typescript
// Node.js
const sdk = new PineBillingSdk({ transport: "tcp", host: "192.168.1.200", port: 9100 });
\`\`\`

### Security note

The REST API does **not** use TLS in v1. Do not expose the terminal's REST
port to untrusted networks.

---

## Choosing a transport

\`\`\`text
Are you on Android?
  Yes → Use APP_TO_APP (simplest, no extra permissions)
  No
    Terminal physically connected via USB? → USB HID
    Terminal nearby (<10 m), no cable?     → BLE
    Terminal on the same network?          → TCP/IP
\`\`\`
`

