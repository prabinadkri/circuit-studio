/* Circuit Studio lab: A0 voltage -> 10-bit ADCH:ADCL. GPL-2.0-or-later. */
#include <avr/io.h>
int main(void) {
    ADMUX = _BV(REFS0); /* AVcc = 5 V, ADC0, right aligned. */
    ADCSRA = _BV(ADEN) | _BV(ADPS2) | _BV(ADPS1) | _BV(ADPS0);
    while (1) {
        ADCSRA |= _BV(ADSC);
        while (ADCSRA & _BV(ADSC)) {}
        volatile unsigned int sample = ADC;
        (void)sample;
    }
}
