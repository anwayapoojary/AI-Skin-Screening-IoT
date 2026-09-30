/* No dedicated health/environment sensors in the BOM. This stays a no-op so
 * the rest of the firmware compiles and the API reports sensors as unavailable. */

#include "sensors.h"

int sensors_init(void)
{
    return 0;
}
