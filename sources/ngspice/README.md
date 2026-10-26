# Bundled ngspice provenance

`native/ngspice` is the unmodified executable from Ubuntu noble amd64 package `ngspice_42+ds-3build1_amd64.deb`, downloaded from the Ubuntu archive. Corresponding source archives, documentation source and Debian build recipe are included here. SHA-256 values match the included `.dsc` source descriptor. Copyright and complete GPL/LGPL texts are included.

To rebuild on a suitable Debian/Ubuntu build host, unpack using `dpkg-source -x ngspice_42+ds-3build1.dsc`, install the descriptor's build dependencies and run `dpkg-buildpackage` in the source directory. Other platforms may install their own ngspice and set `NGSPICE=/path/to/ngspice`. The application prefers that override, then PATH, then the bundled executable.

The binary needs the system libraries reported by `ldd native/ngspice`, including glibc, libstdc++, libedit, libtinfo and X11 support libraries. It was exercised on Ubuntu 24.04 x86-64. No claim of universal Linux ABI compatibility is made.

Archive source: https://archive.ubuntu.com/ubuntu/pool/universe/n/ngspice/
Upstream: https://ngspice.sourceforge.io/
