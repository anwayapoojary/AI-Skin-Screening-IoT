from hardware.protocols.schema import DeviceEnvelope, make_envelope


def test_envelope_roundtrip():
    env = make_envelope("DEVICE_001", "HEARTBEAT", {"ok": True})
    parsed = DeviceEnvelope.model_validate_json(env.model_dump_json())
    assert parsed.protocol_version == "1.0"
    assert parsed.message_type == "HEARTBEAT"


def test_rejects_unknown_type():
    try:
        DeviceEnvelope(device_id="x", message_type="NOPE", payload={})
        assert False
    except ValueError:
        pass
