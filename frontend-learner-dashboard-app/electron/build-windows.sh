#!/bin/bash

# Build script for Windows Electron app with pnpm dependencies
# This script ensures all pnpm dependencies are properly included in the build

set -e

echo "Building Windows Electron app for SSDC Horizon..."

# Step 1: Clean previous builds
echo "Cleaning previous builds..."
rm -rf dist

# Step 2: Compile TypeScript and rebuild native modules
echo "Compiling TypeScript..."
npm run build

# Step 3: Build with electron-builder
echo "Building Windows installers..."
npx electron-builder build --win -c ./electron-builder.config.json

# Step 4: Copy pnpm dependencies to both architectures
echo "Copying pnpm .pnpm directory to build outputs..."
cp -r node_modules/.pnpm dist/win-unpacked/resources/app/node_modules/.pnpm
cp node_modules/.modules.yaml dist/win-unpacked/resources/app/node_modules/.modules.yaml

cp -r node_modules/.pnpm dist/win-arm64-unpacked/resources/app/node_modules/.pnpm
cp node_modules/.modules.yaml dist/win-arm64-unpacked/resources/app/node_modules/.modules.yaml

# Step 5: Rebuild installers with complete dependencies
echo "Rebuilding installers with complete dependencies..."
npx electron-builder build --win --prepackaged dist/win-unpacked -c ./electron-builder.config.json

echo "Build complete!"
echo "Installers location: dist/SSDC Horizon Setup 1.0.7.exe (x64)"
echo "                     dist/SSDC Horizon 1.0.7.exe (ARM64)"
ls -lh dist/*.exe

