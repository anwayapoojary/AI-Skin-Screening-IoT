#!/usr/bin/env python3
"""Read CRC-framed JPEG captures from ESP32 serial and upload them to FastAPI."""

from __future__ import annotations

import argparse
import json
import logging
import os
import secrets
import struct
import time
import urllib.error
import urllib.request
import zlib
from dataclasses import dataclass

FRAME_MARKER = b"\xA5\x5A\xC3\x3C"
MAX_FRAME_BYTES = 10 * 1024 * 1024
HEADER_SIZE = len(FRAME_MARKER) + 4
CRC_SIZE = 4
LOGGER = logging.getLogger("usb_bridge")


@dataclass
class FrameParser:
    max_frame_bytes: int = MAX_FRAME_BYTES

    def __post_init__(self) -> None:
        self.buffer = bytearray()
        self.errors: list[str] = []

    def feed(self, data: bytes) -> list[bytes]:
        self.buffer.extend(data)
        frames: list[bytes] = []
        while True:
            marker_index = self.buffer.find(FRAME_MARKER)
            if marker_index < 0:
                keep = len(FRAME_MARKER) - 1
                if len(self.buffer) > keep:
                    del self.buffer[:-keep]
                break
            if marker_index:
                del self.buffer[:marker_index]
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
                continue
            frames.append(image)
        return frames

    def finish(self) -> None:
        if self.buffer:
            raise TruncatedFrameError(
                f"serial stream ended with {len(self.buffer)} unparsed byte(s)"
            )


class TruncatedFrameError(ValueError):
    """Raised when the serial stream ends with an incomplete frame."""


def encode_frame(image: bytes) -> bytes:
    """Encode a JPEG using the firmware's marker/length/payload/CRC32 format."""
    if not image or len(image) > MAX_FRAME_BYTES:
        raise ValueError("image length must be between 1 byte and 10 MiB")
    return (
        FRAME_MARKER
        + struct.pack(">I", len(image))
        + image
        + struct.pack(">I", zlib.crc32(image) & 0xFFFFFFFF)
    )


