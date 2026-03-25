#!/bin/bash

# Production Windows build script for Shiksha Nation (x64 + x86)
# Sets FLAVOR=shikshanation for capacitor.config.ts
# Sets VITE_ELECTRON_APP_ID for the frontend flavor resolution

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Ensure package.json is restored even if the build fails
cleanup() {
    if [ -f "$SCRIPT_DIR/package.json.bak" ]; then
        mv "$SCRIPT_DIR/package.json.bak" "$SCRIPT_DIR/package.json"
        echo "🔄 Restored original package.json"
    fi
}
trap cleanup EXIT

export FLAVOR="shikshanation"
export VITE_ELECTRON_APP_ID="com.shikshanation.new.app"

echo "🚀 Building Shiksha Nation Windows Electron App (x64 + x86)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   FLAVOR=$FLAVOR"
echo "   VITE_ELECTRON_APP_ID=$VITE_ELECTRON_APP_ID"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PARENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Step 1: Build the frontend with Shiksha Nation flavor
echo -e "${BLUE}🌐 Building frontend with Shiksha Nation flavor...${NC}"
cd "$PARENT_DIR"
VITE_ELECTRON_APP_ID="$VITE_ELECTRON_APP_ID" pnpm run build
echo -e "${GREEN}✅ Frontend built${NC}"
echo ""

# Step 2: Copy frontend build to electron/app
echo -e "${BLUE}📁 Copying frontend build to electron/app...${NC}"
rm -rf "$SCRIPT_DIR/app"
cp -r "$PARENT_DIR/dist" "$SCRIPT_DIR/app"
echo -e "${GREEN}✅ Frontend copied${NC}"
echo ""

cd "$SCRIPT_DIR"

# Step 3: Write flavor file so capacitor.config reads it at runtime
echo -e "${BLUE}📝 Writing electron-flavor.json...${NC}"
echo '{"flavor":"shikshanation"}' > "$SCRIPT_DIR/electron-flavor.json"
echo -e "${GREEN}✅ Flavor file written${NC}"
echo ""

# Step 4: Patch package.json for Shiksha Nation branding
echo -e "${BLUE}📝 Patching package.json for Shiksha Nation...${NC}"
cp "$SCRIPT_DIR/package.json" "$SCRIPT_DIR/package.json.bak"
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('$SCRIPT_DIR/package.json', 'utf8'));
pkg.name = 'Shiksha_Nation';
pkg.description = 'AI-Powered Learning Platform';
pkg.author = { name: 'SHIKSHA NATION', email: 'support@shikshanation.com' };
fs.writeFileSync('$SCRIPT_DIR/package.json', JSON.stringify(pkg, null, 2) + '\n');
"
echo -e "${GREEN}✅ package.json patched${NC}"
echo ""

# Step 5: Clean previous electron builds
echo -e "${BLUE}🧹 Cleaning previous builds...${NC}"
rm -rf dist
rm -rf build
echo -e "${GREEN}✅ Clean complete${NC}"
echo ""

# Step 6: Ensure dependencies
echo -e "${BLUE}📦 Checking dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules not found, installing...${NC}"
    npm install
fi
echo -e "${GREEN}✅ Dependencies ready${NC}"
echo ""

# Step 5: Compile TypeScript
echo -e "${BLUE}📝 Compiling TypeScript...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ TypeScript compilation failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ TypeScript compiled${NC}"
echo ""

# Step 6: Verify node_modules structure
echo -e "${BLUE}🔍 Verifying node_modules structure...${NC}"
if [ -d "node_modules/.pnpm" ]; then
    echo -e "${YELLOW}⚠️  Detected pnpm structure${NC}"
    PNPM_SIZE=$(du -sh node_modules/.pnpm 2>/dev/null | cut -f1)
    echo "   .pnpm directory size: $PNPM_SIZE"
fi
MODULE_COUNT=$(find node_modules -type d -name "node_modules" | wc -l)
echo "   Found $MODULE_COUNT module directories"
echo -e "${GREEN}✅ node_modules verified${NC}"
echo ""

# Step 7: Build with electron-builder using Shiksha Nation config
echo -e "${BLUE}🔨 Building Windows installers (x64 + x86)...${NC}"
echo "   Using config: electron-builder.shikshanation.json"
echo "   This will create:"
echo "   • NSIS installers for x64 and x86"
echo "   • Portable executables for x64 and x86"
echo ""

npx electron-builder build --win -c ./electron-builder.shikshanation.json

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Build complete!${NC}"
echo ""

# Step 8: Show build results
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📊 Shiksha Nation Build Results:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -d "dist" ]; then
    echo "Installers:"
    ls -lh dist/*.exe 2>/dev/null | awk '{print "  📦 " $9 " (" $5 ")"}'
    echo ""

    echo "Unpacked directories:"
    for dir in dist/win-*unpacked; do
        if [ -d "$dir" ]; then
            SIZE=$(du -sh "$dir" 2>/dev/null | cut -f1)
            ARCH=$(basename "$dir" | sed 's/win-//' | sed 's/-unpacked//')
            echo "  📁 $ARCH: $SIZE"

            if [ -d "$dir/resources/app/node_modules" ]; then
                NM_SIZE=$(du -sh "$dir/resources/app/node_modules" 2>/dev/null | cut -f1)
                echo "     └─ node_modules: $NM_SIZE ✅"
            else
                echo "     └─ ⚠️  WARNING: node_modules missing!"
            fi
        fi
    done
    echo ""

    echo "Total dist size:"
    DIST_SIZE=$(du -sh dist 2>/dev/null | cut -f1)
    echo "  💾 $DIST_SIZE"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Shiksha Nation build completed successfully!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
# Restore original package.json
echo -e "${BLUE}🔄 Restoring original package.json...${NC}"
mv "$SCRIPT_DIR/package.json.bak" "$SCRIPT_DIR/package.json"
echo -e "${GREEN}✅ package.json restored${NC}"
echo ""

echo "Installation tips:"
echo "  • x64 version for 64-bit Windows (most common)"
echo "  • Portable versions don't require installation"
echo ""
