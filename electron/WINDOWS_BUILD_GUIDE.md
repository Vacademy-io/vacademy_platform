# Windows Electron Build Guide

## Problem

When building Electron apps with pnpm's symlinked node_modules structure, electron-builder doesn't properly include the entire dependency tree. This causes "Cannot find module" errors for dependencies like:
- `mime-types`
- `mime-db`
- `clean-stack`
- `@capacitor-community/electron`
- And other transitive dependencies

## Root Cause

pnpm uses a unique `node_modules` structure with:
- Top-level symlinks pointing to `.pnpm/package@version/node_modules/package`
- Actual module code stored in `.pnpm/` directory
- The `.pnpm` directory (starting with a dot) is filtered out by electron-builder's default ignore patterns

When electron-builder copies `node_modules`, it follows symlinks but doesn't include the `.pnpm` directory, resulting in broken dependency resolution at runtime.

## Solution

The solution involves a two-step build process:
1. Build with electron-builder (which follows symlinks)
2. Manually copy the `.pnpm` directory to the unpacked builds
3. Rebuild the installers with complete dependencies

## How to Build

### SSDC Horizon (Default Brand)

```bash
cd electron
npm run build:win:ssdc
```

Or manually:
```bash
cd electron
./build-windows.sh
```

### Seven CS Brand

```bash
cd electron
npm run build:win:sevencs
```

Or manually:
```bash
cd electron
./build-windows-seven-cs.sh
```

## Build Artifacts

After building, you'll find:

- **SSDC Horizon Setup 1.0.7.exe** (~252MB) - NSIS installer for x64
- **SSDC Horizon 1.0.7.exe** (~168MB) - Portable executable for ARM64

Or for Seven CS:

- **Seven CS Learner Setup 1.0.7.exe** - NSIS installer for x64
- **Seven CS Learner 1.0.7.exe** - Portable executable for ARM64

## Configuration Changes Made

### electron-builder.config.json & electron-builder.seven_cs.json

```json
{
  "files": [
    "assets/**/*",
    "build/**/*",
    "capacitor.config.*",
    "app/**/*",
    "node_modules/**/*",
    "node_modules/.pnpm/**/*",
    "node_modules/.modules.yaml",
    "package.json"
  ],
  "asar": false
}
```

**Key Changes:**
- `"asar": false` - Disables asar packaging for easier debugging and module resolution
- Explicit inclusion of `.pnpm` directory and `.modules.yaml` (though this still requires manual copying due to electron-builder limitations)

## Build Scripts

Two automated build scripts have been created:

### build-windows.sh (SSDC Horizon)
- Cleans previous builds
- Compiles TypeScript
- Builds with electron-builder
- Copies `.pnpm` directory to both x64 and ARM64 builds
- Rebuilds installers with complete dependencies

### build-windows-seven-cs.sh (Seven CS)
- Same process but uses `electron-builder.seven_cs.json`

## Troubleshooting

### "Cannot find module" errors

If you still see module errors after installation:
1. Verify `.pnpm` directory exists in the installed app:
   - Windows: `C:\Users\<username>\AppData\Local\Programs\SSDC Horizon\resources\app\node_modules\.pnpm\`
2. Check if the specific module exists in `.pnpm`
3. Rebuild using the automated scripts

### Build size is too small

If the installer is less than 200MB, the `.pnpm` directory wasn't included. Run the automated build script instead of the standard `electron:make-win`.

### Permission errors during npm install

If you encounter npm cache permission errors:
```bash
sudo chown -R $USER:$(id -gn) ~/.npm
```

## Future Improvements

Consider migrating to npm or yarn instead of pnpm for Electron builds to avoid this complexity. Alternatively, electron-builder could be configured with a custom afterPack hook to automate the `.pnpm` copy step.

## Testing Checklist

After building, test the installed app for:
- ✅ App launches without "Cannot find module" errors
- ✅ All Capacitor plugins work correctly
- ✅ File type detection works (mime-types)
- ✅ System notifications work (node-notifier)
- ✅ Error handling works (electron-unhandled with clean-stack)
- ✅ Auto-updates work (electron-updater)

## Build Output Details

### Included Dependencies (post-fix)
- Total app size: ~734MB unpacked
- .pnpm directory: ~702MB
- All transitive dependencies properly resolved

### Excluded from Build
- DevDependencies (electron, typescript, electron-builder, electron-rebuild)
- Source TypeScript files (only compiled JavaScript is included)

## Version History

- **v1.0.7** - Fixed pnpm dependency resolution issues
- Added automated build scripts
- Disabled asar packaging
- Documented complete build process

