# YouTube Error 153 Fix - Electron Windows

## Problem
YouTube error 153 was occurring on some Windows devices when trying to play YouTube videos via iframe in the Electron app. This error indicates a "Video Player Configuration Error" and is typically caused by missing or incorrect referrer policies.

## Root Cause
The error occurs because:
1. YouTube's iframe embedding requires proper referrer policy headers
2. Cross-origin restrictions in Electron prevent proper iframe communication
3. Missing security headers and iframe attributes

## Solution Implemented

### 1. YouTube Player Components Updates

#### Files Modified:
- `src/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/youtube-player.tsx`
- `src/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/video-player.tsx`

#### Changes Made:

**A. Added Referrer Policy to iFrame Attributes**
```typescript
iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
```

**B. Enhanced iframe `allow` Attribute**
```typescript
iframe.setAttribute(
  "allow",
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
);
```

**C. Added `widget_referrer` to Player Variables**
```typescript
playerVars: {
  // ... other options
  widget_referrer: window.location.href, // Fix for error 153
}
```

### 2. Electron Configuration Updates

#### File Modified:
- `electron/src/setup.ts`

#### Changes Made:

**A. Updated BrowserWindow webPreferences**
```typescript
webPreferences: {
  nodeIntegration: true,
  contextIsolation: true,
  devTools: false,
  webSecurity: false, // Allow cross-origin iframes (for YouTube)
  allowRunningInsecureContent: false,
  preload: preloadPath,
}
```

**B. Enhanced Content Security Policy**
```typescript
const insecureCsp = `default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src *; frame-src * https://www.youtube.com https://www.youtube-nocookie.com`;

callback({
  responseHeaders: {
    ...details.responseHeaders,
    'Content-Security-Policy': [insecureCsp],
    'Cross-Origin-Opener-Policy': ['same-origin-allow-popups'],
    'Referrer-Policy': ['strict-origin-when-cross-origin'],
  },
});
```

## How It Works

1. **Referrer Policy**: The `strict-origin-when-cross-origin` policy allows YouTube to know where the request is coming from (origin) without exposing the full URL path
2. **iframe Attributes**: Proper `allow` attribute ensures YouTube has permission to use necessary browser features
3. **Widget Referrer**: The `widget_referrer` parameter explicitly tells YouTube the embedding page's URL
4. **Web Security**: Disabling `webSecurity` in Electron allows cross-origin iframe embedding
5. **CSP Headers**: Updated Content Security Policy explicitly allows YouTube domains in frames

## Testing

After implementing these changes:
1. Rebuild the Electron app
2. Test on Windows devices that previously showed error 153
3. Verify videos play correctly without errors
4. Check that all video controls work as expected

## Build Commands

```bash
cd electron
npm run build  # or your build command
```

## Additional Notes

- The `webSecurity: false` setting should be used carefully as it disables some security features
- Consider using `youtube-nocookie.com` domain for enhanced privacy if needed
- Clear browser cache if issues persist after update
- Ensure all dependencies are up to date

## References

- YouTube Error 153 is a Video Player Configuration Error
- Related to referrer policy and cross-origin embedding restrictions
- Common in Electron apps due to stricter security policies

## Fallback Options

If the issue persists on specific devices:
1. Check for browser extensions or antivirus software blocking YouTube
2. Clear Electron app cache and cookies
3. Verify network/firewall isn't blocking YouTube domains
4. Update Electron and Chromium to latest versions
5. Consider using YouTube Data API as alternative player

## Security Considerations

⚠️ **Important**: The `webSecurity: false` setting reduces security. Consider:
- Only disabling it if necessary
- Implementing additional validation on URLs being loaded
- Monitoring for security updates in Electron
- Restricting external content loading where possible

