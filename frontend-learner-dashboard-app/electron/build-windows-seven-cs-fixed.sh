#!/bin/bash

# Production Windows build script for Seven CS brand (x64 + x86)
# Ensures all node_modules are properly included in the installer

set -e

echo "🚀 Building Production Windows Electron App - Seven CS Learner (x64 + x86)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Clean previous builds
echo -e "${BLUE}🧹 Cleaning previous builds...${NC}"
rm -rf dist
rm -rf build
echo -e "${GREEN}✅ Clean complete${NC}"
echo ""

# Step 2: Ensure all dependencies are installed
echo -e "${BLUE}📦 Checking dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules not found, installing...${NC}"
    npm install
fi
echo -e "${GREEN}✅ Dependencies ready${NC}"
echo ""

# Step 3: Compile TypeScript
echo -e "${BLUE}📝 Compiling TypeScript...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ TypeScript compilation failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ TypeScript compiled${NC}"
echo ""

# Step 4: Verify node_modules structure
echo -e "${BLUE}🔍 Verifying node_modules structure...${NC}"
if [ -d "node_modules/.pnpm" ]; then
    echo -e "${YELLOW}⚠️  Detected pnpm structure${NC}"
    PNPM_SIZE=$(du -sh node_modules/.pnpm 2>/dev/null | cut -f1)
    echo "   .pnpm directory size: $PNPM_SIZE"
fi

# Count node_modules
MODULE_COUNT=$(find node_modules -type d -name "node_modules" | wc -l)
echo "   Found $MODULE_COUNT module directories"
echo -e "${GREEN}✅ node_modules verified${NC}"
echo ""

# Step 5: Build with electron-builder
echo -e "${BLUE}🔨 Building Windows installers for Seven CS (x64 + x86)...${NC}"
echo "   Brand: Seven CS Learner"
echo "   Config: electron-builder.seven_cs.json"
echo "   Targets: NSIS installer + Portable (x64, ia32)"
echo ""

npx electron-builder build --win -c ./electron-builder.seven_cs.json

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Build complete!${NC}"
echo ""

# Step 6: Show build results
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📊 Build Results - Seven CS Learner:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
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
            
            # Verify node_modules in unpacked app
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

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Seven CS Learner builds completed successfully!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Installation tips:"
echo "  • x64 version for 64-bit Windows (most common)"
echo "  • ia32 version for 32-bit Windows (older systems)"
echo "  • Portable versions don't require installation"
echo "  • Installation uses 'store' compression for reliability"
echo ""

