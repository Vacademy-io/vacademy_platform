#!/bin/bash
#
# Mac App Store build script for ZOE Edtech.
#
# Ships as the macOS platform of the EXISTING "ZOE Edtech" app record
# (app id 6794024192, team 7XKD5M7288 / Saurabh Kumar), so it carries the SAME
# bundle id as the ZOE iOS app — io.zoeedtech.app. A different id would create a
# separate listing instead of joining that record.
#
# Outputs dist-mas-zoe/ZOE Edtech-<ver>.pkg, ready for Transporter / altool.
# This does NOT touch the Windows Store build (electron-builder.zoe-store.json).
#
# See ZOE_MAS_SETUP.md for the Apple-side setup and the traps this works around.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PARENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

# electron-builder reuses mas.identity as the qualifier for the INSTALLER cert
# lookup, and it is a plain substring match — so it must be the part BOTH certs
# share. Do NOT export CSC_NAME: it is applied globally and breaks that lookup.
SIGN_QUALIFIER="Saurabh Kumar (7XKD5M7288)"
INSTALLER_IDENTITY="3rd Party Mac Developer Installer: Saurabh Kumar (7XKD5M7288)"

cleanup() {
    if [ -f "$SCRIPT_DIR/package.json.bak" ]; then
        mv "$SCRIPT_DIR/package.json.bak" "$SCRIPT_DIR/package.json"
        echo -e "${YELLOW}🔄 Restored original package.json${NC}"
    fi
}
trap cleanup EXIT

echo -e "${BLUE}🚀 Building ZOE Edtech — Mac App Store (arm64)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Step 1: frontend, with reader mode ON ────────────────────────────────────
# Guideline 3.1.1 applies to the Mac App Store too, so the store bundle must hide
# commerce exactly like iOS does. VITE_MAC_APP_STORE is read by vite.config.ts as
# a `define` (__MAC_APP_STORE__) — NOT via import.meta.env, which would silently
# compile to false and ship a non-compliant package that looks fine.
echo -e "${BLUE}🌐 Building frontend (reader mode ON)...${NC}"
cd "$PARENT_DIR"
VITE_MAC_APP_STORE=true VITE_ELECTRON_APP_ID="com.zoeedtech.app" pnpm run build
echo -e "${GREEN}✅ Frontend built${NC}"
echo ""

# ── Step 2: verify the compliance flag actually compiled in ──────────────────
# The flag fails silently by design, so never trust it — check the built JS.
echo -e "${BLUE}🔎 Verifying reader-mode gate in the compiled bundle...${NC}"
if ! python3 "$SCRIPT_DIR/verify-reader-mode.py" "$PARENT_DIR/dist"; then
    echo -e "${RED}❌ Refusing to build a store package with commerce exposed.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Reader mode verified${NC}"
echo ""

# ── Step 3: stage the web bundle into the Electron app ──────────────────────
echo -e "${BLUE}📁 Copying frontend build to electron/app...${NC}"
rm -rf "$SCRIPT_DIR/app"
cp -r "$PARENT_DIR/dist" "$SCRIPT_DIR/app"

# Record which OTA bundle version is baked in. electron/src/ota.ts compares this
# against the OTA stream; without it the shell falls back to the Electron package
# version, which is a different numbering space and breaks every comparison.
WEB_VERSION=$(node -p "require('$PARENT_DIR/package.json').version")
echo -n "$WEB_VERSION" > "$SCRIPT_DIR/app/ota-bundle-version.txt"
echo -e "${GREEN}✅ Frontend copied (packaged OTA bundle version: ${WEB_VERSION})${NC}"
echo ""

cd "$SCRIPT_DIR"

# ── Step 4: flavor + OTA identity ───────────────────────────────────────────
# otaAppId is the STORE bundle id, which is what OTA target_app_ids match on, so
# a bundle targeting ZOE reaches the iOS app and this Mac app alike.
echo -e "${BLUE}📝 Writing electron-flavor.json...${NC}"
echo '{"flavor":"zoe","otaAppId":"io.zoeedtech.app"}' > "$SCRIPT_DIR/electron-flavor.json"
echo -e "${GREEN}✅ Flavor file written${NC}"
echo ""

# ── Step 5: ZOE branding in package.json ────────────────────────────────────
echo -e "${BLUE}📝 Patching package.json for ZOE Edtech...${NC}"
cp "$SCRIPT_DIR/package.json" "$SCRIPT_DIR/package.json.bak"
node -e "
const fs = require('fs');
const p = '$SCRIPT_DIR/package.json';
const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
pkg.name = 'ZOE_Edtech';
pkg.description = 'ZOE Global Edtech — AI-Powered Learning Platform';
pkg.author = { name: 'ZOE Global Edtech', email: 'support@zoeedtech.com' };
fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
"
echo -e "${GREEN}✅ package.json patched${NC}"
echo ""

# ── Step 6: clean + compile the Electron main process ───────────────────────
echo -e "${BLUE}🧹 Cleaning previous MAS builds...${NC}"
rm -rf dist-mas-zoe build
echo -e "${BLUE}📝 Compiling Electron TypeScript...${NC}"
npm run build
echo -e "${GREEN}✅ TypeScript compiled${NC}"
echo ""

# ── Step 7: build the signed .app ───────────────────────────────────────────
# electron-builder 23.6.0 exits 0 without ever producing the .pkg, and crashes on
# universal MAS builds — so build the .app here and package it with productbuild
# below. Keep --publish never so nothing is pushed to a release feed.
echo -e "${BLUE}🔨 Building MAS .app (arm64)...${NC}"
npx electron-builder build --mac mas -c ./electron-builder.zoe-mas.json --publish never
echo ""

APP_PATH=$(find dist-mas-zoe -maxdepth 2 -name "*.app" -print -quit)
if [ -z "$APP_PATH" ]; then
    echo -e "${RED}❌ No .app produced — check the electron-builder output above.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Signed app: ${APP_PATH}${NC}"

# ── Step 8: wrap it in an installer package ─────────────────────────────────
PKG_PATH="dist-mas-zoe/ZOE-Edtech-MAS.pkg"
echo -e "${BLUE}📦 Building installer package...${NC}"
rm -f "$PKG_PATH"
productbuild --component "$APP_PATH" /Applications --sign "$INSTALLER_IDENTITY" "$PKG_PATH"
echo ""

echo -e "${GREEN}✅ Build complete${NC}"
ls -lh "$PKG_PATH" | awk '{print "   📦 " $9 " (" $5 ")"}'
echo ""
echo "Verify the signature and entitlements:"
echo "   codesign -dv --entitlements - \"$APP_PATH\""
echo ""
echo "Upload:"
echo "   xcrun altool --upload-app -f \"$PKG_PATH\" -t macos \\"
echo "     --apiKey PSXF55PAG3 --apiIssuer ce0d8810-9d44-4cd7-9817-f825bb51bf2e"
