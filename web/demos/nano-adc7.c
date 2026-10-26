/* Classic Nano A7 is analog-only; read channel 7. GPL-2.0-or-later. */
#include <avr/io.h>
int main(void) {
    ADMUX = _BV(REFS0) | 7;
    ADCSRA = _BV(ADEN) | 7;
    while (1) {
        ADCSRA |= _BV(ADSC);
        while (ADCSRA & _BV(ADSC)) {}
        volatile unsigned int sample = ADC;
        (void)sample;
    }
}
