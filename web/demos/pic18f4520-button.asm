; Circuit Studio lab firmware, GPL-2.0-or-later. Oscillator: 4 MHz.
        list p=18f4520
        #include <p18f4520.inc>
        CONFIG OSC = HS
        CONFIG WDT = OFF, LVP = OFF, PBADEN = OFF, MCLRE = ON
        CONFIG XINST = OFF
        org 0
        movlw 0x0f
        movwf ADCON1, ACCESS
        clrf LATB, ACCESS
        bcf TRISB, 0, ACCESS
loop
        btfss PORTB, 1, ACCESS
        bra output_low
        bsf LATB, 0, ACCESS
        bra loop
output_low
        bcf LATB, 0, ACCESS
        bra loop
        end
