#!/bin/bash

# Production Windows build script for SSDC Horizon (x64 + x86)
# Full end-to-end: builds frontend with SSDC flavor, compiles Electron, packages installer

set -e

export VITE_ELECTRON_APP_ID="io.vacademy.student.app"

echo "🚀 Building SSDC Horizon Windows Electron App (x64 + x86)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   VITE_ELECTRON_APP_ID=$VITE_ELECTRON_APP_ID"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PARENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Step 1: Build the frontend with SSDC flavor
echo -e "${BLUE}🌐 Building frontend with SSDC flavor...${NC}"
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
echo '{"flavor":"ssdc"}' > "$SCRIPT_DIR/electron-flavor.json"
echo -e "${GREEN}✅ Flavor file written${NC}"
echo ""

# Step 4: Clean previous electron builds
echo -e "${BLUE}🧹 Cleaning previous builds...${NC}"
rm -rf dist
rm -rf build
echo -e "${GREEN}✅ Clean complete${NC}"
echo ""

# Step 5: Ensure dependencies
echo -e "${BLUE}📦 Checking dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules not found, installing...${NC}"
    npm install
fi
echo -e "${GREEN}✅ Dependencies ready${NC}"
echo ""

# Step 6: Compile TypeScript
echo -e "${BLUE}📝 Compiling TypeScript...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ TypeScript compilation failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ TypeScript compiled${NC}"
echo ""

# Step 7: Verify node_modules structure
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

# Step 8: Build with electron-builder using SSDC asar config
echo -e "${BLUE}🔨 Building Windows installers (x64 + x86)...${NC}"
echo "   Using config: electron-builder.production-asar.json"
echo "   This will create:"
echo "   • NSIS installers for x64 and x86"
echo "   • Portable executables for x64 and x86"
echo ""

npx electron-builder build --win -c ./electron-builder.production-asar.json

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Build complete!${NC}"
echo ""

# Step 9: Show build results
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📊 SSDC Horizon Build Results:${NC}"
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
echo -e "${GREEN}✅ SSDC Horizon build completed successfully!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Installation tips:"
echo "  • x64 version for 64-bit Windows (most common)"
echo "  • ia32 version for 32-bit Windows (older systems)"
echo "  • Portable versions don't require installation"
echo ""
