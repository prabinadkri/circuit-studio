# Component quality and workspace specification

**26 October 2026 — proposed specification.** Only the click-placement repair and palette polish described in the roadmap are implemented by this change. This document defines the next work, not current support.

## A component must say what it can do

A searchable name is not a simulated device. Store these independently:

| Record | Required information |
|---|---|
| Part identity | Stable ID/revision, generic or manufacturer designation, description, aliases, category and datasheet/source links |
| Schematic symbol | Geometry, units, pin numbers/names/electrical types, power pins, swap groups and connection anchors |
| Simulation model | Backend/version, model license, parameter units/ranges/defaults, supply and timing assumptions, unsupported behavior |
| Physical package | Exact package variant, footprint revision, pin-to-pad map, dimensions and optional 3D model |
| Verification | Fixture IDs, expected results/tolerances, last passing engine versions, software versus physical-hardware evidence |
| Provenance | Original author/source, license, modifications, redistributability and asset checksum |

Show separate capabilities: **Symbol available**, **PCB mapped**, **Simulation available**, **Fixture tested**. Expand each badge to its evidence and limits. Never show “verified” merely because a user can place it. A part can be useful for PCB design even without simulation; explain that before Run. Generic gates and ideal amplifiers must retain those names.

For example, the current Op amp is an ideal CircuitJS amplifier with output limits. Its saved GBW parameter is not implemented as bandwidth behavior in that class. Renaming it “LM358” would be misleading. A genuine LM358 entry needs an appropriate licensed model, explicit supply pins, input common-mode/output swing/slew tests and correct DIP-8/SOIC-8 mappings. LM741, LM324 and LM393 need their own reviewed behavior; a comparator's open-collector output is not a voltage source.

## Component delivery waves

This is a proposed common-lab catalog, not a claim about local shop stock or current simulation support. Exact manufacturer/package variants must be selected and documented during implementation. Reuse compatible upstream models only after their limitations pass review.

| Wave | Parts/workflows | Required finish |
|---|---|---|
| A: expose and polish existing basics | R/C/L, potentiometers, switches/pushbuttons, transformers, DC/AC/current sources, ground, probes; generic diode/Zener/LED, NPN/PNP, MOSFET; ideal op-amp/comparator, 555, logic gates and flip-flops | Searchable categories, consistent symbols, unit-aware inspector, predictable placement and fixtures. Existing Draw-menu availability is not equivalent to shell integration. |
| B: named analog and power | 1N4148/1N4007, BC547/2N2222 package variants, selected power MOSFETs, NE555, LM358/LM324/LM741/LM393, 7805/LM317 | Exact datasheets, pin order, package and model licenses; diode/LED polarity, saturation, regulator dropout and supply behavior tests. Separate ideal approximations where needed. |
| C: common digital and MCU boards | 74HC00/04/08/32/86, 74HC74/165/595, counters/decoders; current Uno/classic Nano/ATmega328P and five PIC targets | Distinguish 74HC/74LS/4000 electrical families. Full pin maps and explicit power/reset/clock. Existing MCU profiles become on-canvas parts after scheduler work. |
| D: lab peripherals | LCD1602/HD44780 with optional PCF8574 backpack, SSD1306 OLED, 7-segment displays, MAX7219, 24LC256 EEPROM, keypad, servo, DC/stepper drivers, relay, optocoupler, selected temperature/distance sensors | Protocol behavior, address/configuration options, timing/reset rules and end-to-end firmware fixtures. An animated display is insufficient without bus transactions. |
| E: additional MCU targets | ATmega32/2560 and AT89S52/8051 first; selected STM32 and ESP32 variants after backend audit | Publish exact target coverage. Instruction execution alone does not establish ADC/timer/USB/radio fidelity. Reject or explicitly flag unsupported peripherals. |

Each wave ships a small tested set, example projects and migration-safe library revisions. Do not populate the catalog with thousands of unvalidated labels.

## Symbol and footprint standards

Use vector geometry with a common stroke/spacing system. Keep pin endpoints on the editor grid, pin numbers visible, polarity/pin-1 cues unambiguous, and rotated text readable. Give power, ground, inputs and outputs consistent organization. Support multi-unit parts without duplicating physical pins. Use distinct selection, hover, error and simulation overlays so a red wire does not ambiguously mean both voltage and error.

