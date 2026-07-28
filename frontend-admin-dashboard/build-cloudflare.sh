#!/bin/bash

# Cloudflare Pages Build Script
# This script is optimized for building on Cloudflare Pages with memory constraints

set -e  # Exit on error

echo "================================================"
echo "Starting Cloudflare Pages Build"
echo "================================================"

# Set Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=8192"

# Print Node.js version
echo "Node.js version:"
node --version

# Print npm version
echo "npm version:"
npm --version

# Install pnpm if not available
if ! command -v pnpm &> /dev/null; then
    echo "Installing pnpm..."
    npm install -g pnpm
fi

# Print pnpm version
echo "pnpm version:"
pnpm --version

# Clean install dependencies
echo "Installing dependencies..."
pnpm install --frozen-lockfile

# Typecheck + bundle. `pnpm run build` runs tsc and vite build CONCURRENTLY
# (see package.json) and fails if either fails, so wall-clock is max(tsc, vite)
# instead of the sum. Do not split these back into two serial steps.
echo "Typechecking and building application..."
pnpm run build

echo "================================================"
echo "Build completed successfully!"
echo "================================================"

# Print build output size
if [ -d "dist" ]; then
    echo "Build output size:"
    du -sh dist
fi

