; Circuit Studio lab firmware, GPL-2.0-or-later. Oscillator: 4 MHz.
        list p=16f628a
        #include <p16f628a.inc>
        __CONFIG _FOSC_HS & _WDTE_OFF & _LVP_OFF & _CP_OFF
        org 0
        movlw 7
        movwf CMCON
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
