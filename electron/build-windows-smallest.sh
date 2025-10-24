#!/bin/bash

# Smallest possible Windows build using asar compression
# Works around pnpm by using production-only flat install

set -e

echo "🚀 Building smallest Windows Electron app..."

# Clean
echo "🧹 Cleaning..."
rm -rf dist

# Compile
echo "📝 Compiling TypeScript..."
npm run build

# Build with optimized config (asar enabled, excludes node_modules, lets electron-builder install them)
echo "🔨 Building (electron-builder will install production deps)..."
npx electron-builder build --win -c ./electron-builder.optimized.json

echo ""
echo "✅ Build complete!"
echo ""
echo "📊 Final sizes:"
ls -lh dist/*.exe
echo ""
echo "📦 App directory size:"
du -sh dist/win-unpacked/resources/

