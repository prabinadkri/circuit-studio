# Additional MCU backend audit — 27 October 2026

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
| ESP32-C3 | Espressif QEMU 9.2.2 esp_develop_9.2.2_20260417 | Original RV32I direct-ELF UART0 fixture prints the expected message twice identically | No ESP-IDF flash/ROM bootloader, GPIO matrix, analog, radio, USB, interrupt timing or Circuit Studio pin coupling validation. Standalone candidate only; keep the editor profile disabled. |

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

## Final integration decisions

CS-050 and CS-051 close as **feasibility audits**, which is their original ticket
title and acceptance scope. CS-035's protocol prerequisite is now tested. No new
supported MCU is inferred from these probes.

- ATmega32/2560: retain simavr as the core candidate. The repeated exact-target
  GPIO timing/input probes pass; other peripherals retain the unvalidated entries
  above. Do not enable an editor profile without isolated worker, package/power
  mapping, firmware attachment and shared-clock integration fixtures.
- AT89S52: reject the available generic C52 backend as an exact S52 model. It has
  not established S52 ISP/watchdog/fuse/electrical behavior. Keep unsupported.
- STM32F407VG: retain Renode for standalone firmware feasibility; the boot/UART
  result passes. Do not advertise mixed-signal or exact peripheral timing support.
- ESP32-C3: retain Espressif QEMU for standalone direct-ELF feasibility. Two runs
  produce identical UART output. `-icount 3` gives 8 ns/emulated instruction, not
  hardware cycle timing. Keep the editor profile disabled.

Reproduce ESP32-C3 with the upstream
[Espressif QEMU release](https://github.com/espressif/qemu/releases/tag/esp-develop-9.2.2-20260417):

```sh
python3 spikes/backends/esp32c3-audit.py --qemu /path/to/qemu-system-riscv32 --output esp32c3-audit.json
```

The script creates an original RV32I ELF (LUI/ADDI/SW/JAL) at 0x40380000 and writes
to UART0 at 0x60000000. A bounded process captures the UART in a file, terminates
the intentional loop and repeats. Firmware and emulator SHA-256 hashes are in
`docs/evidence/esp32c3-audit.json`. QEMU is not bundled. Its
[exact machine source](https://github.com/espressif/qemu/blob/esp-develop-9.2.2-20260417/hw/riscv/esp32c3.c)
and [peripheral matrix](https://github.com/espressif/esp-toolchain-docs/blob/main/qemu/README.md)
are the primary references. This is a completed candidate decision, not a claim
that an audit delivered general-purpose MCU simulation.
