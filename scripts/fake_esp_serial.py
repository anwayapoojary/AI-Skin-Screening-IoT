#!/usr/bin/env python3
"""Emulate the ESP32 serial protocol on a COM port or a local TCP socket."""

from __future__ import annotations

import argparse
import io
import json
import logging
import socket
import time

if __package__:
    from .serial_bridge import encode_frame
else:
    from serial_bridge import encode_frame

LOGGER = logging.getLogger("fake_esp_serial")


def _test_jpeg(image_path: str | None) -> bytes:
    from PIL import Image, ImageDraw

    if image_path:
        with Image.open(image_path) as image:
            output = io.BytesIO()
            image.convert("RGB").save(output, format="JPEG", quality=85)
            return output.getvalue()
    image = Image.new("RGB", (256, 192), (190, 150, 125))
    draw = ImageDraw.Draw(image)
    draw.ellipse((72, 40, 184, 152), fill=(135, 83, 71), outline=(75, 48, 42), width=4)
    output = io.BytesIO()
    image.save(output, format="JPEG", quality=85)
    LOGGER.warning("Using a synthetic simulator image; it is not a real skin image.")
    return output.getvalue()


def _send(stream, payload: bytes) -> None:
    stream.write(payload)
    if hasattr(stream, "flush"):
        stream.flush()


def _read_line(stream, pending: bytearray) -> bytes | None:
    while b"\n" not in pending:
        chunk = stream.read(1)
        if not chunk:
            return None
        pending.extend(chunk)
    line, _, remainder = pending.partition(b"\n")
    pending[:] = remainder
    return bytes(line).strip()


def emulate(stream, image: bytes, device_id: str, capture_on_connect: bool) -> None:
    pending = bytearray()
    hello = {"type": "hello", "device_id": device_id, "fw": "fake-esp32-v1"}
    link_connected = False
    last_heartbeat = 0.0
    last_hello = 0.0
    capture = False
    LOGGER.info("Fake ESP connected as %s; retrying hello until acknowledged", device_id)
    while True:
        now = time.monotonic()
        if not link_connected and now - last_hello >= 2.5:
            _send(stream, (json.dumps(hello) + "\n").encode())
            last_hello = now
        if now - last_heartbeat >= 2.5:
            _send(stream, b'{"type":"heartbeat"}\n')
            last_heartbeat = now
        if capture_on_connect and link_connected and not capture:
            capture = True
        if capture:
            _send(stream, b'{"type":"capture_start"}\n' + encode_frame(image))
            LOGGER.info("Sent simulated capture (%d JPEG bytes)", len(image))
            capture = False
        line = _read_line(stream, pending)
        if line is None:
            time.sleep(0.02)
            continue
        try:
            message = json.loads(line)
        except json.JSONDecodeError:
            LOGGER.warning("Ignoring non-JSON host bytes: %r", line[:80])
            continue
        LOGGER.info("Host -> fake ESP: %s", message.get("type", "unknown"))
        if message.get("type") == "ack" and message.get("status") == "connected":
            link_connected = True
        elif message.get("type") == "capture_request":
            capture = True
        elif message.get("type") == "result":
            LOGGER.info(
                "OLED result simulation: %s (screening only; no diagnosis)",
                message.get("class", "Unavailable"),
            )
        elif message.get("type") == "ack" and message.get("status") == "resend":
            capture = True


class _SocketStream:
    def __init__(self, connection: socket.socket) -> None:
        self.connection = connection
        self.connection.settimeout(0.2)

    def write(self, data: bytes) -> int:
        self.connection.sendall(data)
        return len(data)

    def flush(self) -> None:
        return None

    def read(self, size: int) -> bytes:
        try:
            data = self.connection.recv(size)
            if not data:
                raise ConnectionError("bridge disconnected")
            return data
        except TimeoutError:
            return b""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", help="Virtual/physical serial port on the fake-device side")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--tcp-port", type=int, help="Listen on localhost using a TCP serial stream")
    parser.add_argument("--tcp-host", default="127.0.0.1")
    parser.add_argument("--image", help="Optional JPEG/PNG file to send; default is synthetic test data")
    parser.add_argument("--device-id", default="FAKE-ESP32-CAM")
    parser.add_argument("--capture-on-connect", action="store_true")
    args = parser.parse_args()
    if bool(args.port) == bool(args.tcp_port):
        parser.error("choose exactly one of --port or --tcp-port")
    if args.baud != 115200:
        parser.error("the serial protocol uses 115200 baud")
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    image = _test_jpeg(args.image)
    if args.port:
        try:
            import serial
        except ImportError as exc:
            raise SystemExit("Install bridge dependencies: pip install -r scripts/requirements-bridge.txt") from exc
        with serial.Serial(args.port, args.baud, timeout=0.2, write_timeout=2) as port:
            emulate(port, image, args.device_id, args.capture_on_connect)
        return

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server.bind((args.tcp_host, args.tcp_port))
        server.listen(1)
        LOGGER.info("Listening as virtual serial device at %s:%d", args.tcp_host, args.tcp_port)
        while True:
            connection, address = server.accept()
            LOGGER.info("Bridge connected from %s:%d", *address)
            with connection:
                try:
                    emulate(_SocketStream(connection), image, args.device_id, args.capture_on_connect)
                except (ConnectionError, OSError):
                    LOGGER.info("Bridge disconnected from fake serial device")


if __name__ == "__main__":
    main()
