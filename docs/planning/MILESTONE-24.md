# Roadmap milestone: 24 of 29 tickets

26 October 2026 · v0.4.0-alpha.3. Five additional acceptance gates have been
implemented. This is **24/29 (82.8%) by ticket count**, not a percentage of
Proteus functionality or remaining engineering effort. The roadmap as a whole
is not complete. This milestone does not add new MCU families or certify hardware.

| Ticket | Delivered and checked | Evidence |
|---|---|---|
| CS-031 | Integer shared clock; timestamped AVR and native PIC output transitions; high-Z, weak pulls, open-drain resolution, contention and hysteresis; PWM/RC/ADC feedback | `tests/coupled.cjs`, `tests/digital.test.mjs`, `tests/test_clock.py`; `docs/evidence/coupled-10k.json` |
| CS-033 | An on-schematic MCU package, physical pin references, explicit supplies/reset, visible fixed oscillator and attachment navigation; serialization for all eight existing profiles | `tests/mcu-package.cjs`, existing `tests/lab-devices.cjs`; MCU package roundtrip, power refusal, actual AVR execution and narrow DIP-28 pad map |
| CS-034 | Aligned analog/logic view, rising/falling trigger, deterministic post-trigger pause, cursors, measurements and timestamped CSV | `tests/instruments.cjs`; real UI run/step/reset, trigger/rearm and export; native PIC pause/step and stale-result cancellation |
| CS-036 | Single-file AVR C editor/compiler, diagnostic line selection, source breakpoint/resume that pauses analog too, global/static RAM byte inspection | `tests/compiler.cjs`, `tests/test_compiler.py`; uses real AVR-GCC/ELF debug information |
| CS-062 | Keyboard component outline, small-screen reflow, trace ring buffer, benchmark record and updated reproducible lab guide | `tests/usability.cjs`, existing blink/button/ADC suites; `docs/evidence/usability.json`, `docs/LAB_GUIDE.md` |

## Scope and numerical limits

- Shared mode exchanges analog inputs once per selected 1/10/100 µs interval.
  Outputs retain backend instruction-completion timestamps. Bidirectional input
  feedback therefore has interval latency plus instruction quantization; this is
  not silicon-cycle-accurate mixed-signal simulation. Legacy independent timing
  remains available for compatibility and faster simple demonstrations.
- Generic GPIO uses 30 Ω output resistance, 30 kΩ weak pulls and 1 TΩ high-Z
  leakage. Digital thresholds are 0.3/0.6 of 5 V with hysteresis. An initially
  undefined input band becomes a low CPU bit; a previous valid bit is retained.
  `NET:` logic traces resolve the modeled MCU driver states, not every analog
  element connected to the net. Analog node traces show the solved voltages.
- PIC16 RA4 open-drain and PORTB weak-pull behavior is represented. The PIC18F4520
  RA4 is a digital output, unlike the older PIC18F452; it is not incorrectly
  assigned the older part's open-drain model. See Microchip's
  [migration note](https://ww1.microchip.com/downloads/en/devicedoc/39647a.pdf).
- One MCU package is supported per project simulation. Exact DIP maps are used
  for the chip profiles. Uno/Nano symbols expose the existing simulated header
  signals plus supply, reset and AREF; they are not complete Arduino board models
  or validated board-module footprints. USB, regulators, oscillator waveforms,
  fuse-dependent clocks and power consumption are not modeled. MCU packages
  require shared timing. Supply/reset faults pause with a diagnostic; they do not
  implement electrical brownout/reset dynamics. A 1 µs analog startup settle
  precedes CPU time for an explicitly powered package.
- Source debugging covers the three ATmega328P profiles with AVR-GCC installed.
  It inspects RAM symbols as unsigned bytes, not C types/local stack variables.
  PIC remains HEX-based. Breakpoints/compiled debug maps are rebuilt after reopen;
  source text, breakpoint line, profile and firmware are saved in the project.
  Builds are bounded to 20 seconds, 512 MiB address space and 8 MiB output files.
- Scope capture retains at most 200,000 digital transitions and 20,000 analog
  frames of up to 64 voltage channels and reports discarded records. Dense plot columns are visually marked;
  CSV retains the full surviving capture. Trigger pause occurs at the first
  exchange boundary after the requested post-trigger span.
- Performance results are measurements on the recorded machine, not real-time
  guarantees. Native PIC shared mode is slower because exchanges cross a local
  worker boundary. Scaling checks exercise equivalent CSS viewport widths, not
  every desktop compositor or screen-reader combination.

## Still open: five original tickets

- **CS-035:** UART/I2C/SPI instruments and integrated LCD/OLED/EEPROM lab exercises,
  including NACK, clock stretching, SPI modes and firmware-to-peripheral coupling.
- **CS-050:** Additional AVR/8051 target audit and integration follow-through;
  generic C52 execution is not exact AT89S52 support.
- **CS-051:** Selected STM32/ESP32 audit and integration decision. Existing STM32
  boot evidence does not validate GPIO/analog coupling or peripheral completeness.
- **CS-071:** Hierarchical sheets, variants and reuse with BOM/PCB identity mapping.
  Existing upstream subcircuit tools alone do not satisfy this full ticket.
- **CS-073:** Push/shove, constrained differential pairs, length matching, HDI via
  spans and output jobs. Existing manual two-layer routing is not this feature set.

No acceptance requirement for those five tickets has been replaced with a
placeholder or marked complete based only on a UI control.
