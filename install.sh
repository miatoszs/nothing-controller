#!/usr/bin/env bash
set -e

EXT_UUID="nothing-ear@radiance.gnome.org"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${HOME}/.local/share/gnome-shell/extensions/${EXT_UUID}"

echo "=== Installing Nothing & CMF Earbuds GNOME Extension ==="

# 1. Compile schemas
echo "Compiling GSettings schemas..."
glib-compile-schemas "${SRC_DIR}/schemas"

# 2. Create target directory
echo "Creating target directory: ${TARGET_DIR}"
mkdir -p "${TARGET_DIR}"

# 3. Copy files
echo "Copying extension files..."
cp -r "${SRC_DIR}/metadata.json" "${TARGET_DIR}/"
cp -r "${SRC_DIR}/extension.js" "${TARGET_DIR}/"
cp -r "${SRC_DIR}/prefs.js" "${TARGET_DIR}/"
cp -r "${SRC_DIR}/backend.py" "${TARGET_DIR}/"
cp -r "${SRC_DIR}/stylesheet.css" "${TARGET_DIR}/"
cp -r "${SRC_DIR}/schemas" "${TARGET_DIR}/"
cp -r "${SRC_DIR}/assets" "${TARGET_DIR}/"
cp -r "${SRC_DIR}/icons" "${TARGET_DIR}/"

chmod +x "${TARGET_DIR}/backend.py"

# 4. Compile schemas in target directory
glib-compile-schemas "${TARGET_DIR}/schemas"

echo "Extension installed successfully!"
echo "To enable, run: gnome-extensions enable ${EXT_UUID}"
