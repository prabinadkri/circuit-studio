# Circuit Studio automation and Coding Hub

The command uses the same CircuitJS component factory, solver, project validator,
ERC, PCB editor and export checks as the desktop application. Python 3 and an
installed Chrome/Chromium are sufficient; npm, a cloud account and a running
editor window are not required. Each command launches a private headless browser
profile and shuts it down afterwards. It does not take control of an open editor.

## Coding Hub workflow

In Coding Hub, select a project folder containing your circuit files. Initialize
its integration once with `codehub circuit init --project /path/to/lab --studio
/path/to/circuit-studio`. This writes `circuit-studio.json`, `CIRCUITS.md`, a local API reference/example and a
reference in `CODING_HUB.md`, preserving existing guidance. Enable **Allow edits
& commands** for an agent to make circuits. Analysis-only tasks retain Coding
Hub's existing read-only permissions. No model or account settings change.

Example instruction: “Create a 5 V divider with two 10k resistors in divider.circuit.
Use Circuit Studio's catalog and documented JSON plans. Run the analog simulation,
verify the output is 2.5 V, and export a schematic SVG. Report ERC findings.”

The agent can call `codehub circuit catalog --project .`, then `new`, `inspect`,
`apply`, `check`, `simulate`, `svg` or `kicad` using `--file divider.circuit`.
Use `--plan plan.json` for edits. `apply` requires the SHA-256
`--expected-revision` from the most recent inspection. Open the resulting `.circuit`
file using Circuit Studio's **Open** button to continue graphical editing.
Save an open editor's changes before asking an agent to edit the same file, then
reopen the result. There is no live synchronization with unsaved editor buffers.

## Direct CLI

```sh
python3 circuitctl.py catalog
python3 circuitctl.py new --project /path/to/lab/divider.circuit --plan examples/automation/voltage-divider.json
python3 circuitctl.py inspect --project /path/to/lab/divider.circuit
python3 circuitctl.py apply --project /path/to/lab/divider.circuit --plan edit.json --expected-revision REVISION_FROM_INSPECT
python3 circuitctl.py simulate --project /path/to/lab/divider.circuit --steps 1000 --time-step 0.000005
python3 circuitctl.py check --project /path/to/lab/divider.circuit
python3 circuitctl.py svg --project /path/to/lab/divider.circuit --output /path/to/lab/divider.svg
```

JSON is printed on stdout. Command failures use stderr and exit 2. `check` exits
1 for ERC errors or PCB DRC findings; warnings are returned explicitly. A project
can be a work in progress: creating/editing it does not require zero ERC findings.
Manufacturing export requires passing board checks. Simulation is bounded at
100,000 analog time steps; it does **not** run attached MCU firmware.

`new` refuses an existing file. `apply` holds an advisory lock and checks the file
revision before and after the engine operation. All operations in a plan form one
transaction. Invalid operations leave the file unchanged; successful edits use
fsync and atomic rename, preserving the previous bytes in `.circuit.previous`.
Do not delete the hidden `.circuit.lock` file while commands are active.

## JSON plans (version 1)

A plan is `{ "version": 1, "name": "Name for new projects", "operations": [...] }`.
At most 500 operations and 2,000 schematic elements are supported per command.
Use actual types from `catalog`; generic op-amps are simulation models, not
manufacturer-validated LM358/741 models. Component references must be unique.
Coordinates must be multiples of 8. Pin indices are **zero-based engine indices**,
not physical package numbers; inspect them before wiring. Physical pad mappings
are explicit metadata.

Supported operations:

* `mcu-package`: `device` from catalog, unique `ref`, optional grid-aligned `x`/`y`. Places one configured MCU package, selects that profile and shared timing. Pin/physical-package definitions are included in catalog `devices`. Wire supplies/reset explicitly. Firmware remains in the project firmware fields and is validated when loaded/run.

* `add`: `type`, `ref`, `x`, `y`, `x2`, `y2`; optional `properties` and `meta`.
* `set`: `ref` (reference or stable UUID), `properties` and/or `meta`.
* `connect`: `from` and `to` objects `{ "ref": "R1", "pin": 0 }`; optional
  `bends` array of `{ "x": 160, "y": 80 }`. Pins can also use stable pin UUIDs.
  Segments must be horizontal or vertical. Coincident pins already connect.
* `delete`: `ref`. Attached wires remain for explicit subsequent editing.
* `board-sync`: transfers packaged components and preserves valid placements/routes.
* `board-place`: `ref`, optional `x`, `y` in mm, `rotation` (0/90/180/270),
  `side` (`F.Cu` or `B.Cu`).
