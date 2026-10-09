#!/usr/bin/env python3
"""Bridge ESP32-CAM USB serial messages and JPEG frames to the local API."""

from __future__ import annotations

import argparse
import json
import logging
import os
from pathlib import Path
import struct
import threading
import time
import zlib

LOGGER = logging.getLogger("serial_bridge")
FRAME_MARKER = b"\xA5\x5A\xC3\x3C"
MAX_FRAME_BYTES = 10 * 1024 * 1024
HEADER_SIZE = len(FRAME_MARKER) + 4
CRC_SIZE = 4
SCREENING_NOTE = "Screening support only, not a diagnosis. Consult a doctor."


class SerialProtocolParser:
    """Decode JSON lines and CRC32-framed JPEGs from one mixed serial stream."""

    def __init__(self, max_frame_bytes: int = MAX_FRAME_BYTES) -> None:
        self.buffer = bytearray()
        self.line_buffer = bytearray()
        self.max_frame_bytes = max_frame_bytes
        self.errors: list[str] = []

    def _consume_lines(self, data: bytes, messages: list[dict]) -> None:
        self.line_buffer.extend(data)
        while b"\n" in self.line_buffer:
            line, _, remainder = self.line_buffer.partition(b"\n")
            self.line_buffer = bytearray(remainder)
            line = line.strip()
            if not line:
                continue
            try:
                message = json.loads(line.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                LOGGER.debug("Ignoring non-protocol serial line: %r", line[:120])
                continue
            if isinstance(message, dict) and isinstance(message.get("type"), str):
                messages.append(message)
            else:
                LOGGER.warning("Ignoring serial JSON without a message type")

    def feed(self, data: bytes) -> tuple[list[dict], list[bytes]]:
        self.buffer.extend(data)
        messages: list[dict] = []
        images: list[bytes] = []
        while self.buffer:
            marker_index = self.buffer.find(FRAME_MARKER)
            if marker_index == 0:
                if len(self.buffer) < HEADER_SIZE:
                    break
                (length,) = struct.unpack_from(">I", self.buffer, len(FRAME_MARKER))
                if length == 0 or length > self.max_frame_bytes:
                    self.errors.append(f"invalid frame length: {length}")
                    del self.buffer[0]
                    continue
                frame_size = HEADER_SIZE + length + CRC_SIZE
                if len(self.buffer) < frame_size:
                    break
                payload_start = HEADER_SIZE
                payload_end = payload_start + length
                image = bytes(self.buffer[payload_start:payload_end])
                (expected_crc,) = struct.unpack_from(">I", self.buffer, payload_end)
                del self.buffer[:frame_size]
                actual_crc = zlib.crc32(image) & 0xFFFFFFFF
                if actual_crc != expected_crc:
                    self.errors.append(
                        f"CRC mismatch: expected {expected_crc:08x}, got {actual_crc:08x}"
                    )
                else:
                    images.append(image)
                continue

            if marker_index > 0:
                self._consume_lines(bytes(self.buffer[:marker_index]), messages)
                del self.buffer[:marker_index]
                continue

            # Keep enough bytes to recognize a marker split over serial reads.
            safe_length = max(0, len(self.buffer) - len(FRAME_MARKER) + 1)
            if safe_length == 0:
                break
            safe_data = bytes(self.buffer[:safe_length])
            self._consume_lines(safe_data, messages)
            del self.buffer[:safe_length]
            if b"\n" not in safe_data and len(self.line_buffer) > 4096:
                self.errors.append("protocol line exceeds 4096 bytes")
                self.line_buffer.clear()
        return messages, images


def encode_frame(image: bytes) -> bytes:
    if not image or len(image) > MAX_FRAME_BYTES:
        raise ValueError("image length must be between 1 byte and 10 MiB")
    return (
        FRAME_MARKER
        + struct.pack(">I", len(image))
        + image
        + struct.pack(">I", zlib.crc32(image) & 0xFFFFFFFF)
    )


def _load_dotenv(path: Path = Path(".env")) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        key, separator, value = line.partition("=")
        key = key.strip()
        if separator and key and not key.startswith("#"):
            os.environ.setdefault(key, value.strip().strip("\"'"))


def detect_port(
    explicit_port: str | None,
    serial_module=None,
    baud: int = 115200,
) -> str | None:
    if explicit_port and explicit_port.lower() != "auto":
        return explicit_port
    try:
        from serial.tools import list_ports
    except ImportError as exc:
        raise RuntimeError("Install bridge dependencies: pip install -r scripts/requirements-bridge.txt") from exc

    ports = list(list_ports.comports())
    matching = []
    for port in ports:
        description = " ".join(
            filter(None, [port.description, port.manufacturer, port.hwid])
        ).lower()
        if (port.vid, port.pid) in {(0x0403, 0x6001), (0x0403, 0x6015)} or any(
            name in description for name in ("ftdi", "ft232", "ft232rl")
        ):
            matching.append(port.device)
    if len(matching) == 1:
        return matching[0]
    candidates = matching or [port.device for port in ports]
    if serial_module is not None:
        for candidate in candidates:
            try:
                with serial_module.Serial(candidate, baudrate=baud, timeout=0.2) as port:
                    deadline = time.monotonic() + 3.5
                    while time.monotonic() < deadline:
                        line = port.readline()
                        if not line:
                            continue
                        try:
                            message = json.loads(line.decode("utf-8").strip())
                        except (UnicodeDecodeError, json.JSONDecodeError):
                            continue
                        if message.get("type") == "hello" and message.get("device_id"):
                            LOGGER.info("Found ESP32 hello handshake on %s", candidate)
                            return candidate
            except Exception as exc:
                LOGGER.debug("Could not probe serial port %s: %s", candidate, exc)
    return None


class BridgeRuntime:
    def __init__(self, args: argparse.Namespace, http=None) -> None:
        try:
            import requests
        except ImportError as exc:
            raise RuntimeError("Install bridge dependencies: pip install -r scripts/requirements-bridge.txt") from exc
        self.args = args
        self.http = http or requests.Session()
        self.parser = SerialProtocolParser()
        self.device_id: str | None = None
        self.firmware = "unknown"
        self.port_name: str | None = None
        self.last_heartbeat = 0.0
        self.last_capture_poll = 0.0
        self.last_poll_error = 0.0

    @property
    def api(self) -> str:
        return f"{self.args.backend_url.rstrip('/')}/api/v1"

    def _headers(self) -> dict[str, str]:
        if not self.args.token:
            return {}
        return {
            "X-Device-Token": self.args.token,
            "Authorization": f"Bearer {self.args.token}",
        }

    def _request(self, method: str, url: str, **kwargs):
        headers = dict(kwargs.pop("headers", {}))
        headers.update(self._headers())
        response = self.http.request(method, url, headers=headers, timeout=10, **kwargs)
        response.raise_for_status()
        return response

    def register(self, port_name: str) -> bool:
        if not self.device_id:
            return False
        try:
            response = self._request(
                "POST",
                f"{self.api}/devices/register",
                json={
                    "device_id": self.device_id,
                    "fw": self.firmware,
                    "transport": "USB serial",
                    "port": port_name,
                },
            )
            LOGGER.info("Registered device %s on %s", self.device_id, port_name)
            return response.json().get("online") is True
        except Exception as exc:
            LOGGER.error("Could not register device %s: %s", self.device_id, exc)
            return False

    def _heartbeat(self) -> None:
        if not self.device_id:
            LOGGER.warning("Ignoring heartbeat received before hello")
            return
        try:
            self._request(
                "POST",
                f"{self.api}/devices/heartbeat",
                json={
                    "device_id": self.device_id,
                    "transport": "USB serial",
                    "port": self.port_name,
                },
            )
            LOGGER.info("Heartbeat forwarded: %s", self.device_id)
        except Exception as exc:
            LOGGER.error("Could not forward heartbeat for %s: %s", self.device_id, exc)
            self.register(self.port_name or "unknown")

    def _send_json(self, port, message: dict) -> None:
        port.write((json.dumps(message, separators=(",", ":")) + "\n").encode("utf-8"))
        port.flush()

    def _handle_message(self, port, port_name: str, message: dict) -> None:
        kind = message["type"]
        if kind == "hello":
            self.device_id = str(message.get("device_id", "")).strip()
            self.firmware = str(message.get("fw") or "unknown")
            if not self.device_id:
                LOGGER.error("Device hello did not contain a device_id")
                self.device_id = None
                return
            LOGGER.info("Device hello: id=%s firmware=%s", self.device_id, self.firmware)
            self.register(port_name)
            self._send_json(port, {"type": "ack", "status": "connected"})
        elif kind == "heartbeat":
            self._heartbeat()
            self._send_json(port, {"type": "ack", "status": "connected"})
        elif kind == "capture_start":
            LOGGER.info("Capture started by %s", self.device_id or "unregistered device")
        elif kind == "error":
            LOGGER.error("Device reported error: %s", message.get("msg", "unspecified"))
        elif kind == "ack":
            LOGGER.info("Device acknowledged host message: %s", message.get("status", "ack"))
        else:
            LOGGER.warning("Ignoring unknown device message type %r", kind)

    def _handle_image(self, port, image: bytes) -> None:
        if not self.device_id:
            LOGGER.error("Received image before device hello; refusing upload")
            self._send_json(port, {"type": "ack", "status": "resend"})
            return
        LOGGER.info("Received CRC-verified JPEG (%d bytes); uploading", len(image))
        try:
            response = self._request(
                "POST",
                f"{self.api}/devices/{self.device_id}/capture",
                data={"patient_id": str(self.args.patient_id)},
                files={"file": ("capture.jpg", image, "image/jpeg")},
            )
            screening = response.json()
            result_message = {
                "type": "result",
                "class": screening.get("prediction") or "Unavailable",
                "note": SCREENING_NOTE,
            }
            if screening.get("confidence") is not None:
                result_message["confidence"] = screening["confidence"]
            if screening.get("is_mock"):
                result_message["model"] = "mock"
            self._send_json(port, result_message)
            self._send_json(port, {"type": "ack", "status": "received"})
            LOGGER.info(
                "Screening %s returned to device (model=%s, class=%s)",
                screening.get("id"),
                "mock" if screening.get("is_mock") else "real",
                screening.get("prediction") or "Unavailable",
            )
        except Exception as exc:
            LOGGER.error("Image upload/screening failed: %s", exc)
            self._send_json(port, {"type": "error", "msg": "Upload or screening failed"})

    def _poll_capture(self, port) -> None:
        if not self.device_id:
            return
        try:
            response = self._request(
                "GET", f"{self.api}/devices/{self.device_id}/capture/request"
            )
            self.last_poll_error = 0.0
            if response.json().get("capture_requested"):
                LOGGER.info("Dashboard capture request received; asking device to capture")
                self._send_json(port, {"type": "capture_request"})
        except Exception as exc:
            now = time.monotonic()
            if now - self.last_poll_error >= 5:
                LOGGER.warning("Capture request poll failed: %s", exc)
                self.last_poll_error = now

    def handle_bytes(self, port, port_name: str, data: bytes) -> None:
        messages, images = self.parser.feed(data)
        for message in messages:
            self._handle_message(port, port_name, message)
        while self.parser.errors:
            error = self.parser.errors.pop(0)
            LOGGER.error("Rejected serial frame: %s; requesting resend", error)
            self._send_json(port, {"type": "ack", "status": "resend"})
        for image in images:
            self._handle_image(port, image)

    def run_port(self, port, port_name: str, stop_event: threading.Event | None = None) -> None:
        LOGGER.info("Serial link open: %s at %d baud", port_name, self.args.baud)
        self.parser = SerialProtocolParser()
        self.device_id = None
        self.port_name = port_name
        while stop_event is None or not stop_event.is_set():
            available = port.in_waiting
            chunk = port.read(min(available, 65536) if available else 4096)
            if chunk:
                self.handle_bytes(port, port_name, chunk)
            now = time.monotonic()
            if self.device_id and now - self.last_capture_poll >= self.args.capture_poll_seconds:
                self._poll_capture(port)
                self.last_capture_poll = now
            if stop_event is not None and stop_event.wait(0.01):
                return


def run_bridge(args: argparse.Namespace, stop_event: threading.Event | None = None) -> None:
    try:
        import serial
    except ImportError as exc:
        raise RuntimeError("Install bridge dependencies: pip install -r scripts/requirements-bridge.txt") from exc
    bridge = BridgeRuntime(args)
    last_missing_port_log = 0.0
    while stop_event is None or not stop_event.is_set():
        port_name = detect_port(args.port, serial, args.baud)
        if not port_name:
            now = time.monotonic()
            if now - last_missing_port_log >= 10:
                LOGGER.error(
                    "No FTDI serial port or ESP32 hello handshake found. "
                    "Check the FTDI VCP driver and adapter connection; will retry."
                )
                last_missing_port_log = now
            if stop_event is not None and stop_event.wait(2):
                return
            time.sleep(0 if stop_event else 2)
            continue
        try:
            with serial.serial_for_url(
                port_name,
                baudrate=args.baud,
                timeout=0.2,
                write_timeout=2,
            ) as port:
                bridge.run_port(port, port_name, stop_event)
        except (serial.SerialException, OSError) as exc:
            LOGGER.warning("Serial link lost on %s: %s; rescanning for reconnect", port_name, exc)
        if stop_event is not None and stop_event.wait(2):
            return
        if stop_event is None:
            time.sleep(2)


def main() -> None:
    _load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", default=os.getenv("SERIAL_PORT", "auto"), help="COM port or auto")
    parser.add_argument("--baud", type=int, default=int(os.getenv("SERIAL_BAUD", "115200")))
    parser.add_argument(
        "--backend-url",
        default=os.getenv("BACKEND_URL", "http://127.0.0.1:8000"),
        help="Base URL for the local FastAPI backend",
    )
    parser.add_argument("--patient-id", type=int, default=int(os.getenv("PATIENT_ID", "1")))
    parser.add_argument("--token", default=os.getenv("DEVICE_TOKEN", ""))
    parser.add_argument("--capture-poll-seconds", type=float, default=1.0)
    args = parser.parse_args()
    if args.baud != 115200:
        parser.error("Serial protocol baud is fixed at 115200 for reliable chunked image transfer")
    if args.patient_id <= 0 or args.capture_poll_seconds <= 0:
        parser.error("--patient-id and --capture-poll-seconds must be positive")
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    try:
        run_bridge(args)
    except KeyboardInterrupt:
        LOGGER.info("USB serial bridge stopped")
    except Exception as exc:
        LOGGER.error("USB serial bridge stopped: %s", exc)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