Footprints need package-specific pad shape/size/drill/plating, courtyard, fabrication outline, assembly and silkscreen markings, solder mask/paste settings and 3D origin. A schematic triangle must never imply an arbitrary two-pad PCB package. Pin mapping survives rotation/mirror and is checked against the datasheet. Use [KiCad's library conventions](https://klc.kicad.org/) as an engineering reference; no certification is implied.

Require a preview with symbol and footprint side by side, the exact package name, pin map, electrical model and limitations. Missing assets remain visible as missing. Preserve asset licenses in downloaded project bundles and distributed libraries.

## Workspace design

Retain the calm green accent but make the canvas and engineering information the focus. The [workspace concept](workspace-concept.svg) illustrates a future layout, not implemented functionality.

- Compact project bar with file state, undo/redo and global simulation controls; workspace tabs for Schematic, Firmware, PCB and Analysis. Avoid duplicate toolbars for the same action.
- Left library panel, approximately 240 px: search by name/function/alias, category filters, favorites/recent parts, result previews and capability badges. Search should include the full integrated catalog, not only the present 19 quick tools.
- Center canvas: grid, clear connection points and ghost preview before placement; click places, drag sizes where meaningful, a dedicated rotate command rotates the preview, Escape cancels. Existing `R` means resistor in CircuitJS: provide an explicit shortcut migration rather than silently changing it to rotate.
- Right inspector, approximately 300 px: reference/value/model, units and tolerances, firmware attachment for MCUs, pin/pad mapping and documentation. Show a useful empty selection state and inline validation.
- Resizable bottom dock: waveforms, logic traces, terminal, compiler output and ERC/DRC. Clicking a finding or channel selects the corresponding object. Persist dock layout separately from electrical design state.
- Status bar: selected tool, grid, zoom, simulation clock/mode and save state. Approximate firmware coupling must be clearly labeled until synchronized simulation is implemented.

Use 13–14 px body text and at least 12 px secondary labels, with adequate hit areas and visible focus. Target [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): 4.5:1 for normal text, 3:1 for large text. Add labels/shapes for status instead of relying only on red/green. These are future acceptance targets, not a current accessibility compliance claim.

The baseline audit found no toolbar overflow at 1024, 1366 and 1440 px widths at 900 px height. Its problems are small text, inconsistent glyph icons and duplicated shell/engine controls, not a reproduced overflow failure. Retest narrow screens, scaling, long labels and keyboard navigation after layout changes.

## Detailed interaction acceptance

| Workflow | Pass condition |
|---|---|
| Place an op-amp | Search “op amp”, inspect model limits, click blank canvas, connect three visible terminals, edit limits, undo/redo, save/reopen. Existing ideal part supports placement now; named models remain future work. |
| Add a lab MCU | Select exact chip/package, see all power/reset/clock pins, attach firmware, wire inputs/outputs and see compilation/simulation errors on the relevant part. |
| Wire and edit | Wire endpoint preview snaps to a pin; crossings and junctions differ visibly. Delete/move/rotate preserve or explicitly update connections. Editing a numeric field does not trigger drawing shortcuts. |
| Set properties | “10k”, “4.7 µF” and invalid values produce unambiguous parsed values or an inline error. Defaults and model limits appear before simulation. |
| Run and debug | Global run/pause state agrees across tabs; source breakpoint stops the shared simulation clock. Trace timestamps correspond to firmware events. |
| Update PCB | A schematic value change keeps placement/routes; pin/net changes produce a reviewable update with identified conflicts. |
| Recover work | Unsaved state is visible; atomic save succeeds or reports failure; autosave recovery includes project version and timestamp. |
| Navigate | Keyboard focus order is predictable; shortcuts are discoverable and disabled while entering text. Panels resize without hiding required controls. |

Visual review covers empty project, active placement, selected component, running/paused simulation, compile failure, unsupported model, ERC findings, board routing, save failure and recovery. Screenshot fixtures must use real editor states; conceptual artwork must remain labeled as such.
