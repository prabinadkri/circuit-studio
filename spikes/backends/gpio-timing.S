/* Exact ATmega32 / ATmega2560 core audit. GPL-2.0-or-later. */
#include <avr/io.h>
.global main
main:
    ldi r16, 1
    out _SFR_IO_ADDR(DDRB), r16
    out _SFR_IO_ADDR(DDRC), r16
loop:
    sbi _SFR_IO_ADDR(PORTB), 0
    in r17, _SFR_IO_ADDR(PINA)
    out _SFR_IO_ADDR(PORTC), r17
    cbi _SFR_IO_ADDR(PORTB), 0
    nop
    rjmp loop
