// ATmega328P / 16 MHz: OC0A (D6), 976.5625 Hz PWM, ADC0 polling.
#include <avr/io.h>
int main(void) {
 DDRD |= (1 << DDD6);
 TCCR0A = (1 << COM0A1) | (1 << WGM01) | (1 << WGM00);
 TCCR0B = (1 << CS01) | (1 << CS00);
 OCR0A = 127;
 ADMUX = (1 << REFS0);
 ADCSRA = (1 << ADEN) | 7;
 while (1) { ADCSRA |= (1 << ADSC); while (ADCSRA & (1 << ADSC)) {} volatile unsigned int sample = ADC; (void)sample; }
}
