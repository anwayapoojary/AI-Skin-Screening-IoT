import json
import struct
import zlib

from scripts.serial_bridge import (
    FRAME_MARKER,
    SerialProtocolParser,
    encode_frame,
)


def test_protocol_parser_handles_split_json_and_partial_frame():
    parser = SerialProtocolParser()
    jpeg = b"\xff\xd8test-image\xff\xd9"
    frame = encode_frame(jpeg)
    first_messages, first_images = parser.feed(b'{"type":"hello","device_id":"A"')
    assert first_messages == []
    assert first_images == []
    messages, images = parser.feed(b'}\n{"type":"capture_start"}\n' + frame[:9])
    assert [message["type"] for message in messages] == ["hello", "capture_start"]
    assert images == []
    messages, images = parser.feed(frame[9:])
    assert messages == []
    assert images == [jpeg]
    assert parser.errors == []


def test_protocol_parser_rejects_corrupt_crc_but_accepts_next_frame():
    parser = SerialProtocolParser()
    image = b"\xff\xd8jpeg\xff\xd9"
    corrupt = bytearray(encode_frame(image))
    corrupt[-1] ^= 0x01
    messages, images = parser.feed(bytes(corrupt) + encode_frame(image))
    assert messages == []
    assert images == [image]
    assert any("CRC mismatch" in error for error in parser.errors)


def test_protocol_parser_rejects_invalid_frame_length():
    parser = SerialProtocolParser(max_frame_bytes=8)
    parser.feed(FRAME_MARKER + struct.pack(">I", 9))
    assert any("invalid frame length" in error for error in parser.errors)


def test_frame_encoder_uses_big_endian_length_and_crc32():
    image = b"small-jpeg"
    frame = encode_frame(image)
    length = struct.unpack_from(">I", frame, len(FRAME_MARKER))[0]
    assert frame[len(FRAME_MARKER) + 4 : len(FRAME_MARKER) + 4 + length] == image
    assert struct.unpack_from(">I", frame, len(frame) - 4)[0] == zlib.crc32(image)
