# Circuit Studio 0.4 acceptance ledger

The full roadmap is **not finished**. This update adds four completed tickets to
the 15-ticket milestone: **19 of the original 29**. This is ticket count, not a
percentage of Proteus parity. Coding Hub automation is an additional requested
feature and does not inflate the original denominator.

| Ticket | Delivered behavior | Acceptance evidence |
|---|---|---|
| CS-042 | Physical same-net copper intersection connectivity, layer isolation, through vias, two-layer routing and clearance-aware solid pours | `tests/routing.cjs`: front crossing joins; back crossing stays isolated; a through via joins layers; unsupported pad-layer access is reported; zone holes clear other nets; undo and file round trip retain geometry. |
| CS-043 | Shared DRC gate for KiCad and Gerber; exported via drills and filled zones preserve copper geometry | Opposite-net crossing blocks both exports. `spikes/verify-routing.py` independently parses Gerber/Excellon with Gerbonara and compares zone geometry/clearances against KiCad CLI output. `filled_areas_thickness no` prevents KiCad from expanding filled boundaries. Existing package export tests cover 42 pads, rotations and side-specific mask/paste. |
| CS-061 | Checksummed offline installer, versioned app directories, optional bundled Electron, data outside installation and conservative uninstall | `tests/test_install.py`: hash failure, idempotence, unrelated launcher preservation, changed-file preservation, symlink boundary and user project retention. Fresh extracted runtime smoke test runs real circuit creation/simulation and native backend fixtures; details in `docs/evidence/release-smoke.json`. |
| CS-072 | Interactive 3D board, glTF/STL export, mechanical origin manifest | `tests/routing.cjs` renders the preview and exports models. Trimesh independently checks board XY extent, mm/m units, front/back component origins, and open drill sections through laminate and copper. |

## Coding Hub integration

`circuitctl.py` uses the real component factory and engine in an isolated browser;
JSON plans are atomic and `apply` requires the current SHA-256 revision. It can
add/inspect/edit/delete parts, connect pins, transfer and route a PCB, create vias
and zones, run ERC/DRC, simulate analog circuits and export SVG/KiCad.

`circuit_mcp.py` supplies eight optional stdio tools confined to one workspace.
The Coding Hub repository adds `codehub circuit` and project instructions without
changing provider permissions. Tests cover the instruction context, path
boundaries, literal arguments, overwrite refusal, rollback and revision conflicts.
The end-to-end fixture creates a 5 V / 10k / 10k circuit and verifies 2.5 V and
0.25 mA, then edits it, places an op-amp and names an external voltage source.
This tests the adapter and actual engine, not a live paid AI-provider conversation.

## Still open

- CS-031/033: production shared simulation clock/net states and on-schematic MCUs
  with explicit power/reset/clock and firmware attachment.
- CS-034/035/036: common-time instruments, protocol/peripheral models and compiler/source debugger.
- CS-050/051: additional MCU integrations and audit follow-through. New native
  probes test AVR GPIO timing, generic 8052 timing and selected STM32 boot; these
  do not enable or certify additional editor targets. See [backend audit](BACKEND_AUDIT.md).
- CS-062: comprehensive accessibility/performance/lab acceptance across the new workflows.
- CS-071/073: hierarchy/variants and advanced routing, differential pairs, length matching, HDI/output jobs.

## Limits of the new PCB/mechanical features

The board remains 100 × 60 mm, 1.6 mm thick, with 0.5 mm tracks and a 0.25 mm
clearance policy. Vias are plated through both layers. Solid pours have no thermal
reliefs or minimum-neck/island policy. This does not add a push/shove router,
autorouter, differential-pair rules, blind/buried vias, courtyard checking or
complete manufacturing-rule coverage. Gerber silkscreen is still not exported.

3D package bodies are approximate envelopes; pad/drill positions and component
origins derive from the same footprint data. No manufacturer STEP model accuracy
or enclosure-fit certification is claimed. Existing MCU independent-clock limits
remain; the analog automation command does not execute MCU firmware.
