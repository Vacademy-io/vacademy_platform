#!/bin/bash

# Optimized build with ASAR compression + pnpm workaround
# This script handles pnpm's .pnpm directory that asar doesn't follow

set -e

echo "🚀 Building optimized Windows app with ASAR + pnpm..."

# Clean
echo "🧹 Cleaning..."
rm -rf dist

# Compile TypeScript
echo "📝 Compiling TypeScript..."
npm run build

# Build with asar enabled
echo "🔨 Building with electron-builder (asar compression)..."
npx electron-builder build --win -c ./electron-builder.optimized.json

# Fix pnpm symlink issue by copying .pnpm directory to unpacked app
echo "🔧 Fixing pnpm symlinks - copying .pnpm directory..."
if [ -d "node_modules/.pnpm" ]; then
    # Copy to x64 build
    mkdir -p dist/win-unpacked/resources/app.asar.unpacked/node_modules
    cp -r node_modules/.pnpm dist/win-unpacked/resources/app.asar.unpacked/node_modules/.pnpm
    cp node_modules/.modules.yaml dist/win-unpacked/resources/app.asar.unpacked/node_modules/.modules.yaml
    echo "  ✅ Copied .pnpm to x64 build"
    
    # Copy to ARM64 build
    mkdir -p dist/win-arm64-unpacked/resources/app.asar.unpacked/node_modules
    cp -r node_modules/.pnpm dist/win-arm64-unpacked/resources/app.asar.unpacked/node_modules/.pnpm
    cp node_modules/.modules.yaml dist/win-arm64-unpacked/resources/app.asar.unpacked/node_modules/.modules.yaml
    echo "  ✅ Copied .pnpm to ARM64 build"
fi

# Rebuild installers with .pnpm included
echo "📦 Rebuilding installers with complete dependencies..."
npx electron-builder build --win --prepackaged dist/win-unpacked -c ./electron-builder.optimized.json

echo ""
echo "✅ Build complete!"
echo ""
echo "📊 Final sizes:"
ls -lh dist/*.exe
echo ""
echo "📦 Resource sizes:"
echo "  app.asar:          $(du -sh dist/win-unpacked/resources/app.asar | cut -f1)"
echo "  app.asar.unpacked: $(du -sh dist/win-unpacked/resources/app.asar.unpacked | cut -f1)"
echo "  Total resources:   $(du -sh dist/win-unpacked/resources | cut -f1)"
echo ""
echo "💡 This build uses:"
echo "  ✅ ASAR compression for smaller size"
echo "  ✅ pnpm node_modules (with .pnpm workaround)"
echo "  ✅ All dependencies accessible at runtime"

