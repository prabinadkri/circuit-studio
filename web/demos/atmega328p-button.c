/* Circuit Studio lab: D2 switch drives D13 LED, 16 MHz. GPL-2.0-or-later. */
#include <avr/io.h>
int main(void) {
    DDRB |= _BV(DDB5);
    DDRD &= ~_BV(DDD2);
    while (1) {
        if (PIND & _BV(PD2)) PORTB |= _BV(PB5);
        else PORTB &= ~_BV(PB5);
    }
}
