; Circuit Studio lab firmware, GPL-2.0-or-later. Oscillator: 4 MHz.
        list p=18f4520
        #include <p18f4520.inc>
        CONFIG OSC = HS
        CONFIG WDT = OFF, LVP = OFF, PBADEN = OFF, MCLRE = ON
        CONFIG XINST = OFF
        org 0
        movlw 0x0e
        movwf ADCON1, ACCESS
        movlw 0x82
        movwf ADCON2, ACCESS
        movlw 1
        movwf ADCON0, ACCESS
loop
        bsf ADCON0, 1, ACCESS
wait_adc
        btfsc ADCON0, 1, ACCESS
        bra wait_adc
        bra loop
        end
