# TermiSSH v1.0.0 Packages & Releases

This directory contains release manifests, verification checksums, and package artifacts for **TermiSSH v1.0.0**.

## Release Artifacts

| Package | Format | Architecture | Purpose | Size | SHA-256 Checksum |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TermiSSH-1.0.0-linux-x86_64.tar.xz` | Universal Tarball (`.tar.xz`) | `x86_64` (AMD64) | Compatible with **every Linux distribution** (Arch, Fedora, Debian, Ubuntu, openSUSE, RHEL, Alpine, Void). Contains portable launcher, desktop entries, icons, and automated installer/uninstaller scripts. | ~4.9 MB | `6aa3d2de59391db6a375a1b67f7f571c33e62005469469bc0e937ff02f7f4527` |
| `TermiSSH_1.0.0_amd64.deb` | Debian Package (`.deb`) | `amd64` | Native one-step system package for Debian, Ubuntu, Linux Mint, Pop!_OS, and Kali Linux. Integrates directly into APT, `/usr/bin/TermiSSH`, and standard system menus. | ~7.8 MB | `157eec7167473d9986f634412694ad3847b4c3e5845d7179a03d7f8dcf2fa51b` |

---

## Verifying Release Integrity

To verify the integrity of downloaded release packages using `SHA256SUMS.txt`:

```bash
sha256sum -c SHA256SUMS.txt
```

Expected output:
```text
TermiSSH-1.0.0-linux-x86_64.tar.xz: OK
TermiSSH_1.0.0_amd64.deb: OK
```

---

## Quick Installation Instructions

### 1. Debian / Ubuntu / Mint / Pop!_OS (`.deb`)
```bash
sudo dpkg -i TermiSSH_1.0.0_amd64.deb || sudo apt-get install -f -y
```

### 2. Universal Linux (`.tar.xz`)

#### Portable Execution (No installation required)
```bash
tar -xf TermiSSH-1.0.0-linux-x86_64.tar.xz
cd TermiSSH-1.0.0-linux-x86_64
./TermiSSH.sh
```

#### System Install (Installs binary to `~/.local/bin` and desktop launcher to `~/.local/share/applications` without sudo)
```bash
tar -xf TermiSSH-1.0.0-linux-x86_64.tar.xz
cd TermiSSH-1.0.0-linux-x86_64
./install.sh
```

#### System Uninstall
```bash
cd TermiSSH-1.0.0-linux-x86_64
./uninstall.sh
```
