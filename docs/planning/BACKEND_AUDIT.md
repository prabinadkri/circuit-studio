# Additional MCU backend audit — 26 October 2026

These are separately executed feasibility probes, not devices added to Circuit
Studio's supported profile selector. The application still supports its original
eight AVR/PIC profiles. Evidence: `docs/evidence/backend-audit.json` and
`spikes/backends/audit.py`. The runner repeats the AVR tests and checks native
8052 output and STM32 boot messages; a nonzero result is failure.

| Target | Backend tested | Actual test result | Peripheral/status limits |
|---|---|---|---|
| ATmega32 | simavr 1.6, Ubuntu 24.04 package | 11,117 PB0 edges; exact 4/5 CPU-cycle high/low intervals at 1 MHz; 100 PA0 → PC0 input checks; repeat identical | Core/three GPIO ports exercised. ADC, UART, SPI, TWI, timers, interrupts, EEPROM, watchdog and fuse behavior are **not validated by this probe**. No package or schematic integration yet. |
| ATmega2560 | simavr 1.6 | 11,116 PB0 edges; same exact cycle intervals and 100 input checks; repeat identical | This fixture uses low flash addresses. Far flash/RAMPZ, Mega headers, additional ports, timers and communication peripherals remain unvalidated. |
| AT89S52 | uCsim 0.6.4 from SDCC 4.2.0 | No exact AT89S52 target is listed. Generic C52 executes 10,000 alternating P1.0 edges at 36 oscillator ticks per edge (3 µs at 12 MHz). | **Do not advertise AT89S52 support.** Generic 8052 instruction/GPIO timing does not validate S52 watchdog, ISP, fuses, port electrical behavior or all peripherals. |
| STM32F407VG Discovery | Renode 1.17.0 | Upstream Zephyr fixture boots and prints `Hello World! stm32f4_disco` on USART2 during 0.5 simulated seconds. | Boot/UART only. No Circuit Studio pin mapping, analog coupling, timing accuracy, ADC/DAC electrical accuracy, USB, debugger or peripheral completeness claim. Renode reported unhandled NVIC/UART register bits; warnings are retained in evidence. |
| ESP32 | Espressif QEMU evaluated from upstream documentation; not executed | Not enabled | Espressif lists missing Wi-Fi/Bluetooth and other peripherals. No radio, USB, analog or GPIO-matrix compatibility claim; requires a separate exact-board fixture and integration decision. |

The STM32 generic upstream platform allocates more memory than the selected
STM32F407VG. The probe explicitly sets 1 MiB flash, 128 KiB system SRAM and 64 KiB
CCM before boot. This avoids treating a generic family description as an exact
silicon profile. Other platform approximations remain unvalidated.

## Reproduce

Install or extract `libsimavr-dev`, `libsimavr2`, `sdcc-ucsim`, AVR-GCC/AVR-libc and
Renode 1.17.0 into a scratch directory. Use the official Renode fixture:

`https://dl.antmicro.com/projects/renode/stm32f4_discovery--zephyr-hello_world.elf-s_515008-2180a4018e82fcbc8821ef4330c9b5f3caf2dcdb`

The audit verifies its SHA-1 against that upstream identity; it is not included
in the app distribution. Run:

```sh
python3 spikes/backends/audit.py --avr-gcc /path/to/avr-gcc --sysroot /path/to/extracted-packages --renode /path/to/renode --stm32-elf /path/to/fixture.elf --output audit.json
```

`sysroot` must contain the Debian package paths `usr/include/simavr`,
`usr/lib/x86_64-linux-gnu/libsimavr.a`, and `usr/bin/s51`; the host needs GCC and
libelf.so.1. Tests are bounded and do not change the installed device catalog.
The AVR audit helper links simavr separately under GPL-3.0-or-later.

## Primary references and next gates

- [simavr source and target list](https://github.com/buserror/simavr): exact core candidates.
- [Renode supported boards](https://renode.readthedocs.io/en/latest/introduction/supported-boards.html)
  and [Renode source/release](https://github.com/renode/renode): board scripts and reproducible boot fixture.
- [ST STM32F407VG product data](https://www.st.com/en/microcontrollers-microprocessors/stm32f407vg.html): selected memory sizes.
- [Espressif QEMU peripheral matrix](https://github.com/espressif/esp-toolchain-docs/blob/main/qemu/README.md)
  and [ESP-IDF QEMU guide](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/tools/qemu.html): supported emulation scope and limitations.

CS-050/051 remain in progress: this audit supplies evidence for selecting engines,
but protocol integration dependencies and an exact S52/ESP32 decision are still
open. No extra profiles are counted as delivered from these experiments.
