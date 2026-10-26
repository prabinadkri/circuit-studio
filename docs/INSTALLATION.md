# Offline installation and removal

Use the full Linux x86-64 archive for a bundled Electron/Chromium runtime. Python
3.10+ and Linux desktop libraries are required; no administrator access, npm or
online account is needed. The reference machine is Ubuntu 24.04. The smaller
source/runtime-assets archive uses an installed Chrome/Chromium instead.

Extract the archive, enter its `circuit-studio` directory, and run:

```sh
python3 install.py
circuit-studio
```

The installer verifies SHA-256 hashes, copies files to a versioned directory under
`$XDG_DATA_HOME/circuit-studio/releases/`, and switches the `current` symlink.
It registers an application-menu entry and `~/.local/bin/circuit-studio`.
If that directory is not on PATH, use the applications menu or the full launcher path.
Existing unrelated launchers are preserved. A previous Circuit Studio shortcut
can be upgraded. The source checkout can be moved after installation.

Projects live in `$XDG_DATA_HOME/circuit-studio/projects/`; profiles and browser
recovery live alongside them. Existing `projects/` files in a source checkout are
copied to the data directory when the launcher first runs with default storage;
existing destination IDs are preserved. `CIRCUIT_STUDIO_PROJECTS` overrides storage
for controlled/test environments. File export remains available for portable backups.

Uninstall using the installed version:

```sh
python3 "$HOME/.local/share/circuit-studio/current/install.py" --uninstall
```

If you changed XDG_DATA_HOME, use that path instead. Uninstall removes only
recorded application files and unchanged shortcuts. Projects, recovery profiles,
and modified application files are retained. It does not remove Python or system
browsers. Custom installs can use `--prefix`, `--bin-dir` and `--applications-dir`;
uninstall must use the same `--prefix`.

Save work and close the application before switching versions. The installer
keeps earlier release directories until uninstall; it does not replace an open
editor's unsaved project. The launcher reports a port conflict if another instance
is already listening. `./run.sh --serve --port 0` starts an isolated local server.

## Create a distribution

After building and testing:

```sh
python3 scripts/package.py --output /path/to/circuit-studio-source.tar.gz
python3 scripts/package.py --output /path/to/circuit-studio-desktop.tar.gz --electron /path/to/electron/dist
```

Packaging uses tracked and nonignored source files, includes the built assets,
licenses and corresponding source, normalizes archive entry timestamps, and emits
`distribution.json` plus an archive SHA-256 sidecar. The full archive copies the
unmodified Electron runtime and its licenses. It does not download dependencies.
CI rebuilds and tests the app, runs real-engine automation tests, and creates the
smaller archive. Full runtime bundles are separately verified before release.
