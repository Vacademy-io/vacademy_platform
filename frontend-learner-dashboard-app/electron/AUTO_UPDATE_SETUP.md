# Auto-Update Setup Guide

## Overview

Your Electron app is configured to check for updates automatically from GitHub releases. This document explains how the auto-update system works and how to properly publish releases.

## How It Works

1. **Auto-Updater Configuration**: The app uses `electron-updater` to check for updates
2. **GitHub Releases**: Updates are hosted on GitHub releases at `Vacademy-io/electron-build-repo`
3. **Update Metadata**: The `latest-mac.yml` (macOS) and `latest.yml` (Windows) files tell the app about available updates

## The Error You're Seeing

The error occurs because:
- Your app (v1.0.7) tries to check for updates on startup
- It looks for `latest-mac.yml` at: `https://github.com/Vacademy-io/electron-build-repo/releases/download/v1.0.7/latest-mac.yml`
- This file was never uploaded to the GitHub release

## Solution: Improved Error Handling

I've updated `electron/src/index.ts` to gracefully handle missing update files:
- 404 errors are now caught and logged as "Update check skipped"
- The app will continue to work normally without crashing
- This fix will be included in v1.0.8 and later builds

## How to Properly Publish Releases with Auto-Update

### Step 1: Build Your App

```bash
cd electron
pnpm run build:prod
# or
./build-with-asar.sh
```

This creates in the `dist/` folder:
- **macOS**: 
  - `SSDC Horizon-{version}-arm64.dmg` (the installer)
  - `SSDC Horizon-{version}-arm64.dmg.blockmap` (for delta updates)
  - `latest-mac.yml` (update metadata)

- **Windows**:
  - `SSDC Horizon Setup {version}.exe` (the installer)
  - `SSDC Horizon-{version}.exe.blockmap` (for delta updates)
  - `latest.yml` (update metadata)

### Step 2: Create a GitHub Release

1. Go to: https://github.com/Vacademy-io/electron-build-repo/releases
2. Click "Draft a new release"
3. Tag version: `v{version}` (e.g., `v1.0.8`)
4. Release title: `SSDC Horizon v{version}`
5. Add release notes

### Step 3: Upload Files to GitHub Release

**For macOS:**
- ✅ Upload `SSDC Horizon-{version}-arm64.dmg`
- ✅ Upload `SSDC Horizon-{version}-arm64.dmg.blockmap`
- ✅ Upload `latest-mac.yml` ⚠️ **CRITICAL** - Without this, auto-update won't work

**For Windows:**
- ✅ Upload `SSDC Horizon Setup {version}.exe`
- ✅ Upload `SSDC Horizon-{version}.exe.blockmap`
- ✅ Upload `latest.yml` ⚠️ **CRITICAL** - Without this, auto-update won't work

### Step 4: Publish the Release

Click "Publish release" and the auto-update system will start working.

## Current Status

- ✅ Auto-updater is configured
- ✅ Error handling improved (v1.0.8+)
- ⚠️ v1.0.7 release missing `latest-mac.yml` (causes 404 error)
- 🎯 Next build (v1.0.8) will handle this gracefully

## Fixing the Current v1.0.7 Error

You have two options:

### Option 1: Upload Missing Files (Recommended if you want v1.0.7 to support updates)

1. If you still have the v1.0.7 build artifacts in `dist/`, upload the `latest-mac.yml` to the v1.0.7 GitHub release
2. If not, you can recreate it by checking out the v1.0.7 tag and rebuilding

### Option 2: Wait for v1.0.8 (Easiest)

1. Build and distribute v1.0.8 with the improved error handling
2. Future updates will work smoothly
3. Users on v1.0.7 will see the error but the app will still work

## Disabling Auto-Update (Optional)

If you don't want to use auto-update, you can disable it by commenting out lines 48-101 in `electron/src/index.ts`:

```typescript
// Check for updates if we are in a packaged app.
if (!electronIsDev) {
  // DISABLED: Auto-update functionality
  /*
  autoUpdater.autoDownload = false;
  ...
  */
}
```

## Testing Auto-Update Locally

To test auto-update:

1. Build version 1.0.8 and publish to GitHub releases
2. Build version 1.0.9 locally
3. Run the 1.0.8 app
4. It should detect and offer to download 1.0.9

## Common Issues

### "Cannot find latest-mac.yml" Error
- **Cause**: Update metadata file not uploaded to GitHub release
- **Fix**: Upload `latest-mac.yml` to the release assets

### Update Check Never Completes
- **Cause**: GitHub API rate limiting or network issues
- **Fix**: Check your internet connection, verify GitHub repo access

### "Update available" but Download Fails
- **Cause**: DMG/EXE file not uploaded or wrong filename
- **Fix**: Ensure installer file is uploaded and matches the name in `latest-mac.yml`

## Configuration Files

- `electron/app-update.yml`: Tells the app where to check for updates
- `electron/electron-builder.production-asar.json`: Build configuration with publish settings
- `electron/src/index.ts`: Auto-updater initialization code

## Support

If you need to modify the auto-update behavior, see:
- [electron-updater docs](https://www.electron.build/auto-update)
- [electron-builder publish docs](https://www.electron.build/configuration/publish)

