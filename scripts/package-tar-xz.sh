#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

VERSION="1.0.0"
ARCH="x86_64"
DIST_DIR_NAME="TermiSSH-${VERSION}-linux-${ARCH}"
BUILD_TMP_DIR="/tmp/termish-tar-build"
OUT_TARBALL="${PROJECT_ROOT}/${DIST_DIR_NAME}.tar.xz"

echo "=== Packaging TermiSSH v${VERSION} for Universal Linux (${ARCH}) ==="

# Clean build directory
rm -rf "$BUILD_TMP_DIR"
mkdir -p "$BUILD_TMP_DIR/${DIST_DIR_NAME}"
DIST_PATH="$BUILD_TMP_DIR/${DIST_DIR_NAME}"

# Verify binary
BIN_SOURCE="$PROJECT_ROOT/src-tauri/target/release/app"
if [ ! -f "$BIN_SOURCE" ]; then
    echo "Error: Release binary not found at $BIN_SOURCE. Build it first with 'pnpm tauri build'."
    exit 1
fi

echo "-> Copying and stripping release binary..."
cp "$BIN_SOURCE" "$DIST_PATH/TermiSSH"
strip --strip-unneeded "$DIST_PATH/TermiSSH"
chmod 755 "$DIST_PATH/TermiSSH"

echo "-> Copying application icons..."
cp "$PROJECT_ROOT/src-tauri/icons/icon.png" "$DIST_PATH/icon.png"
mkdir -p "$DIST_PATH/icons"
cp "$PROJECT_ROOT/src-tauri/icons/32x32.png" "$DIST_PATH/icons/32x32.png"
cp "$PROJECT_ROOT/src-tauri/icons/128x128.png" "$DIST_PATH/icons/128x128.png"
cp "$PROJECT_ROOT/src-tauri/icons/icon.png" "$DIST_PATH/icons/512x512.png"

echo "-> Creating desktop launcher..."
cat << 'EOF' > "$DIST_PATH/TermiSSH.desktop"
[Desktop Entry]
Version=1.0
Type=Application
Name=TermiSSH
GenericName=SSH & Terminal Client
Comment=Modern SSH, Telnet & Serial Console Client and Terminal Workspace for Linux
Exec=TermiSSH %u
Icon=termish
Terminal=false
Categories=Network;System;Development;TerminalEmulator;
Keywords=ssh;telnet;serial;sftp;terminal;console;putty;termius;
StartupWMClass=app
EOF
chmod 644 "$DIST_PATH/TermiSSH.desktop"

echo "-> Creating portable runner (TermiSSH.sh)..."
cat << 'EOF' > "$DIST_PATH/TermiSSH.sh"
#!/usr/bin/env bash
# TermiSSH Portable Launcher
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

# Ensure proper compositing mode for WebKitGTK across Wayland and X11
export WEBKIT_DISABLE_COMPOSITING_MODE=${WEBKIT_DISABLE_COMPOSITING_MODE:-0}

exec "$DIR/TermiSSH" "$@"
EOF
chmod 755 "$DIST_PATH/TermiSSH.sh"

echo "-> Creating installer script (install.sh)..."
cat << 'EOF' > "$DIST_PATH/install.sh"
#!/usr/bin/env bash
# TermiSSH Universal Linux Installer
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

if [ "$EUID" -eq 0 ]; then
    INSTALL_PREFIX="/usr/local"
    BIN_DIR="$INSTALL_PREFIX/bin"
    APP_DIR="$INSTALL_PREFIX/share/applications"
    ICON_DIR="$INSTALL_PREFIX/share/icons/hicolor/512x512/apps"
else
    INSTALL_PREFIX="$HOME/.local"
    BIN_DIR="$INSTALL_PREFIX/bin"
    APP_DIR="$INSTALL_PREFIX/share/applications"
    ICON_DIR="$INSTALL_PREFIX/share/icons/hicolor/512x512/apps"
fi

echo "=========================================================="
echo "          Installing TermiSSH on Linux                    "
echo "=========================================================="
echo "Target prefix: $INSTALL_PREFIX"

mkdir -p "$BIN_DIR" "$APP_DIR" "$ICON_DIR"

echo "-> Installing binary to $BIN_DIR/TermiSSH..."
cp "$DIR/TermiSSH" "$BIN_DIR/TermiSSH"
chmod 755 "$BIN_DIR/TermiSSH"

echo "-> Installing application icon to $ICON_DIR/termish.png..."
cp "$DIR/icon.png" "$ICON_DIR/termish.png"

echo "-> Installing desktop launcher to $APP_DIR/TermiSSH.desktop..."
cp "$DIR/TermiSSH.desktop" "$APP_DIR/TermiSSH.desktop"
chmod 644 "$APP_DIR/TermiSSH.desktop"

