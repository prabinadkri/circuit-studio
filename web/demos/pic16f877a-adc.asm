; Circuit Studio lab firmware, GPL-2.0-or-later. Oscillator: 4 MHz.
        list p=16f877a
        #include <p16f877a.inc>
        __CONFIG _HS_OSC & _WDT_OFF & _LVP_OFF & _CP_OFF
        org 0
        banksel ADCON1
        movlw 0x8e
        movwf ADCON1
        banksel ADCON0
        movlw 0x81
        movwf ADCON0
loop
        bsf ADCON0, 2
wait_adc
        btfsc ADCON0, 2
        goto wait_adc
        goto loop
        end
