#!/bin/bash

# Complete Windows build script that builds web app AND Electron app
# Fixes the ERR_FILE_NOT_FOUND error by ensuring web app is included

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Complete Windows Build for SSDC Horizon${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Check if web app is built
echo -e "${BLUE}📱 Step 1/5: Checking web app build...${NC}"
if [ ! -d "../dist" ] || [ ! -f "../dist/index.html" ]; then
    echo -e "${YELLOW}⚠️  Web app not built. Building now...${NC}"
    cd ..
    npm run build
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Web app build failed${NC}"
        exit 1
    fi
    cd electron
    echo -e "${GREEN}✅ Web app built${NC}"
else
    echo -e "${GREEN}✅ Web app already built${NC}"
fi
echo ""

# Step 2: Clean previous Electron builds
echo -e "${BLUE}🧹 Step 2/5: Cleaning previous builds...${NC}"
rm -rf dist
rm -rf build
echo -e "${GREEN}✅ Clean complete${NC}"
echo ""

# Step 3: Install Electron dependencies if needed
echo -e "${BLUE}📦 Step 3/5: Checking Electron dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  Installing dependencies...${NC}"
    npm install
fi
echo -e "${GREEN}✅ Dependencies ready${NC}"
echo ""

# Step 4: Compile Electron TypeScript
echo -e "${BLUE}📝 Step 4/5: Compiling TypeScript...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ TypeScript compilation failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ TypeScript compiled${NC}"
echo ""

# Step 5: Build with electron-builder
echo -e "${BLUE}🔨 Step 5/5: Building Windows installers...${NC}"
echo "   This will include:"
echo "   • Web app files (211 files from ../dist)"
echo "   • Node modules (npm flat structure)"
echo "   • Compiled Electron code"
echo "   • x64 and ia32 installers"
echo ""

npx electron-builder build --win -c ./electron-builder.production.json

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Build complete!${NC}"
echo ""

# Step 6: Verify web files are included
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}🔍 Verification:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

APP_DIR="dist/win-unpacked/resources/app/app"
if [ -d "$APP_DIR" ]; then
    FILE_COUNT=$(find "$APP_DIR" -type f | wc -l)
    DIR_SIZE=$(du -sh "$APP_DIR" 2>/dev/null | cut -f1)
    echo -e "${GREEN}✅ Web app files included!${NC}"
    echo "   Location: $APP_DIR"
    echo "   Files: $FILE_COUNT"
    echo "   Size: $DIR_SIZE"
    echo ""
    echo -e "${GREEN}✅ ERR_FILE_NOT_FOUND error is FIXED!${NC}"
else
    echo -e "${RED}❌ WARNING: Web app directory not found!${NC}"
    echo "   Expected: $APP_DIR"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📊 Build Results:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -d "dist" ]; then
    echo "Installers:"
    ls -lh dist/*.exe 2>/dev/null | awk '{print "  📦 " $9 " (" $5 ")"}'
    echo ""
    
    echo "Total dist size:"
    DIST_SIZE=$(du -sh dist 2>/dev/null | cut -f1)
    echo "  💾 $DIST_SIZE"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Complete build successful!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🧪 To test:"
echo '  .\dist\win-unpacked\"SSDC Horizon.exe"'
echo ""
echo "📦 To install:"
echo '  .\dist\"SSDC Horizon Setup 1.0.7.exe"'
echo ""

