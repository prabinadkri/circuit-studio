/* Circuit Studio / PICsim adapter. GPL-2.0-or-later. */
#include <stdlib.h>
#include <string.h>
#include "picsim.h"
typedef struct { _pic chip; int loaded; } Session;
void *cs2_create(void) { return calloc(1, sizeof(Session)); }
void cs2_destroy(Session *s) {
    if (!s) return;
    if (s->loaded) pic_end(&s->chip);
    free(s);
}
int cs2_load(Session *s, const char *model, const char *path, unsigned int clock) {
    const char *allowed[] = {"PIC16F84A", "PIC16F628A", "PIC16F877A", "PIC18F4520", "PIC18F4550"};
    int valid = 0;
    for (unsigned int i=0; i<sizeof allowed/sizeof *allowed; i++)
        if (!strcmp(model, allowed[i])) valid = 1;
    if (!s || !valid || clock != 4000000) return -1;
    if (s->loaded) pic_end(&s->chip);
    memset(&s->chip, 0, sizeof s->chip);
    int result = pic_init(&s->chip, getprocbyname(model), path, 1, clock);
    s->loaded = 1;
    pic_set_pin(&s->chip, s->chip.mclr, 1);
    return result;
}
void cs2_step(Session *s, unsigned int count) {
    if (s && s->loaded && count <= 50000)
        for (unsigned int i=0; i<count; i++) pic_step(&s->chip);
}
unsigned int cs2_pc(Session *s) { return s->loaded ? s->chip.pc : 0; }
unsigned long long cs2_cycles(Session *s) { return s->loaded ? s->chip.cycles : 0; }
static int valid_pin(Session *s, unsigned int n) { return s->loaded && n>=1 && n<=s->chip.PINCOUNT; }
int cs2_pin(Session *s, unsigned int n) { return valid_pin(s,n) ? pic_get_pin(&s->chip,n) : 0; }
int cs2_dir(Session *s, unsigned int n) { return valid_pin(s,n) ? pic_get_pin_dir(&s->chip,n) : 1; }
int cs2_type(Session *s, unsigned int n) { return valid_pin(s,n) ? pic_get_pin_type(&s->chip,n) : 0; }
void cs2_input(Session *s, unsigned int n, int value) {
    if (valid_pin(s,n) && n!=s->chip.mclr) pic_set_pin(&s->chip,n,!!value);
}
void cs2_analog(Session *s, unsigned int n, float value) {
    if (valid_pin(s,n) && n!=s->chip.mclr && value>=0 && value<=5) pic_set_apin(&s->chip,n,value);
}
int cs2_ram(Session *s, unsigned int addr) {
    return s->loaded && addr<s->chip.RAMSIZE ? s->chip.ram[addr] : 0;
}

/* Preserve the 0.1 ABI while an already-open launcher finishes its session.
 * New callers exclusively use the context-based cs2_* functions above. */
static Session *legacy;
int cs_load(const char *path) {
    if (!legacy) legacy=cs2_create();
    return cs2_load(legacy,"PIC16F84A",path,4000000);
}
void cs_step(unsigned int count) { cs2_step(legacy,count); }
unsigned int cs_pc(void) { return legacy ? cs2_pc(legacy) : 0; }
unsigned long long cs_cycles(void) { return legacy ? cs2_cycles(legacy) : 0; }
int cs_pin(unsigned int n) { return legacy ? cs2_pin(legacy,n) : 0; }
int cs_dir(unsigned int n) { return legacy ? cs2_dir(legacy,n) : 1; }
void cs_input(unsigned int n,int v) { if (legacy) cs2_input(legacy,n,v); }
