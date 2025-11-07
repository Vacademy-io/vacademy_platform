#!/bin/bash

# Simple script to resolve pnpm symlinks by copying real files
# without needing npm

set -e

BACKUP_DIR="node_modules.pnpm-backup"
NODE_MODULES="node_modules"

echo "🔧 Resolving pnpm symlinks..."

# Check if using pnpm
if [ ! -d "$NODE_MODULES/.pnpm" ]; then
    echo "✅ Not using pnpm symlinks"
    exit 0
fi

# Check if backup exists
if [ -d "$BACKUP_DIR" ]; then
    echo "⚠️  Backup already exists: $BACKUP_DIR"
    echo "   Run: mv node_modules.pnpm-backup node_modules"
    exit 1
fi

echo "1️⃣  Creating backup..."
mv "$NODE_MODULES" "$BACKUP_DIR"

echo "2️⃣  Copying real files from .pnpm..."
mkdir -p "$NODE_MODULES"

# Copy the .pnpm directory with all real files
cp -RL "$BACKUP_DIR/.pnpm" "$NODE_MODULES/.pnpm"
echo "   ✅ Copied .pnpm directory"

# Copy all symlinked packages as real directories
echo "   Resolving package symlinks..."
cd "$BACKUP_DIR"
for item in *; do
    if [ -L "$item" ] && [ "$item" != ".pnpm" ]; then
        # It's a symlink, copy the real content
        cp -RL "$item" "../$NODE_MODULES/$item"
    elif [ "$item" != ".pnpm" ]; then
        # It's a regular file/directory, copy as-is
        cp -R "$item" "../$NODE_MODULES/$item"
    fi
done
cd ..

echo "   ✅ Resolved all package symlinks"

echo "3️⃣  Setting up .bin directory..."
# The .bin directory should already be copied, but let's ensure it's executable
if [ -d "$NODE_MODULES/.bin" ]; then
    chmod +x "$NODE_MODULES/.bin"/* 2>/dev/null || true
    echo "   ✅ .bin directory ready"
fi

echo ""
echo "✅ Dependencies resolved!"
echo "   All symlinks replaced with real files"
echo "   Backup saved to: $BACKUP_DIR"
echo ""

