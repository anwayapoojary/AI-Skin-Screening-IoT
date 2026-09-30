"""Named sensor interfaces only — no invented measurements or chip models."""

from hardware.drivers.device import Sensor, SensorSample


class TemperatureSensor(Sensor):
    name = "temperature"
    unit = "UNKNOWN — REQUIRES HARDWARE CONFIRMATION"

    def read(self) -> SensorSample:
        return SensorSample(name=self.name, value=None, unit=None, status="unavailable")


class HumiditySensor(Sensor):
    name = "humidity"
    unit = "UNKNOWN — REQUIRES HARDWARE CONFIRMATION"

    def read(self) -> SensorSample:
        return SensorSample(name=self.name, value=None, unit=None, status="unavailable")


class OtherHealthSensor(Sensor):
    name = "health_unspecified"
    unit = "UNKNOWN — REQUIRES HARDWARE CONFIRMATION"

    def read(self) -> SensorSample:
        return SensorSample(name=self.name, value=None, unit=None, status="unavailable")


class FutureSensor(Sensor):
    name = "future"
    unit = None

    def read(self) -> SensorSample:
        return SensorSample(name=self.name, value=None, unit=None, status="unavailable")
