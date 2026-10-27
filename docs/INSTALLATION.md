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
The menu uses the `circuit-studio` themed icon, installed in the sibling
`icons/hicolor` directory at 16–256 pixel sizes plus scalable SVG. Available
GTK icon-cache and desktop-database utilities are refreshed after installation
and removal. Uninstall preserves customized icons, just like modified shortcuts.
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

The desktop window asks **Keep editing / Close without saving** when a project
has unsaved changes. Keep editing is the default; use **Save locally** or
**Save file** before closing to retain your work. The normal recovery checkpoint
also runs on close, but a recovery copy does not replace an explicitly saved project.
If upgrading from alpha.7 or earlier while its window refuses to close, choose
**Save locally**, wait for **Saved on disk**, then close and reopen from Applications.
The new confirmation takes effect in the reopened window.

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

## Optional AVR C toolchain

Bundled HEX examples, simulation and instruments do not require a compiler. The
in-app C editor requires `gcc-avr`, `avr-libc` and `binutils-avr` on PATH. A user-owned
toolchain can instead be installed under
`~/.local/share/circuit-studio/toolchains/avr/usr/`, retaining its bin/lib layout,
or selected with `CIRCUIT_STUDIO_AVR_BIN=/path/to/bin`. The app never installs system
packages automatically. The compiler integration currently targets ATmega328P.

## Applications menu launch on Ubuntu 24.04 and later

Ubuntu restricts unprivileged user namespaces for applications without an
AppArmor profile. A bundled Electron build in a user-local directory can therefore
abort with `The SUID sandbox helper binary was found, but is not configured correctly`
when opened from Applications, even if it works from a development terminal.

For the default `~/.local/share/circuit-studio` installation, install the supplied
application-specific profile once:

```sh
sudo install -o root -g root -m 0644 packaging/circuit-studio.apparmor /etc/apparmor.d/circuit-studio
sudo apparmor_parser -r /etc/apparmor.d/circuit-studio
```

Alpha.5 archives released before this fix do not contain the profile; download
`circuit-studio.apparmor` from the alpha.5 release assets and use that file in the
first command. Future source packages include it under `packaging/`.
The rule matches only Circuit Studio's bundled Electron executables under its
versioned default install directory, so ordinary upgrades retain the fix. Custom
install prefixes require an appropriately adjusted executable path. This setup is
specific to AppArmor-capable Ubuntu systems; it does not disable Chromium's
sandbox, change global kernel restrictions, set user-owned files setuid, or alter
projects/profiles. The system profile persists after uninstall and may be removed
by an administrator if no Circuit Studio installation uses it.

Reference: [Ubuntu's user namespace restrictions and app-specific profiles](https://documentation.ubuntu.com/release-notes/24.04/#unprivileged-user-namespace-restrictions).
Verified on 27 October 2026 by launching the installed `.desktop` entry via the
user session service manager (outside the development app's profile): a visible
Circuit Studio window, the `circuit-studio` AppArmor label, and renderer seccomp
filtering were present. No `--no-sandbox` flag was added.
