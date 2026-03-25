# Cloudflare Pages - Memory Issue Quick Fix

## Problem
Build failing on Cloudflare Pages with error:
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

## Solution Applied ✅

### 1. Files Changed:

#### `package.json`
- Updated build script to include Node.js memory limit:
```json
"build": "NODE_OPTIONS='--max-old-space-size=8192' tsc && NODE_OPTIONS='--max-old-space-size=8192' vite build"
```

#### `vite.config.ts`
- Changed minifier from `terser` to `esbuild` (faster, uses less memory)
- Disabled sourcemaps: `sourcemap: false`
- Disabled compressed size reporting: `reportCompressedSize: false`
- Limited parallel operations: `maxParallelFileOps: 2`

### 2. Files Created:

- `.node-version` - Specifies Node.js 18.20.0
- `.nvmrc` - Node version manager config
- `build-cloudflare.sh` - Custom build script for Cloudflare
- `CLOUDFLARE_BUILD_CONFIG.md` - Detailed documentation

## Cloudflare Pages Configuration

### Option 1: Use Updated npm Scripts (Recommended)
In Cloudflare Pages dashboard:

**Build command:**
```bash
npm install -g pnpm && pnpm install && pnpm run build
```

**Build output directory:**
```
dist
```

### Option 2: Use Custom Build Script
In Cloudflare Pages dashboard:

**Build command:**
```bash
npm install -g pnpm && chmod +x build-cloudflare.sh && ./build-cloudflare.sh
```

**Build output directory:**
```
dist
```

### Option 3: Add Environment Variable
If above options don't work, add this in Cloudflare Pages → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `NODE_OPTIONS` | `--max-old-space-size=8192` |

## Test Locally First

```bash
# Test the build works locally
pnpm run build

# If successful, commit and push changes
git add .
git commit -m "Fix: Cloudflare build memory issue"
git push
```

## Expected Result

Build should now complete successfully without memory errors. Total build time may be 4-7 minutes.

## If Still Failing

1. Check Cloudflare build logs for the actual error
2. Verify Node.js version in logs is 18.20.0
3. Verify NODE_OPTIONS is being applied in logs
4. Consider building locally and deploying pre-built `dist` folder

## Additional Optimizations (If Needed)

If builds still fail, consider:

1. **Lazy load heavy components:**
   - Excalidraw editor
   - PDF viewers
   - Monaco editor
   - Yoopta editor

2. **Remove unused dependencies** from package.json

3. **Use dynamic imports** for large libraries

4. **Split into micro-frontends** if the app continues to grow

## Support

For more details, see `CLOUDFLARE_BUILD_CONFIG.md`

