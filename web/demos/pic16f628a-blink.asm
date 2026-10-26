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
        bsf PORTB, 0
        call delay
        bcf PORTB, 0
        call delay
        goto loop
delay
        movlw 3
        movwf 0x20
outer
        movlw 0xff
        movwf 0x21
middle
        movlw 0xff
        movwf 0x22
inner
        decfsz 0x22, F
        goto inner
        decfsz 0x21, F
        goto middle
        decfsz 0x20, F
        goto outer
        return
        end
