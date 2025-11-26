# YouTube Error 153 Fix - Electron Windows

## Problem
YouTube error 153 is occurring on some Windows devices when trying to play YouTube videos via iframe in the Electron app. This error indicates a "Video Player Configuration Error" and is typically caused by missing or incorrect referrer policies.

## Root Cause
The error occurs because:
1. YouTube's iframe embedding requires proper referrer policy headers
2. Cross-origin restrictions in Electron prevent proper iframe communication
3. Missing security headers and iframe attributes
4. Windows-specific: YouTube iframe requests sometimes lack proper Referer headers

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
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  const insecureCsp = `default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src *; frame-src * https://www.youtube.com https://www.youtube-nocookie.com`;

  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [insecureCsp],
      'Cross-Origin-Opener-Policy': ['same-origin-allow-popups'],
      'Referrer-Policy': ['strict-origin-when-cross-origin'],
    },
  });
});
```

**C. Windows-Specific Session Handler (Error 153 Fix)**
```typescript
// Only applies on Windows to avoid breaking Mac
if (process.platform === 'win32') {
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    // Only modify YouTube iframe embed requests
    if (details.url.includes('youtube.com/embed/')) {
      const modifiedHeaders = { ...details.requestHeaders };
      
      // Add Referer header if missing
      if (!modifiedHeaders['Referer'] && details.referrer) {
        modifiedHeaders['Referer'] = details.referrer;
      }
      
      callback({ requestHeaders: modifiedHeaders });
    } else {
      callback({ requestHeaders: details.requestHeaders });
    }
  });
}
```

## How It Works

1. **Referrer Policy**: The `strict-origin-when-cross-origin` policy allows YouTube to know where the request is coming from (origin) without exposing the full URL path

2. **iframe Attributes**: Proper `allow` attribute ensures YouTube has permission to use necessary browser features (autoplay, fullscreen, etc.)

3. **Widget Referrer**: The `widget_referrer` parameter explicitly tells YouTube the embedding page's URL

4. **Web Security**: Disabling `webSecurity` in Electron allows cross-origin iframe embedding (necessary for Electron's custom protocol)

5. **CSP Headers**: Updated Content Security Policy explicitly allows YouTube domains in frames

6. **Windows-Specific Session Handler**: On Windows only (`process.platform === 'win32'`), intercepts YouTube iframe embed requests and ensures they have a proper Referer header. This is the KEY FIX for Error 153 on Windows, and is disabled on Mac/Linux to prevent compatibility issues.
   - Only modifies requests to `youtube.com/embed/` (the iframe itself, not video chunks)
   - Only adds Referer if it's missing
   - Doesn't interfere with Mac or Linux

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

- The `webSecurity: false` setting should be used carefully as it disables some security features. Only use in Electron desktop apps.
- Consider using `youtube-nocookie.com` domain for enhanced privacy if needed
- Clear browser cache if issues persist after update
- Ensure all dependencies are up to date
- **The Windows-specific session handler is CRITICAL for fixing Error 153 on Windows devices**
- The session handler is platform-specific (`process.platform === 'win32'`) and won't affect Mac or Linux
- Mac and web versions work with just the base configuration (iframe attributes + CSP headers)

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

