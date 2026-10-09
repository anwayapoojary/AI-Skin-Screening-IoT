# ESP32-CAM USB serial protocol

The USB link uses **115200 baud, 8 data bits, no parity, 1 stop bit (8N1)**.
Keep the rate at 115200: image frames are chunked, and 921600 baud has not been
validated on this board/adapter combination. The serial stream contains only
protocol JSON and binary frames. Do not print unprefixed debug text to it.

## JSON messages

Each JSON object is UTF-8 followed by LF (`\n`). The ESP32 sends:

```json
{"type":"hello","device_id":"ESP32CAM-001","fw":"usb-screening-1.0"}
{"type":"heartbeat"}
{"type":"capture_start"}
{"type":"error","msg":"Camera capture failed"}
```

The hello is sent on boot and retried while the bridge is not acknowledging the
link. Heartbeats are sent every 2.5 seconds. The bridge registers the device and
updates its heartbeat timestamp through the local FastAPI API.

The bridge may send these messages:

```json
{"type":"result","class":"<backend result>","confidence":0.0,"note":"Screening support only, not a diagnosis. Consult a doctor."}
{"type":"capture_request"}
{"type":"ack","status":"connected"}
{"type":"ack","status":"received"}
{"type":"ack","status":"resend"}
{"type":"error","msg":"Upload or screening failed"}
```

`confidence` is included only when returned by the configured model. A
`"model":"mock"` field may accompany a result from the mock screening model.
The device displays returned screening results as screening support, never as a
diagnosis. `capture_request` is optional and originates from the dashboard.

## JPEG frame format

A capture is sent immediately after its `capture_start` JSON line. Multi-byte
integers are unsigned, big-endian. CRC is IEEE CRC-32 (the `zlib.crc32`
convention) over the JPEG bytes only.

| Field | Size | Value |
|---|---:|---|
| Marker | 4 bytes | `A5 5A C3 3C` |
| JPEG length | 4 bytes | JPEG byte count; valid range 1–10 MiB |
| JPEG | length bytes | Complete JPEG image |
| CRC-32 | 4 bytes | IEEE CRC-32 of the JPEG |

The firmware writes frames in 1024-byte chunks at 115200 baud. The bridge
accepts partial serial reads, verifies the length and checksum, and rejects a
bad frame. On a CRC/length error it sends `{"type":"ack","status":"resend"}`;
the firmware retransmits the retained capture. A successful upload is followed
by a result and an `ack` with status `received`.

## Example simulator

After installing `scripts/requirements-bridge.txt`, a fake device can expose a
TCP serial stream on localhost (no virtual-COM driver required):

```powershell
python scripts\fake_esp_serial.py --tcp-port 8765 --capture-on-connect
python scripts\serial_bridge.py --port socket://127.0.0.1:8765
```

For a real COM-to-COM virtual cable, use a pair supplied by a virtual serial
driver and run the fake device on one COM endpoint and the bridge on the other.
