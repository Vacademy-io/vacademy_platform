#!/bin/bash

# Optimized Windows build script with smaller output size
# This script uses npm to create a flat, production-only node_modules structure

set -e

echo "Building optimized Windows Electron app for SSDC Horizon..."

# Step 1: Clean previous builds
echo "Cleaning previous builds..."
rm -rf dist build-temp

# Step 2: Compile TypeScript and rebuild native modules
echo "Compiling TypeScript..."
npm run build

# Step 3: Create a temporary build directory with flat node_modules
echo "Creating optimized node_modules structure..."
mkdir -p build-temp
cp package.json build-temp/
cd build-temp

# Install production dependencies only using npm (creates flat structure)
echo "Installing production dependencies with npm..."
npm install --production --no-package-lock --legacy-peer-deps 2>&1 | grep -v "npm warn" || true

cd ..

# Step 4: Update electron-builder config to use optimized node_modules
echo "Building Windows installers with optimized dependencies..."

# Temporarily copy the flat node_modules
cp -r build-temp/node_modules ./node_modules_prod

# Build with the production node_modules
mv node_modules node_modules_dev
mv node_modules_prod node_modules

npx electron-builder build --win -c ./electron-builder.config.json

# Restore dev node_modules
mv node_modules node_modules_prod  
mv node_modules_dev node_modules

# Cleanup
echo "Cleaning up temporary files..."
rm -rf node_modules_prod build-temp

echo "Optimized build complete!"
echo "Installers location: dist/SSDC Horizon Setup 1.0.7.exe (x64)"
echo "                     dist/SSDC Horizon 1.0.7.exe (ARM64)"
ls -lh dist/*.exe

echo ""
echo "Size comparison:"
du -sh dist/win-unpacked/resources/app/

