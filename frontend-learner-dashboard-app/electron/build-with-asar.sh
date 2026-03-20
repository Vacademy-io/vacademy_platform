#!/bin/bash

# Build Electron app with ASAR enabled, handling pnpm symlinks
# This script works for both macOS and Windows builds

set -e

# Parse arguments
TARGET_PLATFORM="${1:-mac}"  # Default to mac
CONFIG_FILE="${2:-./electron-builder.production-asar.json}"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Electron Builder with ASAR (pnpm-aware)                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Platform: $TARGET_PLATFORM"
echo "Config:   $CONFIG_FILE"
echo ""

# Step 1: Clean previous builds
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Cleaning previous builds..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
rm -rf dist

# Step 2: Compile TypeScript
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Compiling TypeScript..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npx tsc

# Step 3: Resolve pnpm symlinks
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Resolving pnpm symlinks..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if using pnpm
if [ -d "node_modules/.pnpm" ]; then
    echo "   pnpm detected - resolving symlinks..."
    ./resolve-pnpm-simple.sh
    NEEDS_RESTORE=true
else
    echo "   ✅ Not using pnpm symlinks, skipping..."
    NEEDS_RESTORE=false
fi

# Step 4: Build with electron-builder
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  Building with electron-builder..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Build based on platform
# Use pnpm from parent if available, since copied node_modules .bin may not work
case "$TARGET_PLATFORM" in
    mac|macos|darwin)
        echo "   Building for macOS..."
        pnpm exec electron-builder build --mac -c "$CONFIG_FILE"
        ;;
    win|windows)
        echo "   Building for Windows..."
        pnpm exec electron-builder build --win -c "$CONFIG_FILE"
        ;;
    linux)
        echo "   Building for Linux..."
        pnpm exec electron-builder build --linux -c "$CONFIG_FILE"
        ;;
    all)
        echo "   Building for all platforms..."
        pnpm exec electron-builder build -mwl -c "$CONFIG_FILE"
        ;;
    *)
        echo "   ❌ Unknown platform: $TARGET_PLATFORM"
        echo "   Usage: ./build-with-asar.sh [mac|win|linux|all] [config-file]"
        if [ "$NEEDS_RESTORE" = true ]; then
            node restore-pnpm-deps.js
        fi
        exit 1
        ;;
esac

# Step 5: Restore pnpm structure
if [ "$NEEDS_RESTORE" = true ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "5️⃣  Restoring pnpm structure..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if [ -d "node_modules.pnpm-backup" ]; then
        rm -rf node_modules
        mv node_modules.pnpm-backup node_modules
        echo "   ✅ Restored pnpm node_modules"
    fi
fi

# Show results
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅  BUILD COMPLETE                                      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Show build artifacts
if [ -d "dist" ]; then
    echo "📦 Build artifacts:"
    echo ""
    
    # macOS
    if ls dist/*.dmg 2>/dev/null | grep -q .; then
        echo "   macOS builds:"
        ls -lh dist/*.dmg 2>/dev/null | awk '{print "      " $9 " (" $5 ")"}'
    fi
    
    # Windows
    if ls dist/*.exe 2>/dev/null | grep -q .; then
        echo "   Windows builds:"
        ls -lh dist/*.exe 2>/dev/null | awk '{print "      " $9 " (" $5 ")"}'
    fi
    
    # Linux
    if ls dist/*.AppImage 2>/dev/null | grep -q .; then
        echo "   Linux builds:"
        ls -lh dist/*.AppImage 2>/dev/null | awk '{print "      " $9 " (" $5 ")"}'
    fi
    
    echo ""
    
    # Show unpacked size
    if [ -d "dist/mac" ] || [ -d "dist/win-unpacked" ] || [ -d "dist/linux-unpacked" ]; then
        echo "📊 Unpacked app sizes:"
        [ -d "dist/mac" ] && echo "      macOS: $(du -sh dist/mac 2>/dev/null | cut -f1)"
        [ -d "dist/win-unpacked" ] && echo "      Windows: $(du -sh dist/win-unpacked 2>/dev/null | cut -f1)"
        [ -d "dist/linux-unpacked" ] && echo "      Linux: $(du -sh dist/linux-unpacked 2>/dev/null | cut -f1)"
        echo ""
    fi
    
    echo "💡 Configuration used:"
    echo "      ASAR: enabled"
    echo "      Native modules: unpacked"
    echo "      Dependencies: resolved from pnpm"
fi

echo ""
echo "🎉 Done!"
echo ""

