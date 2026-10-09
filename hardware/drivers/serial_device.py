"""Direct USB Serial driver for the ESP32-CAM (Plug-and-Play over USB).

Allows the ESP32-CAM to be plugged directly into the computer's USB port via
an FTDI adapter or ESP32-CAM-MB micro-USB baseboard without needing Wi-Fi.
Communicates via standard UART/COM port at 115200 baud.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Optional

try:
    import serial
    import serial.tools.list_ports
    HAS_SERIAL = True
except ImportError:
    HAS_SERIAL = False

from hardware.drivers.device import (
    CapturedImage,
    DeviceOfflineError,
    DeviceStatus,
    HealthScreeningDevice,
    SensorSample,
)
from hardware.protocols.constants import PROTOCOL_VERSION

logger = logging.getLogger(__name__)


class SerialHardwareDevice(HealthScreeningDevice):
    """Controls a physical ESP32-CAM directly connected via USB Serial COM port."""

    def __init__(self, device_id: str = "DEVICE_001", port: str = "AUTO", baudrate: int = 115200) -> None:
        self.device_id = device_id
        self.requested_port = port
        self.baudrate = baudrate
        self.port: Optional[str] = None
        self._ser: Optional[Any] = None
        self._display_state = "READY"
        self._last_seen: Optional[float] = None

    def _find_port(self) -> Optional[str]:
        if not HAS_SERIAL:
            return None
        if self.requested_port and self.requested_port.upper() != "AUTO":
            return self.requested_port
        ports = list(serial.tools.list_ports.comports())
        for p in ports:
            desc = (p.description or "").lower()
            # Common USB-to-UART chips on ESP32-CAM modules (CH340, CP210x, FTDI)
            if any(k in desc for k in ["ch340", "cp210", "ftdi", "usb serial", "uart", "esp32"]):
                return p.device
        if ports:
            return ports[0].device
        return None

    def is_connected(self) -> bool:
        return self._ser is not None and getattr(self._ser, "is_open", False)

    async def connect(self) -> None:
        if not HAS_SERIAL:
            raise DeviceOfflineError("pyserial is not installed in the python environment.")
        
        target_port = self._find_port()
        if not target_port:
            raise DeviceOfflineError(
                f"No USB serial COM port found for ESP32. "
                "Plug the ESP32-CAM into a USB port and verify it appears in Device Manager."
            )
        
        try:
            if self._ser and self._ser.is_open:
                self._ser.close()
            self._ser = serial.Serial(target_port, self.baudrate, timeout=3.0)
            self.port = target_port
            self._last_seen = time.time()
            time.sleep(0.5)  # Let connection settle
            # Flush existing buffer
            self._ser.reset_input_buffer()
            self._ser.write(b"CMD:PING\n")
            logger.info("Connected to ESP32 on USB port %s", target_port)
        except Exception as exc:
            self._ser = None
            raise DeviceOfflineError(f"Failed to open USB port {target_port}: {exc}") from exc

    async def disconnect(self) -> None:
        if self._ser and self._ser.is_open:
            try:
                self._ser.close()
            except Exception:
                pass
        self._ser = None

    async def get_status(self) -> DeviceStatus:
        online = self.is_connected()
        if not online:
            # Try opportunistic reconnect if a port is now available
            p = self._find_port()
            if p:
                try:
                    await self.connect()
                    online = self.is_connected()
                except Exception:
                    online = False

        return DeviceStatus(
            device_id=self.device_id,
            connected=online,
            state="READY" if online else "OFFLINE",
            camera_status="ok" if online else "unknown",
            sensor_status="unavailable",
            communication_status="usb_serial" if online else "disconnected",
            firmware_version="1.0.0-serial",
            protocol_version=PROTOCOL_VERSION,
            power_status="usb_5v" if online else None,
            last_communication=self._last_seen,
            display_state=self._display_state if online else "OFFLINE",
            extra={"port": self.port or "None", "connection": "direct_usb_serial"},
        )

    async def capture_image(
        self,
        patient_id: int | None = None,
        screening_id: int | None = None,
    ) -> CapturedImage:
        if not self.is_connected():
            await self.connect()
        if not self._ser:
            raise DeviceOfflineError("ESP32 USB connection is not open.")

        self._ser.reset_input_buffer()
        self._ser.write(b"CMD:CAPTURE\n")
        logger.info("Sent CMD:CAPTURE to USB ESP32 on %s", self.port)

        # Protocol expectation:
        # Device outputs: "IMG_BEGIN:<length>\n" followed by <length> bytes of JPEG, followed by "\nIMG_END\n"
        start_time = time.time()
        img_len = 0
        while time.time() - start_time < 5.0:
            line = self._ser.readline().decode("latin1", errors="ignore").strip()
            if line.startswith("IMG_BEGIN:"):
                try:
                    img_len = int(line.split(":")[1])
                    break
                except ValueError:
                    pass
            elif line.startswith("[BOOT]") or "camera" in line:
                continue

        if img_len <= 0:
            raise DeviceOfflineError("Timeout waiting for camera frame from USB ESP32.")

        # Read exact JPEG bytes
        jpeg_bytes = bytearray()
        bytes_remaining = img_len
        while bytes_remaining > 0 and (time.time() - start_time < 10.0):
            chunk = self._ser.read(min(bytes_remaining, 4096))
            if not chunk:
                break
            jpeg_bytes.extend(chunk)
            bytes_remaining -= len(chunk)

        if len(jpeg_bytes) < img_len:
            raise DeviceOfflineError(f"Incomplete frame received: {len(jpeg_bytes)}/{img_len} bytes.")

        self._last_seen = time.time()
        logger.info("Successfully read %d JPEG bytes from USB ESP32", len(jpeg_bytes))
        return CapturedImage(content=bytes(jpeg_bytes), mime_type="image/jpeg", source="device")

    async def read_sensors(self) -> list[SensorSample]:
        return []

    async def send_result(self, result: dict[str, Any]) -> None:
        if not self.is_connected():
            return
        pred = result.get("prediction", "RESULT")
        abstained = result.get("abstained", False)
        text = "RECHECK" if abstained else "RESULT AVAILABLE"
        await self.set_display(text)

    async def set_display(self, display_state: str) -> None:
        self._display_state = display_state
        if self.is_connected() and self._ser:
            try:
                cmd = f"CMD:DISPLAY:{display_state}\n".encode("utf-8")
                self._ser.write(cmd)
            except Exception:
                pass
