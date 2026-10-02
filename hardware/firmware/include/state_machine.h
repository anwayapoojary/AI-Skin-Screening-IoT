#ifndef STATE_MACHINE_H
#define STATE_MACHINE_H

#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    DEVICE_STATE_OFFLINE = 0,
    DEVICE_STATE_CONNECTING,
    DEVICE_STATE_READY,
    DEVICE_STATE_CAPTURING,
    DEVICE_STATE_TRANSFERRING,
    DEVICE_STATE_PROCESSING,
    DEVICE_STATE_ERROR
} device_state_t;

void sm_init(void);
device_state_t sm_get_state(void);
const char* sm_get_state_str(void);
const char* sm_get_display_str(void);
bool sm_can_transition(device_state_t from, device_state_t to);
bool sm_transition(device_state_t new_state);
bool sm_transition_by_name(const char* state_name);
const char* sm_state_to_str(device_state_t s);
device_state_t sm_str_to_state(const char* s);

#ifdef __cplusplus
}
#endif

#endif // STATE_MACHINE_H
