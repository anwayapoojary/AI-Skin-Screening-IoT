#ifndef BUTTON_H
#define BUTTON_H

#ifdef __cplusplus
extern "C" {
#endif

int button_init(void);
int button_pressed(void); /* Short press, once on release. */
int button_long_pressed(void); /* Long press, once after BUTTON_LONG_PRESS_MS. */

#ifdef __cplusplus
}
#endif

#endif
