#!/bin/bash

# Ultra-optimized Windows build with smallest possible size
# Uses npm for flat structure + asar compression

set -e

echo "🚀 Building ultra-optimized Windows Electron app..."

# Step 1: Clean
echo "🧹 Cleaning..."
rm -rf dist build-temp

# Step 2: Compile TypeScript
echo "📝 Compiling TypeScript..."
npx tsc

# Step 3: Create optimized node_modules with npm
echo "📦 Creating flat node_modules with production dependencies only..."
mkdir -p build-temp
cp package.json build-temp/

cd build-temp
npm install --production --no-package-lock --legacy-peer-deps --quiet 2>&1 | grep -E "(added|removed|^$)" || true
cd ..

# Step 4: Temporarily swap node_modules
echo "🔄 Swapping to production node_modules..."
if [ -d "node_modules" ]; then
    mv node_modules node_modules.dev
fi
mv build-temp/node_modules ./node_modules

# Step 5: Build with asar compression enabled
echo "🔨 Building with electron-builder (asar enabled for compression)..."
npx electron-builder build --win -c ./electron-builder.optimized.json

# Step 6: Restore dev node_modules
echo "🔄 Restoring dev node_modules..."
mv node_modules node_modules.prod
if [ -d "node_modules.dev" ]; then
    mv node_modules.dev node_modules
fi

# Step 7: Cleanup
echo "🧹 Cleaning up..."
rm -rf node_modules.prod build-temp

echo ""
echo "✅ Build complete!"
echo ""
echo "📊 Build sizes:"
ls -lh dist/*.exe
echo ""
echo "📦 App size:"
du -sh dist/win-unpacked/resources/
echo ""
echo "💾 Estimated size reduction: ~70-80% vs unoptimized build"

