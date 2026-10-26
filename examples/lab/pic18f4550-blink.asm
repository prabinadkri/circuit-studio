; Circuit Studio lab firmware, GPL-2.0-or-later. Oscillator: 4 MHz.
        list p=18f4550
        #include <p18f4550.inc>
        CONFIG FOSC = HS
        CONFIG WDT = OFF, LVP = OFF, PBADEN = OFF, MCLRE = ON
        CONFIG XINST = OFF
        org 0
        movlw 0x0f
        movwf ADCON1, ACCESS
        clrf LATB, ACCESS
        bcf TRISB, 0, ACCESS
loop
        btg LATB, 0, ACCESS
        call delay
        bra loop
delay
        movlw 3
        movwf 0x20, ACCESS
outer
        movlw 0xff
        movwf 0x21, ACCESS
middle
        movlw 0xff
        movwf 0x22, ACCESS
inner
        decfsz 0x22, F, ACCESS
        bra inner
        decfsz 0x21, F, ACCESS
        bra middle
        decfsz 0x20, F, ACCESS
        bra outer
        return
        end
