import pytest

from hardware.simulator.state_machine import DeviceStateMachine


def test_boot_connect_ready():
    sm = DeviceStateMachine()
    sm.transition("CONNECTING")
    sm.transition("READY")
    assert sm.state == "READY"


def test_illegal_transition():
    sm = DeviceStateMachine()
    with pytest.raises(ValueError):
        sm.transition("CAPTURING")
