"""Synthetic demo image for the simulator — NOT a clinical image.

The previous constant was a 1x1 PNG whose IDAT stream was malformed: PIL could
read the header but failed on decode. That stayed invisible while the mock model
never looked at pixels, and broke as soon as a real model did. A 1x1 image would
also have failed ai/preprocessing's minimum-size gate anyway.

This builds a valid, deterministic, clearly-synthetic image (flat skin-tone field
with a darker irregular blob plus fine grain) that is large and textured enough
to pass the quality gate, so AI_MODE=real works end to end against
DEVICE_MODE=simulator. It uses only zlib + struct from the standard library, so
the simulator still pulls in no image dependencies.

It is generated geometry, not a lesion. Never treat it as clinical ground truth.
"""

import struct
import zlib

SAMPLE_SIZE = 256

# Deterministic fine grain. A flat colour field has zero high-frequency detail
# and reads as "out of focus" to a variance-of-Laplacian measure, so the gate
# would reject it; this dither gives it real texture without any RNG seeding.
_NOISE = [(((i * 1103515245 + 12345) >> 16) % 25) - 12 for i in range(4096)]

_SKIN = (214, 168, 140)
_BLOB = (104, 70, 58)


def _png_chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def build_sample_png(size: int = SAMPLE_SIZE) -> bytes:
    """Return a valid 8-bit RGB PNG of a synthetic blob on a skin-tone field."""
    centre = size / 2.0
    radius = size * 0.28

    # Precompute every pixel value we can emit: 2 base colours x 25 noise steps.
    # Keeps the inner loop to a dict/list lookup instead of per-pixel arithmetic,
    # which matters because this runs at import time on the API's startup path.
    px = {
        base: [
            bytes(max(0, min(255, c + n)) for c in base) for n in range(-12, 13)
        ]
        for base in (_SKIN, _BLOB)
    }
    skin_px, blob_px = px[_SKIN], px[_BLOB]

    # Compare squared radii so there is no sqrt per pixel; the wobble only ever
    # takes 11 distinct values, so square those once up front too.
    r2 = [(radius * (1.0 + 0.18 * (k - 5) / 5.0)) ** 2 for k in range(11)]

    scanlines = []
    for y in range(size):
        dy = y - centre
        dy2 = dy * dy
        y13 = y * 13
        ybase = y * size
        row = bytearray()
        for x in range(size):
            dx = x - centre
            inside = dx * dx + dy2 < r2[(x * 7 + y13) % 11]
            table = blob_px if inside else skin_px
            row += table[_NOISE[(ybase + x) & 0xFFF] + 12]
        scanlines.append(bytes(row))

    # Filter type 0 (None) in front of every scanline.
    raw = b"".join(b"\x00" + line for line in scanlines)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # 8-bit truecolour
    return (
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(b"IHDR", ihdr)
        + _png_chunk(b"IDAT", zlib.compress(raw, 9))
        + _png_chunk(b"IEND", b"")
    )


SAMPLE_PNG_CACHE: dict[int, bytes] = {}


def get_sample_png(size: int = SAMPLE_SIZE) -> bytes:
    """Cached accessor. Preferred over the SAMPLE_PNG constant.

    Generation is a ~65k-iteration pure-Python loop, so it is done on first use
    and cached rather than at import time — nothing should burn CPU just because
    a module got imported (this sits on the API's startup path).
    """
    cached = SAMPLE_PNG_CACHE.get(size)
    if cached is None:
        cached = build_sample_png(size)
        SAMPLE_PNG_CACHE[size] = cached
    return cached


def __getattr__(name: str) -> bytes:
    # Keeps `from hardware.simulator.sample_image import SAMPLE_PNG` working for
    # existing callers/tests, while still deferring the work until it is asked for.
    if name == "SAMPLE_PNG":
        return get_sample_png()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
