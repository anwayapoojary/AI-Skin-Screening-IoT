import asyncio

import pytest

from hardware.simulator.simulated_device import SimulatedDevice


def test_sim_connect_capture_result():
    async def _run():
        d = SimulatedDevice()
        await d.connect()
        st = await d.get_status()
        assert st.state == "READY"
        assert st.extra.get("flash") == "off"
        img = await d.capture_image()
        assert img.content[:8] == b"\x89PNG\r\n\x1a\n"
        samples = await d.read_sensors()
        assert all(s.status == "unavailable" for s in samples)
        await d.send_result({"prediction": "mock"})
        assert d.last_result["prediction"] == "mock"
        assert (await d.get_status()).display_state == "RESULT AVAILABLE"

    asyncio.run(_run())


def test_sim_capture_error():
    async def _run():
        d = SimulatedDevice()
        await d.connect()
        d.fail_next_capture = True
        with pytest.raises(RuntimeError):
            await d.capture_image()

    asyncio.run(_run())
