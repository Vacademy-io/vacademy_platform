# pnpm + ASAR Build Fix - Summary

## Problem

Building Electron app with `asar: true` was failing with "Cannot find module" errors (e.g., `clean-stack`) on both macOS and Windows. Build size was only ~130MB instead of expected ~330MB.

## Root Cause

**pnpm symlink structure + ASAR packaging incompatibility**

When using pnpm, your `node_modules/` directory contains symlinks pointing to `.pnpm/package@version/`:

```
node_modules/
├── .pnpm/                    # Real package files
│   └── clean-stack@2.2.0/
│       └── node_modules/
│           └── clean-stack/  # <- Actual files here
└── clean-stack@              # <- Symlink pointing to .pnpm/...
```

When electron-builder creates the ASAR archive, it doesn't follow these symlinks by default, resulting in:
- Broken symlinks in the ASAR file
- Missing module errors at runtime
- Smaller build size (symlinks don't take up space)

## The Solution

### Created 3 helper scripts:

1. **`resolve-pnpm-deps.js`** - Temporarily replaces pnpm symlinks with real npm-installed files
2. **`restore-pnpm-deps.js`** - Restores the pnpm structure after building  
3. **`build-with-asar.sh`** - Automated script that orchestrates the entire process

### Workflow:

```
Original pnpm    →  Resolve    →  Build with    →  Restore pnpm
node_modules        to real        electron-        node_modules
(symlinks)          files          builder          (symlinks)
```

## Usage

### Simplest (Recommended):

```bash
cd electron
npm run build:asar:mac    # For macOS
npm run build:asar:win    # For Windows
npm run build:asar:all    # For all platforms
```

The script handles everything automatically.

## Files Changed/Created

### Modified:
- ✅ `electron-builder.production-asar.json` - Added `followSymlinks: true`, fixed `npmRebuild`
- ✅ `electron-builder.mac-to-win.json` - Same fixes for cross-platform builds
- ✅ `package.json` - Added new build commands
- ✅ `CROSS_PLATFORM_BUILD_GUIDE.md` - Updated with pnpm solutions

### Created:
- ✅ `resolve-pnpm-deps.js` - Resolves symlinks before build
- ✅ `restore-pnpm-deps.js` - Restores symlinks after build
- ✅ `build-with-asar.sh` - Automated build script
- ✅ `build-windows-from-mac.sh` - Cross-platform build script
- ✅ `QUICK_BUILD_WITH_ASAR.md` - Quick start guide
- ✅ `PNPM_ASAR_FIX_SUMMARY.md` - This file

## Technical Details

### Config Changes:

```json
{
  "files": ["node_modules/**/*"],     // Include all node_modules
  "asar": true,                       // Enable ASAR
  "asarUnpack": ["**/*.node"],        // Unpack only native modules
  "followSymlinks": true,             // Try to follow symlinks (may not work)
  "npmRebuild": true,                 // Rebuild native modules for target
  "nodeGypRebuild": true              // Rebuild node-gyp modules
}
```

### Why npm install in the script?

The script temporarily uses `npm install` (not pnpm) to create real file-based `node_modules/` without symlinks. This ensures electron-builder can properly package everything into the ASAR file. After building, it restores your pnpm structure so development workflow is unchanged.

## Verification

After building, verify:

```bash
# Check build size
ls -lh electron/dist/*.dmg       # macOS
ls -lh electron/dist/*.exe       # Windows

# Expected: ~300-350MB (not ~130MB)

# Check unpacked app
du -sh electron/dist/mac
du -sh electron/dist/win-unpacked

# Expected: ~400-500MB
```

## Benefits

✅ **ASAR compression enabled** - Smaller install size  
✅ **All dependencies included** - No missing modules  
✅ **pnpm workflow preserved** - Dev environment unchanged  
✅ **Cross-platform builds work** - Mac → Windows builds succeed  
✅ **Native modules handled** - `.node` files properly unpacked and rebuilt  

## Alternative Solutions Considered

1. ❌ **Using `asar: false`** - Works but larger file size, slower startup
2. ❌ **Switching to npm/yarn permanently** - Loses pnpm benefits
3. ❌ **Copying .pnpm to asarUnpack** - Unpacks too much, defeats ASAR purpose
4. ✅ **Temporary npm conversion** - Best of both worlds

## CI/CD Integration

For automated builds, just use:

```yaml
- name: Build Electron App
  run: |
    cd electron
    npm run build:asar:mac
```

The script is idempotent and handles errors gracefully.

## Rollback

If you need to undo everything:

```bash
cd electron

# If build failed mid-process and backup exists:
node restore-pnpm-deps.js

# Or manually:
rm -rf node_modules
mv node_modules.pnpm-backup node_modules  # if exists
pnpm install
```

## Future Improvements

- Electron-builder may add better pnpm support in future versions
- Could potentially use `electron-builder`'s hooks to automate this
- Could create a plugin to handle this automatically

---

**Quick Start**: See [QUICK_BUILD_WITH_ASAR.md](./QUICK_BUILD_WITH_ASAR.md)  
**Full Details**: See [CROSS_PLATFORM_BUILD_GUIDE.md](./CROSS_PLATFORM_BUILD_GUIDE.md)

