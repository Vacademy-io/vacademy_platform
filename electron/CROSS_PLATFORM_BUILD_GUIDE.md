# Cross-Platform Electron Build Guide (macOS → Windows)

## The Problem

When building Electron apps with `asar: true`, you may encounter these issues:

1. **Missing node_modules files** - Build size is ~130MB on Mac vs ~330MB on Windows
2. **"Cannot find module" errors** - Modules like `clean-stack` are missing at runtime
3. **Native module errors** - `.node` files compiled for macOS won't work on Windows
4. **pnpm symlink issues** - The `.pnpm` directory structure isn't followed by ASAR packaging

### Root Causes

1. **pnpm Symlink Structure**: When using pnpm, `node_modules` contains symlinks to `.pnpm/package@version/` directories. When electron-builder creates an ASAR archive, it doesn't follow these symlinks by default, leaving broken references.

2. **Native Modules**: Your app uses native Node modules that need platform-specific compilation:
   - `lzma-native` - Compression library with native bindings
   - `iconv-corefoundation` - macOS-specific encoding library
   - Other dependencies may pull in native modules

3. **Cross-compilation**: When `npmRebuild: false`, native modules aren't rebuilt for the target platform.

## Solutions

### Solution 1: Use Automated Build Script (RECOMMENDED for pnpm users)

The new `build-with-asar.sh` script automatically handles pnpm symlinks by:
1. Temporarily converting symlinks to real files
2. Building with ASAR enabled
3. Restoring the pnpm structure

**To build for macOS:**
```bash
cd electron
./build-with-asar.sh mac
# or
npm run build:asar:mac
```

**To build for Windows from Mac:**
```bash
cd electron
./build-with-asar.sh win
# or
npm run build:asar:win
```

**To build for all platforms:**
```bash
cd electron
./build-with-asar.sh all
# or
npm run build:asar:all
```

This is the most reliable solution as it eliminates all pnpm symlink issues.

### Solution 2: Manual pnpm Resolution

If you need more control, you can manually resolve and restore pnpm dependencies:

**Step 1: Resolve symlinks**
```bash
cd electron
node resolve-pnpm-deps.js
```

**Step 2: Build**
```bash
npx electron-builder build --mac -c ./electron-builder.production-asar.json
# or for Windows:
npx electron-builder build --win -c ./electron-builder.production-asar.json
```

**Step 3: Restore pnpm structure**
```bash
node restore-pnpm-deps.js
```

### Solution 3: Use Specialized Config (with followSymlinks)

For cross-platform builds, use the dedicated config:

```bash
cd electron
npx electron-builder build --win -c ./electron-builder.mac-to-win.json
```

This config has additional optimizations for native modules.

The updated configs include `"followSymlinks": true` which may help electron-builder follow pnpm symlinks:

```bash
cd electron
npx electron-builder build --win -c ./electron-builder.mac-to-win.json
```

**Note:** This solution may not work with all electron-builder versions.

### Solution 4: Docker Build (Most Reliable for Cross-Platform)

For the most reliable Windows builds from macOS, use Docker with a Windows build environment:

```bash
# Create a Docker build script
docker run --rm -ti \
  --env-file <(env | grep -iE 'DEBUG|NODE_|ELECTRON_|YARN_|NPM_|CI|CIRCLE|TRAVIS_TAG|TRAVIS|TRAVIS_REPO_|TRAVIS_BUILD_|TRAVIS_BRANCH|TRAVIS_PULL_REQUEST_|APPVEYOR_|CSC_|GH_|GITHUB_|BT_|AWS_|STRIP|BUILD_') \
  --env ELECTRON_CACHE="/root/.cache/electron" \
  --env ELECTRON_BUILDER_CACHE="/root/.cache/electron-builder" \
  -v ${PWD}:/project \
  -v ~/.cache/electron:/root/.cache/electron \
  -v ~/.cache/electron-builder:/root/.cache/electron-builder \
  electronuserland/builder:wine \
  /bin/bash -c "cd /project && pnpm install && pnpm run build && npx electron-builder build --win -c ./electron-builder.production-asar.json"
```

### Solution 5: Build on Native Platform (Simplest)

If you have access to a Windows machine or VM:

```bash
# On Windows machine
cd electron
npm install
npm run build
npx electron-builder build --win -c ./electron-builder.production-asar.json
```

This avoids all cross-compilation issues.

## Verification

After building, verify the package size and contents:

```bash
# Check build size
ls -lh dist/*.exe

# Check unpacked app size
du -sh dist/win-unpacked/resources/

# Verify native modules are included
ls dist/win-unpacked/resources/app.asar.unpacked/**/*.node
```

Expected sizes:
- **Without native modules (broken):** ~130MB
- **With native modules (working):** ~330MB

## Troubleshooting

### Issue: "Cannot find module" errors (e.g., clean-stack, etc.)

**Cause:** pnpm symlinks not followed by ASAR packaging

**Fix:** Use the automated build script:
```bash
./build-with-asar.sh mac    # or win/linux/all
```

Or manually resolve pnpm before building:
```bash
node resolve-pnpm-deps.js
# ... build ...
node restore-pnpm-deps.js
```

### Issue: "Cannot find module" errors on Windows (cross-platform builds)

**Cause:** Native modules weren't rebuilt for Windows

**Fix:** Ensure `npmRebuild: true` in your config

### Issue: Build succeeds but app crashes on startup

**Cause:** Native modules compiled for wrong architecture

**Fix:** 
1. Check that you're building for the correct architecture (x64/ia32)
2. Verify native modules are in `app.asar.unpacked/`

### Issue: pnpm symlink errors

**Cause:** `.pnpm` directory isn't included in the build

**Fix:** Add to `asarUnpack`:
```json
"asarUnpack": [
  "**/*.node",
  "**/node_modules/.pnpm/**/*"
]
```

### Issue: Build takes very long time

**Cause:** `npmRebuild: true` rebuilds all native modules

**Solutions:**
- Use Docker build with caching
- Build on native Windows
- Use prebuilt binaries when available

## Best Practices

1. **Test on target platform** - Always test Windows builds on actual Windows machines
2. **Use CI/CD** - Set up GitHub Actions or similar for automated Windows builds
3. **Keep dependencies minimal** - Avoid native modules when possible
4. **Document platform requirements** - List any platform-specific dependencies

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run build:asar:mac` | Build macOS app with ASAR (handles pnpm automatically) |
| `npm run build:asar:win` | Build Windows app with ASAR (handles pnpm automatically) |
| `npm run build:asar:all` | Build for all platforms with ASAR |
| `./build-with-asar.sh [platform]` | Direct script access (mac/win/linux/all) |
| `node resolve-pnpm-deps.js` | Manually resolve pnpm symlinks before building |
| `node restore-pnpm-deps.js` | Restore pnpm structure after building |
| `./build-windows-from-mac.sh` | Build Windows app from macOS (older method) |

## Additional Resources

- [electron-builder docs](https://www.electron.build/)
- [Multi-platform build guide](https://www.electron.build/multi-platform-build)
- [Native Node modules](https://www.electron.build/cli#--dir)

