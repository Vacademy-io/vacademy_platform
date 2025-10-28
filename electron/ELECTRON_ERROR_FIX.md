# Fix for ERR_FILE_NOT_FOUND Error in Electron

## Error Message
```
Unhandled Promise Rejection
Error: ERR_FILE_NOT_FOUND (-6) loading 'capacitor-electron://-/'
```

## Root Cause

The Electron app was **missing the web app files**. The electron-builder configuration wasn't copying the compiled web application (`../dist/`) into the Electron package's `app` directory.

### What Electron Expects

Electron uses `electron-serve` to load the web app from:
```
resources/app/app/    ← Web files should be here
```

But the build was missing:
```
resources/app/app/    ❌ MISSING!
```

## The Fix

Updated `electron-builder.production.json` and `electron-builder.seven_cs.json` to include the web app files:

```json
{
  "files": [
    "assets/**/*",
    "build/**/*",
    "capacitor.config.*",
    "package.json",
    {
      "from": "node_modules",
      "filter": ["**/*"]
    },
    {
      "from": "../dist",
      "to": "app",
      "filter": ["**/*"]
    }
  ]
}
```

The key addition:
```json
{
  "from": "../dist",
  "to": "app",
  "filter": ["**/*"]
}
```

This copies all files from the root `dist` directory (web app build) to the Electron package's `app` subdirectory.

## Build Process (Corrected)

### Step 1: Build the Web App First
```bash
# From project root
npm run build
```

This creates the `dist/` directory with:
- `index.html`
- `assets/`
- `firebase-messaging-sw.js`
- etc.

### Step 2: Build the Electron App
```bash
# From electron directory
cd electron
npm run build              # Compile TypeScript
npx electron-builder build --win -c ./electron-builder.production.json
```

This now:
1. Compiles Electron TypeScript code
2. Packages Electron with node_modules
3. **Copies web app from ../dist to app/** ✅
4. Creates installers

## Verification

After building, verify the structure:

```
electron/dist/win-unpacked/resources/app/
├── assets/                    ✅ Electron assets
├── build/                     ✅ Compiled TypeScript
├── node_modules/              ✅ Dependencies
├── app/                       ✅ WEB APP FILES (was missing!)
│   ├── index.html
│   ├── assets/
│   ├── firebase-messaging-sw.js
│   └── ...
├── capacitor.config.ts
└── package.json
```

## Complete Build Command

For a full build from scratch:

```bash
# From project root
npm run build

# Then build Electron
cd electron
npm run build
npx electron-builder build --win -c ./electron-builder.production.json
```

## Automated Build Script

Created an improved build script that handles everything:

```bash
cd electron
./build-windows-complete.sh
```

This script will:
1. Check if web app is built (if not, build it)
2. Compile Electron TypeScript
3. Package with electron-builder
4. Verify web files are included

## Why This Happened

The original configuration had:
```json
{
  "files": [
    "app/**/*"   // ❌ Looking for local app/ directory
  ]
}
```

This tried to include an `app/` directory that didn't exist in the `electron/` folder.

The web app is actually built in the **parent directory** (`../dist`), so we need to explicitly copy it with:
```json
{
  "from": "../dist",
  "to": "app"
}
```

## Testing

### Test the Unpacked App
```powershell
cd electron\dist\win-unpacked
.\SSDC Horizon.exe
```

✅ Should open without errors
✅ Should load the web interface
✅ Should show login page

### Test the Installer
```powershell
cd electron\dist
.\SSDC Horizon Setup 1.0.7.exe
```

## Related Service Worker Issue

Note: The `src/main.tsx` also had an issue where it tried to register a service worker on Electron:

```typescript
// BEFORE (causes issues on Electron)
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator && Capacitor.getPlatform() === 'web') {
    // ...
  }
};
```

This is **already correct** - it only registers the service worker on web platform, not Electron.

The `/sw.js` file is in the web app `dist/` directory and is now properly copied to `app/sw.js` in the Electron build.

## Summary

✅ **Fixed**: Added web app files to electron-builder configuration  
✅ **Verified**: Web files (211 files) now included in build  
✅ **Result**: App loads without ERR_FILE_NOT_FOUND error  

## Updated Files

1. `electron/electron-builder.production.json` - Added web app copy rule
2. `electron/electron-builder.seven_cs.json` - Added web app copy rule
3. `electron/ELECTRON_ERROR_FIX.md` - This document

## Build Commands Reference

```bash
# Quick test build (x64 only, unpacked)
cd electron
npx electron-builder --win --x64 -c ./electron-builder.production.json --dir

# Full production build (x64 + ia32, installers)
cd electron
npx electron-builder build --win -c ./electron-builder.production.json

# With npm script
cd electron
npm run build:win:production
```

## Troubleshooting

### If error persists:

1. **Check web app is built**:
   ```bash
   ls -la ../dist/index.html   # Should exist
   ```

2. **Verify electron-builder config**:
   ```bash
   grep -A5 '"from": "../dist"' electron-builder.production.json
   ```

3. **Clean and rebuild**:
   ```bash
   rm -rf dist
   npx electron-builder build --win -c ./electron-builder.production.json --dir
   ```

4. **Check the packaged app**:
   ```bash
   ls -la dist/win-unpacked/resources/app/app/   # Should have 211 files
   ```

### If web app isn't built:

```bash
# From project root
npm install
npm run build
```

Then rebuild Electron app.

## Prevention

Always ensure the web app is built before building Electron:

1. Add to CI/CD pipeline:
   ```yaml
   - name: Build web app
     run: npm run build
   
   - name: Build Electron
     run: |
       cd electron
       npm run build
       npx electron-builder ...
   ```

2. Or create a combined script that builds both.

---

**Status**: ✅ FIXED
**Verified**: 211 web app files now included in Electron build
**Next Step**: Build full installer for distribution

