# TermiSSH - Modern Linux Terminal, SSH, Telnet & Serial Workspace

<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="TermiSSH Logo" width="96" height="96" />
</p>

<p align="center">
  <strong>The modern, secure, and developer-focused terminal client and infrastructure workspace for Linux.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Linux%20(Universal)-blue?logo=linux" alt="Platform" />
  <img src="https://img.shields.io/badge/Protocols-SSH%20%7C%20Telnet%20%7C%20Serial-emerald" alt="Protocols" />
  <img src="https://img.shields.io/badge/Security-AES--256--GCM%20Vault-green" alt="Security" />
  <img src="https://img.shields.io/badge/Theme-Octet%20Dark%20Navigation-darkgrey" alt="Theme" />
  <img src="https://img.shields.io/badge/Packaging-deb%20%7C%20tar.xz-orange" alt="Packaging" />
  <img src="https://img.shields.io/badge/Tests-23%20Passed-brightgreen" alt="Tests" />
</p>

---

## 🌟 Overview

**TermiSSH** is a high-performance, production-ready desktop terminal suite and server management platform designed for Linux engineers, sysadmins, DevOps, and network administrators. Engineered with a Rust core (`Tauri 2`) and a React 19 + TypeScript frontend, TermiSSH combines raw terminal speed with enterprise features: multi-protocol connections (SSH, Telnet, Serial Console), dual-pane graphical SFTP, direct port forwarding tunnels, AES-256-GCM secret vaulting, interactive parameterized snippets, split layouts, and OpenSSH config synchronization.

The application is styled with the **Octet Design "Dark Navigation"** color palette (`#0a0a0a`, `#19191a`, `#2a2a2a`, `#363636`, `#938a87`, `#f4f4f5`), delivering a clean, distraction-free environment.

---

## 🚀 Key Features

### 1. Multi-Protocol Terminal & Local Shell
- **Interactive SSH-2 Pseudoterminals (PTY)**: Powered by `russh 0.64` and `@xterm/xterm`. Full ANSI/xterm-256color support, cursor styles, mouse tracking, and curses applications (`vim`, `htop`, `tmux`, `nano`, `less`).
- **Network Device Telnet Client**: Native RFC 854 Telnet engine with full IAC negotiation (`DO`/`DONT`/`WILL`/`WONT`), binary transmission, Echo handling, terminal type subnegotiation (`TTYPE`), and live window dimension reporting (`NAWS`).
- **Hardware Serial Console / UART**: Connect directly to switches, routers, firewalls, and microcontrollers via `/dev/ttyUSB*` and `/dev/ttyS*`. Configurable baud rates (9600, 19200, 38400, 57600, 115200, 230400, etc.), data bits, stop bits, parity (None, Even, Odd), and hardware (RTS/CTS) / software (XON/XOFF) flow control.
- **Local Shell Integration**: Launch zero-latency local Linux shells (`$SHELL`, `bash`, `zsh`) alongside remote connections.
- **Dynamic Terminal Resizing**: Real-time terminal geometry synchronization (`cols` and `rows`) through `ResizeObserver` and `fitAddon`.
- **Session Multiplexing & Split Layouts**: Split vertical (columns), split horizontal (rows), and single tab views with multi-session tabs.
- **Synchronized Input Broadcast**: Broadcast keystrokes simultaneously to multiple active terminal panes with built-in safety confirmation dialogs.

### 2. In-Terminal Command Snippets Drawer
- **Dedicated Terminal Sidebar**: Open the collapsible **Snippets** drawer directly on any active terminal tab.
- **Live Host Targeting**: Automatically detects and shows the target host (e.g. `Target: prod-db-01` or `Target: localhost`).
- **1-Click Execution (`Run`)**: Instantly executes commands with canonical carriage return (`\r`) so commands run cleanly without staircase formatting.
- **Interactive Variable Substitution**: Prompts for `{{variable:default}}` placeholders via the execution modal before sending.
- **Insert Without Enter**: Injects command strings directly into the terminal prompt without pressing Enter, allowing inspection or flag adjustments before executing.
- **Search & Category Filtering**: Filter snippets instantly by name, tag, or category (*Sysadmin*, *Docker & Containers*, *Git*, *Network*, *Database*, etc.).
- **Quick-Add Snippet**: Create and save new reusable commands without leaving the active terminal view.