# If user-local install, ensure Exec points to $BIN_DIR/TermiSSH and Icon to icon path if needed
if [ "$EUID" -ne 0 ]; then
    sed -i "s|^Exec=.*|Exec=$BIN_DIR/TermiSSH %u|" "$APP_DIR/TermiSSH.desktop"
    sed -i "s|^Icon=.*|Icon=$ICON_DIR/termish.png|" "$APP_DIR/TermiSSH.desktop"
fi

# Update desktop database if available
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$APP_DIR" 2>/dev/null || true
fi

# Update icon cache if available
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t "$INSTALL_PREFIX/share/icons/hicolor" 2>/dev/null || true
fi

echo ""
echo "Installation complete!"
echo "You can launch TermiSSH by typing: TermiSSH"
echo "Or find 'TermiSSH' in your desktop application launcher menu."

# Check if PATH contains ~/.local/bin
if [ "$EUID" -ne 0 ]; then
    case ":$PATH:" in
        *":$HOME/.local/bin:"*) ;;
        *)
            echo ""
            echo "Note: '$HOME/.local/bin' is not in your PATH."
            echo "Add it by adding 'export PATH=\"\$HOME/.local/bin:\$PATH\"' to your ~/.bashrc or ~/.zshrc"
            ;;
    esac
fi
EOF
chmod 755 "$DIST_PATH/install.sh"

echo "-> Creating uninstaller script (uninstall.sh)..."
cat << 'EOF' > "$DIST_PATH/uninstall.sh"
#!/usr/bin/env bash
# TermiSSH Uninstaller
set -e

if [ "$EUID" -eq 0 ]; then
    INSTALL_PREFIX="/usr/local"
else
    INSTALL_PREFIX="$HOME/.local"
fi

echo "Removing TermiSSH from $INSTALL_PREFIX..."
rm -f "$INSTALL_PREFIX/bin/TermiSSH"
rm -f "$INSTALL_PREFIX/share/applications/TermiSSH.desktop"
rm -f "$INSTALL_PREFIX/share/icons/hicolor/512x512/apps/termish.png"

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$INSTALL_PREFIX/share/applications" 2>/dev/null || true
fi

echo "TermiSSH uninstalled successfully."
EOF
chmod 755 "$DIST_PATH/uninstall.sh"

echo "-> Copying README to distribution directory..."
cat << 'EOF' > "$DIST_PATH/README.txt"
TermiSSH - Modern Linux Terminal, SSH, Telnet & Serial Workspace
Version: 1.0.0 (x86_64 Linux Universal)

===================================================================
QUICK START
===================================================================

Option 1: Run Portably (No Installation Needed)
-----------------------------------------------
Just run the launcher script from this directory:
    ./TermiSSH.sh

Or run the binary directly:
    ./TermiSSH


Option 2: Install to Application Menu & System
-----------------------------------------------
To install for the current user (recommended, no root needed):
    ./install.sh

To install system-wide for all users (requires sudo):
    sudo ./install.sh

To uninstall at any time:
    ./uninstall.sh


SYSTEM DEPENDENCIES
-------------------
TermiSSH requires standard Linux desktop libraries:
- GTK 3 (libgtk-3)
- WebKit2GTK 4.1 (libwebkit2gtk-4.1)

If TermiSSH does not start, install the dependencies for your distribution:
- Ubuntu / Debian / Kali / Mint:
    sudo apt install libwebkit2gtk-4.1-0 libgtk-3-0 libsoup-3.0-0
- Fedora / RHEL:
    sudo dnf install webkit2gtk4.1 gtk3 libsoup3
- Arch Linux / Manjaro:
    sudo pacman -S webkit2gtk-4.1 gtk3 libsoup3
- openSUSE:
    sudo zypper install libwebkit2gtk-4_1-0 libgtk-3-0 libsoup-3_0-0


KEY FEATURES
------------
- Multi-Protocol: SSH-2 (Ed25519/RSA), Telnet (RFC 854), Serial Console / UART
- Graphical dual-pane SFTP file manager with remote file editor
- In-terminal command snippets drawer with live host targeting
- Local, remote, and dynamic SOCKS5 port forwarding tunnels
- Encrypted AES-256-GCM secret vault for passwords and private keys
- OpenSSH ~/.ssh/config bi-directional synchronization
- TOFU host key verification & MITM attack prevention
- Productivity workspaces with multi-pane splits (columns & rows)
- Dark Navigation theme from Octet Design

For full documentation and source code, visit:
https://github.com/your-username/LinuxSSH
EOF

echo "-> Compressing ${DIST_DIR_NAME}.tar.xz with maximum xz compression..."
rm -f "$OUT_TARBALL"
cd "$BUILD_TMP_DIR"
tar -cf - "$DIST_DIR_NAME" | xz -9 -T0 > "$OUT_TARBALL"
rm -rf "$BUILD_TMP_DIR"

echo "=========================================================="
echo "Successfully generated universal Linux archive:"
echo "  $OUT_TARBALL"
ls -lh "$OUT_TARBALL"
echo "=========================================================="
