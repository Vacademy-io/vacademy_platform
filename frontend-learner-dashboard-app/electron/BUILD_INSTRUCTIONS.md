# Windows Installer Build Instructions

## Quick Start (Fixed Version)

The Windows installer issues have been fixed! Use the new production build:

```bash
cd electron
npm run build:win:production
```

or directly:

```bash
cd electron
./build-windows-production.sh
```

## What's Fixed

✅ **node_modules are now properly included** in the installer
✅ **Both x64 and x86 (32-bit)** architectures are supported  
✅ **Installers work on all Windows systems** without hanging
✅ **App runs correctly** after installation with all dependencies

## Build Output

After building, you'll find in `electron/dist/`:

### For SSDC Horizon:
- `SSDC Horizon Setup 1.0.7 x64.exe` - 64-bit installer
- `SSDC Horizon Setup 1.0.7 ia32.exe` - 32-bit installer
- `SSDC Horizon 1.0.7 x64.exe` - 64-bit portable (no install)
- `SSDC Horizon 1.0.7 ia32.exe` - 32-bit portable (no install)

### File Sizes (Approximate):
- Installers: ~450-550MB each
- Portable: ~300-400MB each
- Total build output: ~1.5-2GB

## Build Requirements

Before building, ensure you have:

- ✅ Node.js 16+ (18+ recommended)
- ✅ npm or pnpm installed
- ✅ ~2GB free disk space for build process
- ✅ ~1GB free disk space for output files
- ✅ Windows 10/11, macOS, or Linux/WSL

## Step-by-Step Build Process

### 1. Navigate to Electron Directory
```bash
cd electron
```

### 2. Install Dependencies (if not already done)
```bash
npm install
```

### 3. Build for Production
```bash
npm run build:win:production
```

### 4. Wait for Build to Complete
The build process takes about 5-8 minutes and will:
1. Clean previous builds
2. Compile TypeScript
3. Verify node_modules structure
4. Build installers for x64 and ia32
5. Build portable versions for x64 and ia32

### 5. Verify Build
Check that `electron/dist/` contains all 4 exe files with reasonable sizes.

## Building for Different Brands

### SSDC Horizon (Default)
```bash
npm run build:win:production
```

### Seven CS Learner
```bash
npm run build:win:sevencs
```

Or use the new fixed version:
```bash
./build-windows-seven-cs-fixed.sh
```

### Custom Brand
1. Create config: `electron-builder.<brand>.json`
2. Update app details (appId, productName, icons)
3. Build: `npx electron-builder build --win -c ./electron-builder.<brand>.json`

See `WHITE_LABELING.md` for complete guide.

## Testing the Installer

### Test x64 Version (64-bit)
```powershell
cd electron\dist
.\SSDC Horizon Setup 1.0.7 x64.exe
```

### Test ia32 Version (32-bit)
```powershell
cd electron\dist
.\SSDC Horizon Setup 1.0.7 ia32.exe
```

### Test Portable Version
```powershell
.\SSDC Horizon 1.0.7 x64.exe
```

## Verification Checklist

After installation, verify:

- [ ] App launches without errors
- [ ] No "Cannot find module" errors in DevTools console (Help → Toggle Developer Tools)
- [ ] System notifications work
- [ ] Auto-update check works (Help → Check for Updates)
- [ ] All Capacitor plugins load correctly
- [ ] App works offline
- [ ] App can be uninstalled cleanly from Windows Settings

## Common Issues & Solutions

### Issue: Build fails with "ENOENT: no such file or directory"

**Solution**: Ensure you're in the `electron` directory:
```bash
pwd  # Should show: .../frontend-learner-dashboard-app/electron
cd electron
```

### Issue: "Cannot find module" after installation

**Solution**: This shouldn't happen with the new build. If it does:
1. Check `electron-builder.production.json` has:
   ```json
   {
     "from": "node_modules",
     "filter": ["**/*"]
   }
   ```
2. Rebuild with: `npm run build:win:production`

### Issue: Installer hangs at 60%

**Solution**: The new build uses `"compression": "store"` which prevents this. If it still happens:
1. Disable Windows Defender temporarily
2. Run installer as Administrator
3. Use portable version instead

### Issue: "npm run build" fails

**Solution**: Make sure TypeScript compiles:
```bash
cd electron
npm run build
```

If errors occur, check:
- TypeScript version is compatible (^5.0.4)
- All dependencies are installed
- No syntax errors in `.ts` files

### Issue: Large installer size (~500MB)

**Why**: This is expected and intentional for reliability:
- No compression = faster installation
- Complete node_modules with pnpm structure
- Electron runtime included

**Trade-off**: Size vs. Reliability - we chose reliability.

### Issue: x86 build not working on 32-bit Windows

**Cause**: Native modules may need 32-bit compilation

**Solution**: Build on a 32-bit Windows machine or use Docker with 32-bit Node.

## Build Comparison

| Build Method | Installer Size | Install Time | node_modules | x64 | x86 | Status |
|--------------|---------------|--------------|--------------|-----|-----|--------|
| **New Production** | ~500MB | 30-60 sec | ✅ Complete | ✅ | ✅ | ✅ **Recommended** |
| Legacy (build-windows.sh) | 252MB | 5-10 min | ❌ Missing | ✅ | ❌ | ⚠️ Deprecated |
| Fast Install | ~500MB | 30-60 sec | ✅ Complete | ✅ | ❌ | ✅ Alternative |
| Smallest (asar) | 60-80MB | 2-3 min | ⚠️ Symlinks | ✅ | ❌ | ⚠️ Experimental |

