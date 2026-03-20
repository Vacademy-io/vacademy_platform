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

# Run TypeScript compiler
echo "Running TypeScript compiler..."
pnpm exec tsc --noEmit

# Build the application
echo "Building application..."
pnpm exec vite build

echo "================================================"
echo "Build completed successfully!"
echo "================================================"

# Print build output size
if [ -d "dist" ]; then
    echo "Build output size:"
    du -sh dist
fi

