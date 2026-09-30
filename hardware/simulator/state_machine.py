from __future__ import annotations

from hardware.protocols.constants import DEVICE_STATES, DISPLAY_STATES

ALLOWED = {
    "OFFLINE": {"CONNECTING", "OFFLINE"},
    "CONNECTING": {"READY", "ERROR", "OFFLINE"},
    "READY": {"CAPTURING", "PROCESSING", "OFFLINE", "ERROR"},
    "CAPTURING": {"TRANSFERRING", "ERROR", "OFFLINE"},
    "TRANSFERRING": {"PROCESSING", "READY", "ERROR", "OFFLINE"},
    "PROCESSING": {"READY", "ERROR", "OFFLINE"},
    "ERROR": {"READY", "OFFLINE", "CONNECTING"},
}


class DeviceStateMachine:
    def __init__(self) -> None:
        self.state = "OFFLINE"
        self.display_state = "ERROR"

    def transition(self, new_state: str) -> None:
        if new_state not in DEVICE_STATES:
            raise ValueError(f"Invalid state {new_state}")
        allowed = ALLOWED.get(self.state, set())
        if new_state != self.state and new_state not in allowed:
            raise ValueError(f"Illegal transition {self.state} -> {new_state}")
        self.state = new_state
        if new_state == "READY":
            self.display_state = "READY"
        elif new_state == "ERROR":
            self.display_state = "ERROR"

    def set_display(self, display_state: str) -> None:
        if display_state not in DISPLAY_STATES:
            raise ValueError(f"Invalid display state {display_state}")
        self.display_state = display_state