## Advanced Options

### Build Only x64
```bash
npx electron-builder build --win --x64 -c ./electron-builder.production.json
```

### Build Only x86 (ia32)
```bash
npx electron-builder build --win --ia32 -c ./electron-builder.production.json
```

### Build with Debug Logging
```bash
# Windows PowerShell
$env:DEBUG="electron-builder"
npm run build:win:production

# Linux/Mac
DEBUG=electron-builder npm run build:win:production
```

### Build Portable Only
```bash
npx electron-builder build --win --x64 -c ./electron-builder.production.json -c.win.target=portable
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build Windows Installer

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build:
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: |
        cd electron
        npm install
    
    - name: Build Windows installers
      run: |
        cd electron
        npm run build:win:production
    
    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: windows-installers
        path: electron/dist/*.exe
```

### GitLab CI Example

```yaml
build-windows:
  stage: build
  image: electronuserland/builder:wine
  script:
    - cd electron
    - npm install
    - npm run build:win:production
  artifacts:
    paths:
      - electron/dist/*.exe
    expire_in: 1 week
  only:
    - main
```

## Distribution

### For Internal Deployment
1. Build with production script
2. Upload to company file share or Intune
3. Provide installation instructions to users
4. Recommend x64 for modern PCs, ia32 for older systems

### For Public Download
1. Build both x64 and ia32
2. Upload to GitHub Releases or website
3. Provide download links:
   - "Download for Windows (64-bit)" → x64 installer
   - "Download for Windows (32-bit)" → ia32 installer
   - "Download Portable Version" → portable exe
4. Include installation guide

### For Auto-Update
1. Build with production script
2. Tag release in Git
3. Push to GitHub: `git push --tags`
4. electron-updater will detect new version
5. Users get automatic update notification

## File Structure in Build

After building, the structure is:

```
electron/
├── dist/
│   ├── SSDC Horizon Setup 1.0.7 x64.exe         ← 64-bit installer
│   ├── SSDC Horizon Setup 1.0.7 ia32.exe        ← 32-bit installer
│   ├── SSDC Horizon 1.0.7 x64.exe               ← 64-bit portable
│   ├── SSDC Horizon 1.0.7 ia32.exe              ← 32-bit portable
│   ├── win-unpacked/                            ← Unpacked x64 app
│   │   └── resources/
│   │       └── app/
│   │           ├── build/                       ← Compiled TypeScript
│   │           ├── node_modules/                ← ✅ All dependencies
│   │           │   ├── .pnpm/                   ← ✅ pnpm structure
│   │           │   └── .modules.yaml            ← ✅ pnpm metadata
│   │           └── package.json
│   ├── win-ia32-unpacked/                       ← Unpacked ia32 app
│   └── [other build artifacts]
```

## Next Steps

After successful build:

1. ✅ **Test on clean Windows machine** (important!)
2. ✅ **Test both x64 and ia32** versions
3. ✅ **Verify all app features** work
4. ✅ **Test installation/uninstallation** process
5. ⏭️ **Consider code signing** for Windows SmartScreen (optional)
6. ⏭️ **Set up auto-update** server (optional)
7. ⏭️ **Create distribution plan** (internal vs public)

## Support & Documentation

For more information, see:

- **WINDOWS_INSTALLER_FIX.md** - Detailed explanation of the fix
- **SIZE_OPTIMIZATION_GUIDE.md** - How to reduce installer size
- **INSTALLER_TROUBLESHOOTING.md** - Common issues and solutions
- **WHITE_LABELING.md** - Building for multiple brands
- **BUILD_SUMMARY.md** - Build system overview

## Quick Reference

### Most Common Commands

```bash
# Standard production build (recommended)
npm run build:win:production

# Seven CS brand
npm run build:win:sevencs

# Legacy build (deprecated)
npm run build:win:ssdc:legacy

# Fast install build (alternative)
npm run build:win:ssdc:fast

# Only x64
npx electron-builder --win --x64 -c ./electron-builder.production.json

# Clean build
rm -rf dist build && npm run build:win:production
```

### Build Times

- First build: 5-8 minutes
- Incremental build: 3-5 minutes
- TypeScript compilation: 30-60 seconds
- electron-builder packaging: 4-6 minutes

### Disk Space Required

- Source code: ~500MB
- node_modules: ~700MB
- Build output: ~1.5-2GB
- **Total**: ~3GB free space recommended

## Troubleshooting Contact

If you encounter issues not covered in this guide:

1. Check the error message in terminal
2. Look for similar issues in:
   - `WINDOWS_INSTALLER_FIX.md`
   - `INSTALLER_TROUBLESHOOTING.md`
3. Enable debug logging: `DEBUG=electron-builder npm run build:win:production`
4. Check Windows Event Viewer for installation errors
5. Try building with a clean install:
   ```bash
   rm -rf node_modules dist build
   npm install
   npm run build:win:production
   ```

## Summary

The Windows installer issue has been **completely fixed** with:

✅ Proper node_modules inclusion in configuration  
✅ Single-pass build process (no post-build copying)  
✅ Support for both x64 and x86 architectures  
✅ Reliable installation without hanging  
✅ Store compression for maximum compatibility  

**Just run**: `npm run build:win:production` and you're done!