* `board-via`: `id` (optional `via:` identifier), `net`, `x`, `y`, optional `diameter`/`drill` in mm.
* `board-zone`: `id` (optional), `net`, `layer`, polygon `points` in mm. Solid fill; no thermal reliefs.
* `board-route`: `from`/`to` physical pad IDs such as `R1:2`, `layer`, `bends` in mm.

`properties` maps inspector indices to numbers or engineering strings (`"10k"`,
`"100n"`); text properties take literal strings. Read each component's supported
indices from `inspect`. Dropdown/model selections still use the graphical editor.
`meta` accepts `reference`, `footprint`, `padMap` and `noConnect`. A footprint must
include a unique physical pad number for each simulation pin. No-connect entries
are pin UUIDs, available from inspection. Arbitrary JavaScript is never accepted.

Example edit:

```json
{"version":1,"operations":[{"op":"set","ref":"R2","properties":{"0":"20k"}}]}
```

## Optional MCP stdio server

Clients with MCP support can launch:

```json
{"mcpServers":{"circuit-studio":{"command":"python3","args":["/path/to/circuit-studio/circuit_mcp.py","--workspace","/path/to/lab"]}}}
```

Eight tools mirror the CLI. Resources `circuit-studio://automation` and `circuit-studio://example` expose the local API guide and a complete plan to the client. `circuit_new`/`circuit_apply` accept an inline `plan`;
`circuit_apply` also requires `expectedRevision`. File paths must be relative to
the configured workspace. Requests cannot escape it through `..` or symlinks.
The server implements newline-delimited JSON-RPC over stdin/stdout, with errors
on stderr, per the [official MCP stdio transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).
No network listener is exposed by MCP; temporary engine servers bind only to
127.0.0.1 and require a per-run secret for project payloads and result submission.

Coding Hub deliberately supplies empty MCP configuration to some providers and
disables inherited plugins. Its command integration works with those existing
restrictions; installing an MCP server globally is not required or assumed.


## Graphical shortcuts

Circuit Studio's **Design with Coding Hub** action creates a private workspace
under the project's data root (`assistant/<random-id>`), writes `design.circuit`,
and runs Coding Hub's `circuit workspace` initializer with literal arguments.
Opening the chat uses the existing authenticated Coding Hub loopback service;
its session token is never returned through the Studio API or put in query strings.
The Coding Hub launch fragment selects the prepared project and is removed from
the address bar. No model request is sent until the user presses Send.

The result is read on demand through a token/Host/Origin-checked Studio endpoint.
The browser validates the full project schema and original identity before import.
A snapshot comparison refuses import over subsequent editor changes. Import is
undoable. The assistant's copy is never automatically written back to the source.
`launch.py --project PATH --port 0` opens a saved project in a separate window and
uses an isolated browser profile, leaving other windows intact.

## Alpha.4 reuse and constrained PCB operations

The same transactional `apply` plan supports:

- `block-save`: `name`; snapshots the current supported primitive circuit.
- `block-place`: saved block `name`, unique `instance`, grid offset `x`/`y`, optional
  `ports` map from a block label to a parent net label. Omitted ports are private.
- `board-stack`: `stack` is `two` or `four`.
- `board-pair`: `positive` and `negative` each contain `from`/`to` pad IDs; `layer`,
  optional center-path `center` points in mm, `gap` (copper gap, ≥0.25 mm),
  `tolerance` (length mismatch in mm). Endpoints must match the offset path.
- `board-tune`: zero-based route `index`, total `length` in mm, `side` 1 or -1.
- `board-shove`: `from`, `to`, `layer`, optional `bends`. The bounded search is
  allowed to fail and leaves the original project unchanged.
- `board-spanned-via`: `net`, `x`, `y`, `diameter`, `drill`, `span` (two ordered layer
  names), `kind` (`through`, `blind`, `micro`), optional `id` beginning `via:`.

For example, after creating a divider, save and repeat it with:

```json
{"version":1,"operations":[
  {"op":"block-save","name":"Divider"},
  {"op":"block-place","name":"Divider","instance":"ChannelB","x":640,"y":0}
]}
```

The resulting project includes the block library and explicit `meta.hierarchy`
paths. Stable source/pin IDs and parent-port mappings survive save/reopen. Imported
block dependencies outside the supported built-in primitives are rejected. Assembly
variants are in `reuse.variants` (`name`, `dnp` source UUIDs, `values` keyed by source
UUID) and `reuse.active`; they affect assembly output only. Peripheral settings are
in `peripherals`, including the explicit pin-role map. `simulate` remains analog
only; use the interactive shared-time run for the peripheral lab.
