from abc import ABC, abstractmethod
from dataclasses import dataclass

from backend.app.config import settings


@dataclass(frozen=True)
class DeviceUpload:
    source: str
    device_id: str
    device_type: str
    connection_status: str


class DeviceAdapter(ABC):
    source: str
    device_type: str

    @abstractmethod
    def prepare_upload(self, device_id: str) -> DeviceUpload:
        if not device_id or len(device_id) > 64:
            raise ValueError("device_id must contain 1 to 64 characters")
        return DeviceUpload(
            source=self.source,
            device_id=device_id,
            device_type=self.device_type,
            connection_status=f"{self.source.upper()}_UPLOAD_RECEIVED",
        )


class WifiAdapter(DeviceAdapter):
    source = "wifi"
    device_type = "esp32-cam-wifi"

    def prepare_upload(self, device_id: str) -> DeviceUpload:
        return super().prepare_upload(device_id)


class UsbSerialAdapter(DeviceAdapter):
    source = "usb"
    device_type = "esp32-cam-usb-serial"

    def prepare_upload(self, device_id: str) -> DeviceUpload:
        return super().prepare_upload(device_id)


class SimulatedAdapter(DeviceAdapter):
    source = "simulated"
    device_type = "simulator"

    def prepare_upload(self, device_id: str) -> DeviceUpload:
        return super().prepare_upload(device_id)


_ADAPTERS: dict[str, type[DeviceAdapter]] = {
    "wifi": WifiAdapter,
    "usb": UsbSerialAdapter,
    "simulated": SimulatedAdapter,
}


def get_device_adapter(source: str | None = None) -> DeviceAdapter:
    selected_source = source or settings.device_transport
    adapter_type = _ADAPTERS.get(selected_source)
    if adapter_type is None:
        raise ValueError(f"Unsupported device transport: {selected_source}")
    return adapter_type()
