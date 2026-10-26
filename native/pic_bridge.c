/* Circuit Studio / PICsim adapter. GPL-2.0-or-later. */
#include <string.h>
#include "picsim.h"
static _pic chip;
static int loaded;
int cs_load(const char *path) {
    if (loaded) pic_end(&chip);
    memset(&chip, 0, sizeof chip);
    int result = pic_init(&chip, P16F84A, path, 1, 4000000.0f);
    loaded = 1;
    pic_set_pin(&chip, 4, 1); /* MCLR high. Oscillator and power are implicit. */
    return result;
}
void cs_step(unsigned int count) { if (loaded) for (unsigned int i=0;i<count;i++) pic_step(&chip); }
unsigned int cs_pc(void) { return loaded ? chip.pc : 0; }
unsigned long long cs_cycles(void) { return loaded ? chip.cycles : 0; }
int cs_pin(unsigned int n) { return loaded && n>=1 && n<=18 ? pic_get_pin(&chip,n) : 0; }
int cs_dir(unsigned int n) { return loaded && n>=1 && n<=18 ? pic_get_pin_dir(&chip,n) : 1; }
void cs_input(unsigned int n, int value) { if (loaded && n>=1 && n<=18 && n!=4) pic_set_pin(&chip,n,!!value); }
