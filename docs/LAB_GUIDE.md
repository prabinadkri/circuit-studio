# Microcontroller lab

Circuit Studio 0.2 includes eight selectable profiles backed by six chip models. Uno, classic Nano and bare ATmega328P run the same AVR core with different exposed pins. The PIC choices run their actual PICsim processor models rather than a renamed generic CPU.

| Profile | Simulated oscillator | Exposed signals | Analog inputs | Included exercises |
|---|---|---|---|---|
| Arduino Uno R3 | 16 MHz | D0–D13, A0–A5 | A0–A5 | Blink, button, ADC |
| Arduino Nano classic | 16 MHz | D0–D13, A0–A7 | A0–A7; A6/A7 analog-only | Blink, button, ADC; extra A7 source |
| ATmega328P DIP-28 | 16 MHz | D0–D13, A0–A5, with physical DIP references | A0–A5 | Blink, button, ADC |
| PIC16F84A DIP-18 | 4 MHz | RA0–RA4, RB0–RB7 | None | Blink, button |
| PIC16F628A DIP-18 | 4 MHz | RA0–RA4, RB0–RB7 | None | Blink, button |
| PIC16F877A DIP-40 | 4 MHz | Ports A–E except oscillator/reset pins | AN0–AN7 | Blink, button, ADC |
| PIC18F4520 DIP-40 | 4 MHz | Ports A–E except oscillator/reset pins | AN0–AN12 | Blink, button, ADC |
| PIC18F4550 DIP-40 | 4 MHz | Ports A–E except oscillator/reset pins and VUSB; RC4/5 input-only | AN0–AN12 | Blink, button, ADC |

The profiles assume 5 V logic, powered chips, reset released and the fixed oscillator listed above. These are firmware simulation profiles, not USB programmers or physical board connections. The app does not flash hardware.

![PIC16F877A lab with registers and analog controls](microcontroller-lab.png)

## First LED exercise

1. Open **Microcontrollers** and choose the board or chip.
2. Select **LED blink**, then **Load demo**.
3. Click **Load D13 LED circuit** (AVR) or **Load RB0 LED circuit** (PIC).
4. Click **Run firmware**. The output pin changes and the schematic resistor/LED carries current. Switch to **Circuit lab** to view the circuit, or pause and single-step the program.

For **Button → LED**, use the same LED circuit and load the button example. Toggle D2 (AVR) or RB1 (PIC) to change the LED output. For circuit-driven inputs, add a node label `IN_D2` or `IN_RB1`; a connected node overrides the manual pin button.

## Analog exercise

Select an ADC-capable chip, choose **Analog voltage**, load the demo and run. Move the A0 (AVR) or RA0 (PIC) slider. Read the result as `ADCH × 256 + ADCL` for AVR or `ADRESH × 256 + ADRESL` for PIC. With a 5 V reference, 0 V is 0, midpoint is about 511–512, and 5 V is 1023.

Alternatively, attach a node label `IN_A0` or `IN_RA0` to a voltage source in Circuit lab. The input control shows the circuit voltage with an arrow and disables manual adjustment while connected. Values entering the ADC bridge are clamped to 0–5 V. This does not model damage from overvoltage.

Classic Nano also provides analog-only A6 and A7. `examples/lab/nano-adc7.c` and its HEX file demonstrate A7; these pins deliberately have no digital GPIO buttons.

## Use your own firmware

Choose the exact target before loading Intel HEX. HEX does not encode the processor model, so a valid checksum and memory range cannot prove that a program was compiled for the right chip. Configure the compiler for the oscillator shown above. PIC examples disable the watchdog and low-voltage programming and initialize digital/analog modes explicitly.

The **Example source** link opens the source for the selected lab exercise. All sources and HEX files are in `examples/lab`. Rebuild with `npm run build:examples`, using AVR-GCC/avr-libc/binutils-avr and gputils installed externally; `npm run build` copies them into the offline app. The build script supports `GPASM`, `GPASM_INCLUDE`, `AVR_GCC` and `AVR_OBJCOPY` environment variables for non-system installations.

Save a `.circuit` file to retain the schematic, all profile firmware, selected target and board. CPU registers, runtime EEPROM, input button levels and slider settings are reset when switching profiles or reopening a project. Existing version-1 project files remain readable.

## Wiring reference and scope

The **Pin reference & hardware connections** panel maps each exposed signal to the selected package pin or board header. It does not replace a complete hardware schematic. The ATmega328P DIP profile uses Arduino-style signal names in the simulation bridge and shows PB/PC/PD functions and physical pin numbers in the reference.

Manufacturer references: [Arduino Nano pinout](https://docs.arduino.cc/resources/pinouts/A000005-full-pinout.pdf), [ATmega328P](https://www.microchip.com/en-us/product/atmega328p), [PIC16F84A](https://www.microchip.com/en-us/product/pic16f84a), [PIC16F628A](https://www.microchip.com/en-us/product/pic16f628a), [PIC16F877A](https://www.microchip.com/en-us/product/pic16f877a), [PIC18F4520](https://www.microchip.com/en-us/product/pic18f4520), [PIC18F4550](https://www.microchip.com/en-us/product/pic18f4550).

These models have automated blink/button/ADC checks, not complete peripheral certification. PIC USB and the PIC serial monitor are not connected. SPI/I2C peripherals, source debugging, physical programming and a common analog/CPU time scheduler remain unfinished. GPIO voltage sources do not reproduce tri-state buses, open-drain behavior or current limits. Use the supported-device list as the boundary; 8051, ATmega32/2560, ESP32 and STM32 are not implemented.
