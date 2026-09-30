#ifndef DISPLAY_H
#define DISPLAY_H

#ifdef __cplusplus
extern "C" {
#endif

/* 0.96" OLED — driver IC unconfirmed (often SSD1306 I2C). */
int display_init(void);
void display_show(const char *state_line);

#ifdef __cplusplus
}
#endif

#endif
