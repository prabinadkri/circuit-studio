/* D13 / PB5 blink, 16 MHz. GPL-2.0-or-later.
 * Assemble without a C runtime: avr-gcc -mmcu=atmega328p -nostdlib -o blink.elf atmega328p-blink.S
 */
#include <avr/io.h>
.section .text
.global __start
__start:
    sbi _SFR_IO_ADDR(DDRB), 5
repeat:
    sbi _SFR_IO_ADDR(PORTB), 5
    ldi r24, 39
outer_on:
    ldi r25, 255
middle_on:
    ldi r26, 255
inner_on:
    dec r26
    brne inner_on
    dec r25
    brne middle_on
    dec r24
    brne outer_on
    cbi _SFR_IO_ADDR(PORTB), 5
    ldi r24, 39
outer_off:
    ldi r25, 255
middle_off:
    ldi r26, 255
inner_off:
    dec r26
    brne inner_off
    dec r25
    brne middle_off
    dec r24
    brne outer_off
    rjmp repeat