def make_multipart(
    image: bytes,
    patient_id: int,
    device_id: str,
    boundary: str | None = None,
) -> tuple[bytes, str]:
    boundary = boundary or f"----usbbridge{secrets.token_hex(12)}"
    parts = [
        (
            f"--{boundary}\r\n"
            'Content-Disposition: form-data; name="patient_id"\r\n\r\n'
            f"{patient_id}\r\n"
        ).encode(),
        (
            f"--{boundary}\r\n"
            'Content-Disposition: form-data; name="source"\r\n\r\n'
            "usb\r\n"
        ).encode(),
        (
            f"--{boundary}\r\n"
            'Content-Disposition: form-data; name="device_id"\r\n\r\n'
            f"{device_id}\r\n"
        ).encode(),
        (
            f"--{boundary}\r\n"
            'Content-Disposition: form-data; name="file"; filename="capture.jpg"\r\n'
            "Content-Type: image/jpeg\r\n\r\n"
        ).encode()
        + image
        + b"\r\n",
        f"--{boundary}--\r\n".encode(),
    ]
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def upload_frame(
    endpoint: str,
    image: bytes,
    patient_id: int,
    device_id: str,
    retries: int,
    retry_delay: float,
    token: str | None = None,
) -> dict:
    body, content_type = make_multipart(image, patient_id, device_id)
    for attempt in range(retries + 1):
        request = urllib.request.Request(
            endpoint,
            data=body,
            headers={
                "Content-Type": content_type,
                **({"Authorization": f"Bearer {token}"} if token else {}),
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                result = json.loads(response.read())
            LOGGER.info("Uploaded screening %s from device %s", result.get("id"), device_id)
            return result
        except urllib.error.HTTPError as exc:
            response_body = exc.read().decode("utf-8", errors="replace")
            if exc.code < 500 or attempt >= retries:
                raise RuntimeError(f"Upload rejected ({exc.code}): {response_body}") from exc
            LOGGER.warning("Upload attempt %d failed (%s); retrying", attempt + 1, exc)
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt >= retries:
                raise RuntimeError(f"Upload failed after {attempt + 1} attempt(s): {exc}") from exc
            LOGGER.warning("Upload attempt %d failed (%s); retrying", attempt + 1, exc)
        time.sleep(retry_delay)
    raise RuntimeError("Upload retry loop exited unexpectedly")


def find_esp32_port() -> str | None:
    """Auto-detect FTDI / USB-UART serial port connected to ESP32."""
    try:
        import serial.tools.list_ports
    except ImportError:
        return None

    ports = list(serial.tools.list_ports.comports())
    if not ports:
        return None

    # Priority keywords for ESP32 / FTDI / USB-UART adapters
    keywords = ["ftdi", "ft232", "cp210", "ch340", "ch9102", "uart", "usb serial", "esp32", "silicon labs"]
    for p in ports:
        desc = f"{p.device} {p.description} {p.manufacturer or ''} {p.hwid or ''}".lower()
        if any(kw in desc for kw in keywords):
            return p.device

    # Fallback to the first available COM / serial port if only one is present
    if len(ports) == 1:
        return ports[0].device

    return ports[0].device


def run_bridge(args: argparse.Namespace) -> None:
    try:
        import serial
    except ImportError as exc:
        raise RuntimeError("Install the bridge dependency with: pip install pyserial") from exc

    parser = FrameParser()
    target_port = args.port

    while True:
        port_name = target_port
        if not port_name or port_name.lower() == "auto":
            port_name = find_esp32_port()
            if not port_name:
                LOGGER.info("Waiting for ESP32 / FT232RL USB adapter to be plugged in...")
                time.sleep(2.0)
                continue

        LOGGER.info(
            "Connecting to %s at %d baud (patient_id=%d, endpoint=%s)...",
            port_name,
            args.baud,
            args.patient_id,
            args.endpoint,
        )

        try:
            with serial.Serial(port_name, args.baud, timeout=0.2) as port:
                LOGGER.info("Connected to %s! Device is Online (press hardware button on ESP32 to capture).", port_name)
                parser.buffer.clear()
                while True:
                    chunk = port.read(max(1, port.in_waiting))
                    if chunk:
                        for image in parser.feed(chunk):
                            LOGGER.info("Received frame (%d bytes). Uploading to backend...", len(image))
                            try:
                                res = upload_frame(
                                    args.endpoint,
                                    image,
                                    args.patient_id,
                                    args.device_id,
                                    args.retries,
                                    args.retry_delay,
                                    args.token,
                                )
                                LOGGER.info("Uploaded successfully! Screening ID: %s", res.get("id"))
                            except Exception as upload_err:
                                LOGGER.error("Failed to upload frame: %s", upload_err)

                    while parser.errors:
                        LOGGER.error("Discarded serial frame: %s", parser.errors.pop(0))

        except (serial.SerialException, OSError) as exc:
            LOGGER.warning("Serial connection lost on %s: %s. Reconnecting...", port_name, exc)
            time.sleep(2.0)
            if target_port and target_port.lower() != "auto":
                # User specified exact port, keep trying it
                pass
            else:
                # Re-scan ports next iteration
                continue


def main() -> None:
    arg_parser = argparse.ArgumentParser(description=__doc__)
    arg_parser.add_argument(
        "--port",
        default="auto",
        help="USB serial port (e.g. COM5, /dev/ttyUSB0, or 'auto' to auto-detect)",
    )
    arg_parser.add_argument("--baud", type=int, default=921600)
    arg_parser.add_argument(
        "--endpoint",
        default="http://127.0.0.1:8000/api/device/upload",
    )
    arg_parser.add_argument(
        "--patient-id",
        type=int,
        default=1,
        help="Target patient ID for incoming captures (default: 1)",
    )
    arg_parser.add_argument("--device-id", default="DEVICE_001")
    arg_parser.add_argument(
        "--token",
        default=os.environ.get("DEVICE_TOKEN"),
        help="Bearer token; defaults to DEVICE_TOKEN environment variable",
    )
    arg_parser.add_argument("--retries", type=int, default=3)
    arg_parser.add_argument("--retry-delay", type=float, default=1.0)
    args = arg_parser.parse_args()
    if args.retries < 0 or args.retry_delay < 0:
        arg_parser.error("--retries and --retry-delay must be non-negative")
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    try:
        run_bridge(args)
    except KeyboardInterrupt:
        LOGGER.info("USB bridge stopped by user")
    except Exception as exc:
        LOGGER.error("%s", exc)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
