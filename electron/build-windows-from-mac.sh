#!/bin/bash

# Cross-platform build script for building Windows app from macOS
# Handles native dependencies and pnpm symlinks properly

set -e

echo "🚀 Building Windows app from macOS with proper dependency handling..."
echo ""

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist

# Compile TypeScript
echo "📝 Compiling TypeScript..."
npm run build

# Install Windows-specific dependencies if needed
echo "🔄 Ensuring all dependencies are installed..."
pnpm install --force

# Build with electron-builder
echo "🔨 Building with electron-builder for Windows..."
echo "   This will rebuild native modules for Windows platform..."
npx electron-builder build --win --x64 --ia32 -c ./electron-builder.production-asar.json

echo ""
echo "✅ Build complete!"
echo ""

# Show build information
if [ -d "dist/win-unpacked" ]; then
    echo "📊 Build information:"
    echo ""
    echo "Unpacked app location: dist/win-unpacked"
    
    if [ -f "dist/win-unpacked/resources/app.asar" ]; then
        echo "  app.asar size:          $(du -sh dist/win-unpacked/resources/app.asar | cut -f1)"
    fi
    
    if [ -d "dist/win-unpacked/resources/app.asar.unpacked" ]; then
        echo "  app.asar.unpacked size: $(du -sh dist/win-unpacked/resources/app.asar.unpacked | cut -f1)"
    fi
    
    echo ""
    echo "📦 Installers created:"
    ls -lh dist/*.exe 2>/dev/null || echo "  (No .exe files found yet)"
    
    echo ""
    echo "💡 Build configuration used:"
    echo "  ✅ Native modules rebuilt for Windows"
    echo "  ✅ ASAR compression enabled"
    echo "  ✅ pnpm node_modules included"
    echo ""
    echo "⚠️  Important: Test the app on Windows to ensure all native modules work correctly"
fi

echo ""
echo "🎉 Done!"

