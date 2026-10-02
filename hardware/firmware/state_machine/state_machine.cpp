#include "state_machine.h"
#include <string.h>

static device_state_t s_current_state = DEVICE_STATE_OFFLINE;
static const char* s_display_text = "READY";

static const char* const STATE_NAMES[] = {
    "OFFLINE",
    "CONNECTING",
    "READY",
    "CAPTURING",
    "TRANSFERRING",
    "PROCESSING",
    "ERROR"
};

void sm_init(void) {
    s_current_state = DEVICE_STATE_OFFLINE;
    s_display_text = "ERROR";
}

device_state_t sm_get_state(void) {
    return s_current_state;
}

const char* sm_get_state_str(void) {
    return sm_state_to_str(s_current_state);
}

const char* sm_get_display_str(void) {
    return s_display_text;
}

const char* sm_state_to_str(device_state_t s) {
    if (s >= DEVICE_STATE_OFFLINE && s <= DEVICE_STATE_ERROR) {
        return STATE_NAMES[s];
    }
    return "UNKNOWN";
}

device_state_t sm_str_to_state(const char* s) {
    if (!s) return DEVICE_STATE_OFFLINE;
    for (int i = 0; i <= (int)DEVICE_STATE_ERROR; i++) {
        if (strcmp(s, STATE_NAMES[i]) == 0) {
            return (device_state_t)i;
        }
    }
    return DEVICE_STATE_OFFLINE;
}

bool sm_can_transition(device_state_t from, device_state_t to) {
    if (from == to) return true;
    switch (from) {
        case DEVICE_STATE_OFFLINE:
            return (to == DEVICE_STATE_CONNECTING);
        case DEVICE_STATE_CONNECTING:
            return (to == DEVICE_STATE_READY || to == DEVICE_STATE_ERROR || to == DEVICE_STATE_OFFLINE);
        case DEVICE_STATE_READY:
            return (to == DEVICE_STATE_CAPTURING || to == DEVICE_STATE_PROCESSING || to == DEVICE_STATE_OFFLINE || to == DEVICE_STATE_ERROR);
        case DEVICE_STATE_CAPTURING:
            return (to == DEVICE_STATE_TRANSFERRING || to == DEVICE_STATE_ERROR || to == DEVICE_STATE_OFFLINE);
        case DEVICE_STATE_TRANSFERRING:
            return (to == DEVICE_STATE_PROCESSING || to == DEVICE_STATE_READY || to == DEVICE_STATE_ERROR || to == DEVICE_STATE_OFFLINE);
        case DEVICE_STATE_PROCESSING:
            return (to == DEVICE_STATE_READY || to == DEVICE_STATE_ERROR || to == DEVICE_STATE_OFFLINE);
        case DEVICE_STATE_ERROR:
            return (to == DEVICE_STATE_READY || to == DEVICE_STATE_OFFLINE || to == DEVICE_STATE_CONNECTING);
        default:
            return false;
    }
}

bool sm_transition(device_state_t new_state) {
    if (!sm_can_transition(s_current_state, new_state)) {
        return false;
    }
    s_current_state = new_state;
    switch (new_state) {
        case DEVICE_STATE_READY:
            s_display_text = "READY";
            break;
        case DEVICE_STATE_CONNECTING:
            s_display_text = "CONNECTING...";
            break;
        case DEVICE_STATE_CAPTURING:
            s_display_text = "CAPTURING...";
            break;
        case DEVICE_STATE_TRANSFERRING:
        case DEVICE_STATE_PROCESSING:
            s_display_text = "PROCESSING...";
            break;
        case DEVICE_STATE_ERROR:
            s_display_text = "ERROR";
            break;
        case DEVICE_STATE_OFFLINE:
            s_display_text = "OFFLINE";
            break;
    }
    return true;
}

bool sm_transition_by_name(const char* state_name) {
    device_state_t st = sm_str_to_state(state_name);
    return sm_transition(st);
}
