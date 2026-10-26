; Circuit Studio lab firmware, GPL-2.0-or-later. Oscillator: 4 MHz.
        list p=16f877a
        #include <p16f877a.inc>
        __CONFIG _HS_OSC & _WDT_OFF & _LVP_OFF & _CP_OFF
        org 0
        banksel ADCON1
        movlw 6
        movwf ADCON1
        banksel TRISB
        bcf TRISB, 0
        banksel PORTB
        clrf PORTB
loop
        btfss PORTB, 1
        goto output_low
        bsf PORTB, 0
        goto loop
output_low
        bcf PORTB, 0
        goto loop
        end
