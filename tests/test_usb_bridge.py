import struct
import zlib

import pytest

from scripts.usb_bridge import (
    FRAME_MARKER,
    FrameParser,
    HEADER_SIZE,
    TruncatedFrameError,
    encode_frame,
)


def test_frame_parser_reads_valid_frame_across_chunks():
    image = b"\xff\xd8\xfftest-jpeg-data\xff\xd9"
    frame = encode_frame(image)
    parser = FrameParser()

    assert parser.feed(b"serial-noise" + frame[:7]) == []
    assert parser.feed(frame[7:]) == [image]
    assert parser.errors == []
    parser.finish()


def test_frame_parser_discards_bad_crc_and_keeps_following_valid_frame():
    image = b"\xff\xd8jpeg\xff\xd9"
    corrupt = bytearray(encode_frame(image))
    corrupt[-1] ^= 0x01
    parser = FrameParser()

    frames = parser.feed(bytes(corrupt) + encode_frame(image))
    assert frames == [image]
    assert any("CRC mismatch" in error for error in parser.errors)


def test_frame_parser_rejects_truncated_frame():
    image = b"\xff\xd8partial"
    truncated = FRAME_MARKER + struct.pack(">I", len(image)) + image[:4]
    parser = FrameParser()

    assert parser.feed(truncated) == []
    with pytest.raises(TruncatedFrameError, match="unparsed byte"):
        parser.finish()


def test_frame_parser_rejects_length_above_limit():
    parser = FrameParser(max_frame_bytes=16)
    parser.feed(FRAME_MARKER + struct.pack(">I", 17))
    assert any("invalid frame length" in error for error in parser.errors)


def test_frame_layout_is_big_endian_and_crc32_ieee():
    image = b"sample jpeg"
    frame = encode_frame(image)
    length = struct.unpack_from(">I", frame, len(FRAME_MARKER))[0]
    assert length == len(image)
    assert frame[HEADER_SIZE : HEADER_SIZE + length] == image
    assert struct.unpack_from(">I", frame, HEADER_SIZE + length)[0] == (
        zlib.crc32(image) & 0xFFFFFFFF
    )
