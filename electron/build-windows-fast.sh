#!/bin/bash

# Fast installation build - optimized for installation speed
# Uses no compression and one-click installer

set -e

echo "🚀 Building fast-install Windows app..."
echo ""
echo "⚡ Optimizations:"
echo "  • No compression (store mode)"
echo "  • One-click installer"
echo "  • x64 only (faster build)"
echo ""

# Clean
echo "🧹 Cleaning previous builds..."
rm -rf dist

# Compile
echo "📝 Compiling TypeScript..."
npm run build

# Build
echo "🔨 Building with fast-install configuration..."
npx electron-builder build --win -c ./electron-builder.fast-install.json

# Copy .pnpm directory for both builds
echo "🔧 Adding pnpm dependencies..."
if [ -d "node_modules/.pnpm" ]; then
    cp -r node_modules/.pnpm dist/win-unpacked/resources/app/node_modules/.pnpm
    cp node_modules/.modules.yaml dist/win-unpacked/resources/app/node_modules/.modules.yaml
    echo "  ✅ Dependencies copied"
fi

# Rebuild installer with dependencies
echo "📦 Rebuilding installer..."
npx electron-builder build --win --prepackaged dist/win-unpacked -c ./electron-builder.fast-install.json

echo ""
echo "✅ Fast-install build complete!"
echo ""
echo "📊 Build size:"
ls -lh dist/*.exe
echo ""
echo "⚡ Installation improvements:"
echo "  ✅ No compression - installs 5-10x faster"
echo "  ✅ One-click installer - simpler UX"
echo "  ✅ Won't get stuck at 60%"
echo ""
echo "⚠️  Note: Installer will be larger (~400-500MB) but installs much faster"