### 3. Dual-Pane Graphical SFTP Manager
- **Side-by-Side Dual Panes**: Split view showing local filesystem on the left and remote server filesystem on the right.
- **Memory-Safe Chunked Transfers**: Streams file uploads and downloads in 64 KB non-blocking chunks, handling large files without memory spikes.
- **File Management**: Create folders, rename, delete files, inspect permissions, sizes, and modification dates.
- **Integrated Remote File Editor**: Safely view and edit remote files (e.g. `/etc/nginx/nginx.conf`) with atomic saving and permission preservation.

### 4. Enterprise Security & Encrypted Vault
- **AES-256-GCM Credential Vault**: Passwords and private keys are never stored in plaintext in SQLite. Secrets are encrypted using authenticated AES-256-GCM with machine-salted PBKDF2 (SHA-256) master key derivation and per-item random nonces. SQLite stores only opaque URIs (`vault://...`).
- **Strict Host Key Verification (TOFU)**: SHA-256 host key fingerprinting on initial connection with trust verification.
- **MITM Attack Prevention**: Detects changed remote server keys, immediately aborts the connection, and displays a high-visibility warning to protect against man-in-the-middle tampering.
- **SSH Key Lifecycle Management**: Generate **Ed25519** and **RSA** (2048/4096-bit) keys with optional passphrase encryption. Import OpenSSH / PKCS#8 keys, view SHA-256 fingerprints, and export `authorized_keys`.

### 5. Port Forwarding & SSH Tunnels
- **Local Port Forwarding (`-L`)**: Forward local ports to internal remote services through secure direct TCP/IP channels.
- **Dynamic Port Forwarding (`-D`)**: High-performance RFC 1928 SOCKS5 proxy server routed directly through your SSH session.
- **Port Conflict Checking**: Validates local port availability before binding to avoid crashes.

### 6. Productivity Workspaces & Quick Launcher
- **Cluster Workspaces**: Group multi-server tiers (Development, Staging, Production) and launch coordinated split terminal layouts in a single click.
- **Global Command Palette (`Ctrl+K`)**: Fast launcher to jump to any host, snippet, tunnel, or setting from anywhere in the application.
- **OpenSSH Config Synchronization**: View, edit, import, and bi-directionally sync hosts with standard OpenSSH `~/.ssh/config`.
- **Encrypted Backup & Restore**: Export full environment backups (`.termi`) encrypted with device credentials or custom passwords.
- **Session Audit Logs**: Full connection audit trail recording timestamps, durations, and diagnostic error codes.

---

## 🎨 Design & Color Palette

TermiSSH features the **Dark Navigation** theme from Octet Design:

| Role | Color | Hex | Usage |
|---|---|---|---|
| **Canvas** | Deep Black | `#0a0a0a` | Global background, terminal background, code editors |
| **Surfaces** | Dark Charcoal | `#19191a` | Sidebar, top tab bar, modals, table headers, drawer |
| **Containers** | Slate Gray | `#2a2a2a` | Elevated cards, buttons, active tabs, toolbar items |
| **Borders** | Muted Outline | `#363636` | Card borders, dividers, focus outlines |
| **Text Muted** | Neutral Gray | `#605e5e` | Inactive icons, placeholder hints, secondary labels |
| **Accent Text** | Warm Slate | `#938a87` | Navigation icons, category badges, cursor accent |
| **Primary Text**| Bright White | `#f4f4f5` | Headings, active terminal text, table records |

---

## 📦 Installation & Distribution

### Option 1: Universal Linux Archive (`.tar.xz`) — *Compatible with every Linux distro*

The standalone distribution package runs on any Linux distribution (Ubuntu, Debian, Fedora, Arch, openSUSE, Kali, Manjaro, Alpine, Mint, Void) without needing root access:

1. **Download & Extract**:
   ```bash
   tar -xf TermiSSH-1.0.0-linux-x86_64.tar.xz
   cd TermiSSH-1.0.0-linux-x86_64
   ```

2. **Run Immediately (Portable)**:
   ```bash
   ./TermiSSH.sh
   # Or directly:
   ./TermiSSH
   ```

3. **Install to User Menu & PATH** (Optional):
   ```bash
   ./install.sh
   ```
   *Installs executable to `~/.local/bin/TermiSSH`, desktop launcher to `~/.local/share/applications/TermiSSH.desktop`, and icons to `~/.local/share/icons`.*

### Option 2: Debian / Ubuntu / Kali Package (`.deb`)

