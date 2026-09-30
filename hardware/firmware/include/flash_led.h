#ifndef FLASH_LED_H
#define FLASH_LED_H

#ifdef __cplusplus
extern "C" {
#endif

int flash_init(void);
void flash_set(int on);

#ifdef __cplusplus
}
#endif

#endif
