# Original roadmap acceptance: 29 of 29 tickets

27 October 2026 · v0.4.0-alpha.4. This ledger closes the five remaining **original
acceptance gates**. It does not claim full Proteus parity, silicon certification,
or production readiness. Two of the five tickets are explicitly backend audits:
their completion means a tested feasibility result and a documented integration
decision, not five new supported MCU families. The supported editor catalog remains
the eight AVR/PIC profiles listed in the README.

| Ticket | Acceptance delivered | Reproducible evidence |
|---|---|---|
| CS-035 | UART 9600/115200 8N1, all four SPI modes, I²C ACK/NACK/repeated START/read/master NACK/clock stretching, EEPROM page wrap and write-busy behavior; live LCD/OLED/EEPROM lab | `tests/protocols.test.mjs`; `tests/peripheral-lab.cjs`; real AVR firmware and wired return drivers in `examples/lab/peripheral-lab.circuit` |
| CS-050 | Exact ATmega32/2560 core timing and input/output tests, peripheral support matrix, exact AT89S52 availability decision | Repeated native `spikes/backends/audit.py`; `docs/evidence/backend-audit.json`; [audit decisions](BACKEND_AUDIT.md) |
| CS-051 | Selected STM32F407VG boot/UART and ESP32-C3 direct-ELF boot/UART probes, explicit unsupported/unvalidated peripheral matrix and integration decision | `spikes/backends/audit.py`, `spikes/backends/esp32c3-audit.py`; both evidence JSONs; [audit decisions](BACKEND_AUDIT.md) |
| CS-071 | Hierarchical snapshot blocks, explicit parent port mapping, private named nets, unique references/pins, nested instance navigation, assembly variants and BOM identity mapping | `tests/reuse.cjs`: three divider copies at 2.5/1.25/2.5 V, nested instances, collision refusal, save/reopen identities, variant DNP/value with unchanged PCB |
| CS-073 | Bounded push/shove, constrained differential pairs, length tuning, two/four-layer stacks, blind/buried/microvia spans, checked output jobs | `tests/advanced-routing.cjs`: separate pair, mismatch rollback, 70 mm length, shove, layer-isolation and per-span drill fixtures; independent KiCad/Gerbonara checks |

## Deliberate implementation boundaries

**Protocols:** behavioral digital instruments observe instruction-timestamped MCU
pin outputs. I²C/SPI return drivers must be physically connected to the matching
MCU net using LAB_SDA/LAB_SCL/LAB_MISO External Voltage elements. SDA/SCL require
pull-ups. Arbitrary analog bus loading, multi-master arbitration, 10-bit I²C
addresses and protocol fault recovery are not modeled. The selected shared-time
exchange interval bounds return-input latency; use 1 µs for the supplied lab.
Hardware USART bytes still use the existing monitor; this UART decoder observes
GPIO frames. The unit fixtures test both baud rates and all SPI modes; the wired
AVR example exercises 9600 baud and SPI mode 0.

The EEPROM is a 32 KiB 24LC256 behavioral subset: 16-bit address, 64-byte page wrap,
5 ms write-busy/NACK and sequential reads. It resets to FF when the simulation is
prepared and is not saved as nonvolatile project contents. The OLED implements
horizontal/page addressing, display enable/invert and display RAM, not vertical
addressing, scrolling or orientation transforms. Unsupported commands NACK where
recognized as unsupported. LCD is write-only 4-bit HD44780 DDRAM/CGRAM storage,
basic initialization/clear/home/address/display/entry commands and busy delays.
Its viewer shows 16×2 character bytes; it does not render custom CGRAM glyphs,
font ROM variants, cursor animation or analog contrast. SPI is an explicit test
byte slave (A5 first, then previous MOSI byte), not a branded sensor model.

**Reuse:** these are editable snapshots expanded into the solver's flat circuit.
Instance paths supply the hierarchy browser. There are no separately editable
live linked sheets or automatic propagation from a changed template. Named ports
(including explicit bus members DATA0…DATA7) map to parent labels; omitted mappings
remain private. Ground is global. Supported built-in primitive models are checked;
MCU/custom/upstream subcircuit dependencies are rejected. Save a new template name
to version a block. Assembly variants keep PCB pads/copper and simulation unchanged;
DNP and procurement-value overrides affect the identified assembly BOM only.

**PCB:** fixed 0.5 mm tracks, 0.25 mm clearance and 100×60 mm outline remain.
Push/shove searches a finite set of orthogonal detours; it can refuse feasible
routes outside that search. It does not move pads/vias or constrained pairs.
Pair center-path geometry and gap/length mismatch are checked; no impedance solver,
skew propagation-delay model, automatic fanout or general autorouter is claimed.
Length tuning adds a rectangular detour to an axis-aligned segment and rejects
self-contact and clearance violations. The stack supports two or four copper
layers. Microvias are adjacent outer-to-inner spans; buried/blind spans have
explicit endpoints. Drill outputs are separated by span and stackup.json records
process intent; fabricators must determine dielectric thickness and drill process.
No thermal relief, courtyard, flex, arbitrary stackup or fabrication qualification.
Mechanical preview/export refuses non-through via cavities rather than drawing
an incorrect full-depth hole. Output jobs combine selected fabrication/BOM files
and the active assembly variant only after the same connectivity/clearance gates.

**MCU audit decisions:** retain simavr as the ATmega32/2560 candidate; reject generic
C52 as exact AT89S52; keep Renode STM32 and Espressif QEMU ESP32-C3 as standalone
experimental candidates. None passes the full on-schematic supported-device
contract, so no new profile is enabled. These are completed feasibility decisions,
not deferred acceptance tests disguised as supported devices.
