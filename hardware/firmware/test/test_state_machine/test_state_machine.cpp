#include <unity.h>
#include "state_machine.h"

void setUp(void) {
    sm_init();
}

void tearDown(void) {
}

void test_initial_state(void) {
    TEST_ASSERT_EQUAL(DEVICE_STATE_OFFLINE, sm_get_state());
    TEST_ASSERT_EQUAL_STRING("OFFLINE", sm_get_state_str());
    TEST_ASSERT_EQUAL_STRING("ERROR", sm_get_display_str());
}

void test_valid_screening_cycle(void) {
    TEST_ASSERT_TRUE(sm_transition(DEVICE_STATE_CONNECTING));
    TEST_ASSERT_EQUAL(DEVICE_STATE_CONNECTING, sm_get_state());
    TEST_ASSERT_EQUAL_STRING("CONNECTING...", sm_get_display_str());

    TEST_ASSERT_TRUE(sm_transition(DEVICE_STATE_READY));
    TEST_ASSERT_EQUAL(DEVICE_STATE_READY, sm_get_state());
    TEST_ASSERT_EQUAL_STRING("READY", sm_get_display_str());

    TEST_ASSERT_TRUE(sm_transition(DEVICE_STATE_CAPTURING));
    TEST_ASSERT_EQUAL(DEVICE_STATE_CAPTURING, sm_get_state());
    TEST_ASSERT_EQUAL_STRING("CAPTURING...", sm_get_display_str());

    TEST_ASSERT_TRUE(sm_transition(DEVICE_STATE_TRANSFERRING));
    TEST_ASSERT_EQUAL(DEVICE_STATE_TRANSFERRING, sm_get_state());

    TEST_ASSERT_TRUE(sm_transition(DEVICE_STATE_READY));
    TEST_ASSERT_EQUAL(DEVICE_STATE_READY, sm_get_state());
}

void test_invalid_transitions(void) {
    // Cannot jump from OFFLINE directly to CAPTURING
    TEST_ASSERT_FALSE(sm_transition(DEVICE_STATE_CAPTURING));
    TEST_ASSERT_EQUAL(DEVICE_STATE_OFFLINE, sm_get_state());

    // Cannot jump from OFFLINE directly to PROCESSING
    TEST_ASSERT_FALSE(sm_transition(DEVICE_STATE_PROCESSING));
    TEST_ASSERT_EQUAL(DEVICE_STATE_OFFLINE, sm_get_state());
}

void test_string_conversions(void) {
    TEST_ASSERT_EQUAL_STRING("READY", sm_state_to_str(DEVICE_STATE_READY));
    TEST_ASSERT_EQUAL_STRING("CAPTURING", sm_state_to_str(DEVICE_STATE_CAPTURING));
    TEST_ASSERT_EQUAL(DEVICE_STATE_CONNECTING, sm_str_to_state("CONNECTING"));
    TEST_ASSERT_EQUAL(DEVICE_STATE_ERROR, sm_str_to_state("ERROR"));
    TEST_ASSERT_EQUAL(DEVICE_STATE_OFFLINE, sm_str_to_state("NON_EXISTENT_STATE"));
}

int main(int argc, char **argv) {
    UNITY_BEGIN();
    RUN_TEST(test_initial_state);
    RUN_TEST(test_valid_screening_cycle);
    RUN_TEST(test_invalid_transitions);
    RUN_TEST(test_string_conversions);
    return UNITY_END();
}
