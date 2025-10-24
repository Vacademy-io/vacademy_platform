# Size Optimization Guide for Electron Builds

## Current Build Sizes

### Current (Working) Build - `build-windows.sh`
- **NSIS Installer:** 252MB
- **Portable:** 168MB  
- **Unpacked App:** 734MB
- **Method:** Includes entire pnpm `.pnpm` directory (702MB)
- **✅ Pros:** Works reliably, no module errors
- **❌ Cons:** Very large size due to pnpm overhead

## Size Reduction Strategies

### Strategy 1: Enable ASAR Compression (Recommended)
**Estimated Size:** 60-80MB (70-80% reduction)

ASAR is Electron's archive format that compresses application files. Currently disabled to avoid module loading issues.

**Configuration: `electron-builder.optimized.json`**
```json
{
  "asar": true,
  "asarUnpack": [
    "**/*.node",
    "**/node_modules/node-notifier/**/*"
  ]
}
```

**How to use:**
```bash
cd electron
./build-windows-smallest.sh
```

**Trade-offs:**
- ✅ Massive size reduction (70-80%)
- ✅ Faster loading (compressed)
- ✅ Better security (files not directly accessible)
- ⚠️ Some native modules may need to be unpacked

### Strategy 2: Use Flat node_modules Structure
**Estimated Size:** 100-120MB (50-60% reduction)

Replace pnpm's symlinked structure with npm's flat structure.

**Script: `build-windows-optimized.sh` or `build-windows-small.sh`**

These scripts:
1. Create temporary directory
2. Install production dependencies with npm (flat structure)
3. Build with that node_modules
4. Restore pnpm node_modules for development

**Trade-offs:**
- ✅ Significantly smaller than pnpm structure
- ✅ No symlink overhead
- ✅ Production dependencies only
- ⚠️ Longer build time (npm install each time)
- ⚠️ Requires fixing npm cache permissions: `sudo chown -R $USER ~/.npm`

### Strategy 3: Hybrid Approach (Best Balance)
**Estimated Size:** 50-70MB (75-85% reduction)

Combine both strategies:
1. Use npm for flat structure
2. Enable asar compression
3. Unpack only native modules

This gives the best size reduction while maintaining compatibility.

## Comparison Table

| Build Method | Size | Build Time | Complexity | Reliability |
|-------------|------|------------|------------|-------------|
| Current (pnpm + no asar) | 252MB | 2-3 min | Low | ✅ High |
| Optimized (npm + no asar) | 100-120MB | 4-5 min | Medium | ✅ High |
| Smallest (npm + asar) | 50-70MB | 4-5 min | Medium | ⚠️ Test needed |
| Smallest (pnpm + asar) | 60-80MB | 2-3 min | Low | ⚠️ Test needed |

## Recommended Approach

### For Immediate Release (Most Reliable)
Use the current build:
```bash
npm run build:win:ssdc
```

### For Optimized Size (After Testing)
1. First try the simplest optimization with asar:
```bash
./build-windows-smallest.sh
```

2. Test the built app thoroughly:
   - Launch app, check for module errors
   - Test all features (notifications, updates, file handling)
   - Test on a clean Windows machine

3. If errors occur, identify problematic modules and add to `asarUnpack`

## Testing Checklist

After building with any optimized method:

- [ ] App launches without errors
- [ ] System notifications work (node-notifier)
- [ ] Auto-updates check works (electron-updater)
- [ ] Error handling works (electron-unhandled)
- [ ] Capacitor plugins work (@capacitor-community/electron)
- [ ] File operations work (mime-types)
- [ ] App works on clean Windows 10/11

## Common Issues & Solutions

### Issue: "Cannot find module 'X'" after optimization

**Solution:** Add the module to `asarUnpack` in `electron-builder.optimized.json`:
```json
"asarUnpack": [
  "**/*.node",
  "**/node_modules/problematic-module/**/*"
]
```

### Issue: Native modules fail to load

**Solution:** Native modules (`.node` files) must be unpacked:
```json
"asarUnpack": [
  "**/*.node"
]
```

### Issue: npm install fails with permission errors

**Solution:**
```bash
sudo chown -R $(id -u):$(id -g) ~/.npm
```

## Module-Specific Requirements

Based on the app's dependencies, these modules have special requirements:

- **node-notifier**: Uses native binaries, should be unpacked
- **@capacitor-community/electron**: Core plugin, test thoroughly
- **electron-updater**: Usually works in asar
- **electron-unhandled**: Usually works in asar
- **chokidar**: Only used in dev mode, not packaged

## Build Scripts Summary

| Script | Method | Estimated Size | Status |
|--------|--------|---------------|---------|
| `build-windows.sh` | pnpm + no asar | 252MB | ✅ Working |
| `build-windows-optimized.sh` | npm + no asar | 100-120MB | ⚠️ Needs npm cache fix |
| `build-windows-small.sh` | npm + asar | 50-70MB | ⚠️ Needs npm cache fix |
| `build-windows-smallest.sh` | pnpm + asar | 60-80MB | ⚠️ Needs testing |

## Next Steps

1. **Immediate:** Use current `build-windows.sh` for releases
2. **Test:** Try `build-windows-smallest.sh` and test thoroughly
3. **If successful:** Update to use optimized build by default
4. **If issues:** Document problematic modules in `asarUnpack`

## Future Improvements

1. **Switch to npm/yarn:** Avoid pnpm complexity in Electron builds
2. **Selective dependency inclusion:** Remove unused sub-dependencies
3. **Code splitting:** Separate rarely-used code into lazy-loaded modules
4. **Compression:** Use 7z compression for even smaller installers