```bash
sudo dpkg -i TermiSSH_1.0.0_amd64.deb
# Or using apt:
sudo apt install ./TermiSSH_1.0.0_amd64.deb
```

---

## 💻 System Requirements

TermiSSH links against standard Linux desktop libraries:
- **Display**: X11 or Wayland
- **Libraries**:
  - `GTK 3` (`libgtk-3-0` or `gtk3`)
  - `WebKit2GTK 4.1` (`libwebkit2gtk-4.1-0` or `webkit2gtk4.1`)
  - `GLib / GIO` (`libglib2.0-0` or `glib2`)

### Installing System Dependencies on Common Distributions

- **Ubuntu / Debian / Kali / Linux Mint**:
  ```bash
  sudo apt install libwebkit2gtk-4.1-0 libgtk-3-0 libsoup-3.0-0
  ```
- **Fedora / RHEL / CentOS**:
  ```bash
  sudo dnf install webkit2gtk4.1 gtk3 libsoup3
  ```
- **Arch Linux / Manjaro / EndeavourOS**:
  ```bash
  sudo pacman -S webkit2gtk-4.1 gtk3 libsoup3
  ```
- **openSUSE (Tumbleweed / Leap)**:
  ```bash
  sudo zypper install libwebkit2gtk-4_1-0 libgtk-3-0 libsoup-3_0-0
  ```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Description |
|---|---|
| `Ctrl + K` | Open Global Command Palette & Quick Connect |
| `Ctrl + F` | Search text inside active terminal buffer |
| `Ctrl + Shift + C` | Copy selected terminal text |
| `Ctrl + Shift + V` | Paste clipboard text into active terminal |
| `Ctrl + Tab` | Switch to next open terminal session |
| `Escape` | Close modals / cancel search overlays |

---

## 🛠️ Building from Source

### Prerequisites
- **Node.js** 20+ and `pnpm`
- **Rust Toolchain** 1.80+ (`rustup`, `cargo`)
- **System development packages**:
  ```bash
  sudo apt install build-essential libwebkit2gtk-4.1-dev libgtk-3-dev libsoup-3.0-dev libssl-dev pkg-config
  ```

### Build Instructions

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/LinuxSSH.git
   cd LinuxSSH
   ```

2. **Install frontend packages**:
   ```bash
   pnpm install
   ```

3. **Run in development mode**:
   ```bash
   pnpm tauri dev
   ```

4. **Build production binaries and packages**:
   ```bash
   # Compile frontend & release binary:
   pnpm build
   pnpm tauri build --bundles deb

   # Package standalone tar.xz:
   ./scripts/package-tar-xz.sh
   ```

---

## 🧪 Automated Test Suite

TermiSSH has an end-to-end test suite verifying the Rust backend, SQLite schema, AES-256-GCM vault, Telnet RFC 854 engine, serial ports, and live SSH connections:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

**Verified Test Coverage (23 Tests Passing)**:
- `db::tests::test_db_initialization_and_seeds`
- `db::tests::test_host_crud`
- `db::tests::test_known_hosts_verification`
- `vault::tests::test_vault_roundtrip`
- `keys::tests::test_ed25519_key_generation`
- `keys::tests::test_passphrase_protected_key`
- `keys::tests::test_rsa_key_generation`
- `backup::tests::test_device_key_backup_and_restore_always_encrypted`
- `backup::tests::test_password_encrypted_backup_validation`
- `telnet_engine::tests::test_escape_telnet_input`
- `telnet_engine::tests::test_format_naws_subneg`
- `telnet_engine::tests::test_telnet_parser_escaped_iac`
- `telnet_engine::tests::test_telnet_parser_strips_iac_and_replies_do_echo`
- `telnet_engine::tests::test_telnet_parser_ttype_subnegotiation`
- `telnet_engine::tests::test_telnet_engine_end_to_end`
- `telnet_engine::tests::test_live_gateway_telnet_connection`
- `serial_engine::tests::test_list_serial_ports`
- `serial_engine::tests::test_serial_port_pair_bidirectional_comm`
- `ssh_engine::tests::test_process_stream_spawn`
- `ssh_engine::tests::test_resolve_ssh_config_directives`
- `commands::tests::test_get_ssh_config_reads_or_reports_missing`
- `commands::tests::test_import_and_format_openssh_config`
- `ssh_integration_test::test_ssh_engine_end_to_end`

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
