# Quick Start: Building with ASAR (pnpm-aware)

## TL;DR - Just Build It!

```bash
cd electron

# For macOS:
npm run build:asar:mac

# For Windows (from Mac):
npm run build:asar:win

# For all platforms:
npm run build:asar:all
```

That's it! The script automatically handles all pnpm symlink issues.

## What Was Wrong?

Your builds were failing because:
1. **pnpm uses symlinks** - Your `node_modules` has symlinks to `.pnpm/` directory
2. **ASAR doesn't follow symlinks** - When creating the `.asar` archive, electron-builder wasn't following these symlinks
3. **Result**: Missing modules like `clean-stack`, app crashes with "Cannot find module" errors

## The Fix

The new build script (`build-with-asar.sh`) does this:

```
1. Backup your pnpm node_modules/
2. Temporarily install with npm (creates real files, not symlinks)
3. Build with electron-builder (ASAR works correctly now)
4. Restore your pnpm node_modules/
```

You get:
- ✅ ASAR compression (smaller builds)
- ✅ All dependencies included
- ✅ pnpm development workflow preserved
- ✅ Cross-platform builds work correctly

## Build Sizes

**Expected sizes after fix:**
- macOS DMG: ~300-350MB
- Windows Installer: ~300-350MB  
- Unpacked app: ~400-500MB

If your build is only ~130MB, dependencies are missing.

## Manual Control

If you need more control:

```bash
# Step 1: Resolve pnpm symlinks
node resolve-pnpm-deps.js

# Step 2: Build
npx electron-builder build --mac -c ./electron-builder.production-asar.json

# Step 3: Restore pnpm
node restore-pnpm-deps.js
```

## Troubleshooting

### "Backup already exists" error

```bash
cd electron
node restore-pnpm-deps.js
# Then try building again
```

### "Cannot find module" after building

You probably built without resolving pnpm symlinks. Use the automated script:
```bash
npm run build:asar:mac
```

### Build is too small (~130MB)

Dependencies are missing. Use the automated script:
```bash
npm run build:asar:win
```

## All Available Build Commands

```bash
# Recommended (pnpm-aware, ASAR enabled):
npm run build:asar:mac          # Build for macOS
npm run build:asar:win          # Build for Windows  
npm run build:asar:all          # Build for all platforms

# Alternative methods:
npm run build:win:asar          # Windows only (may fail with pnpm)
npm run build:win:from-mac      # Cross-platform (older method)
./build-windows-from-mac.sh     # Direct script (older method)
```

## For CI/CD

Add to your GitHub Actions or CI pipeline:

```yaml
- name: Build Electron App
  run: |
    cd electron
    npm run build:asar:mac
```

The script handles everything automatically.

---

**For detailed information**, see [CROSS_PLATFORM_BUILD_GUIDE.md](./CROSS_PLATFORM_BUILD_GUIDE.md)

