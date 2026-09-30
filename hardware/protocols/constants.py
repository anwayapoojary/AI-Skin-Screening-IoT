"""Versioned device protocol (transport-independent)."""

PROTOCOL_VERSION = "1.0"

MESSAGE_TYPES = (
    "DEVICE_CONNECT",     # device -> server: announce presence on connect
    "DEVICE_STATUS",      # device -> server: state/camera/comms snapshot
    "IMAGE_CAPTURE",      # server -> device: command to capture one image
    "IMAGE_TRANSFER",     # device -> server: captured image (base64) + request_id
    "SENSOR_DATA",        # device -> server: sensor samples (empty — none in BOM)
    "SCREENING_START",    # server -> device: begin screening flow
    "SCREENING_RESULT",   # server -> device: short non-diagnostic summary for OLED
    "SET_DISPLAY",        # server -> device: show a short DISPLAY_STATES string
    "ERROR",              # either direction: coded error
    "HEARTBEAT",          # device -> server: keepalive
    "ACK",                # server -> device: command acknowledged
)

DEVICE_STATES = (
    "OFFLINE",
    "CONNECTING",
    "READY",
    "CAPTURING",
    "TRANSFERRING",
    "PROCESSING",
    "ERROR",
)

ERROR_CODES = (
    "E_CAMERA",
    "E_SENSOR",
    "E_COMM",
    "E_POWER",
    "E_DISCONNECT",
    "E_INVALID_CMD",
    "E_CAPTURE",
    "E_TIMEOUT",
    "E_IMAGE",
)

DISPLAY_STATES = (
    "READY",
    "PLACE/CAPTURE IMAGE",
    "CAPTURING...",
    "PROCESSING...",
    "ANALYZING...",
    "RESULT AVAILABLE",
    "ERROR",
)
