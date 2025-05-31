#!/bin/bash

echo "🧹 Clearing all caches..."

# Stop the dev server if it's running
echo "📱 Stopping any running dev processes..."
pkill -f "vite"

# Clear Vite cache
echo "⚡ Clearing Vite cache..."
rm -rf .vite
rm -rf node_modules/.vite

# Clear dist folder
echo "📦 Clearing build artifacts..."
rm -rf dist

# Clear TypeScript cache
echo "🔵 Clearing TypeScript cache..."
rm -rf node_modules/.cache
rm -rf .tsbuildinfo
rm -rf tsconfig.tsbuildinfo

# Clear pnpm cache
echo "📦 Clearing pnpm cache..."
pnpm store prune

# Clear node_modules and reinstall (optional - uncomment if needed)
# echo "🗂️ Clearing node_modules..."
# rm -rf node_modules
# echo "📥 Reinstalling dependencies..."
# pnpm install

# Clear browser cache for localhost (Windows specific)
echo "🌐 Note: You may also want to clear your browser cache for localhost"

echo "✅ Cache clearing complete!"
echo "🚀 You can now run: pnpm dev" 