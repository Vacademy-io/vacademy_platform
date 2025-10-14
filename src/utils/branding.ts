import { Preferences } from "@capacitor/preferences";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";

export interface TabBrandingResult {
  iconUrl: string | null;
  tabText: string | null;
}

// Global state to track current favicon and prevent unnecessary resets
let currentFaviconUrl: string | null = null;
let faviconMonitorInterval: NodeJS.Timeout | null = null;
let lastFaviconRefreshMs = 0;
const FAVICON_REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const FALLBACK_FAVICON_URL = "/icons/icon-48.webp"; // Static fallback

// Helper: create favicon link elements
const createFaviconLink = (href: string, rel: string, sizes?: string, type?: string) => {
  const el = document.createElement('link');
  el.rel = rel;
  if (sizes) el.setAttribute('sizes', sizes);
  if (type) el.type = type;
  el.href = href;
  el.setAttribute('data-custom-favicon', 'true');
  document.head.appendChild(el);
  return el;
};

// Helper: remove all favicon links
const removeAllFaviconLinks = () => {
  const existingLinks = document.querySelectorAll<HTMLLinkElement>('link[rel*="icon"]');
  existingLinks.forEach((link) => link.remove());
};

// Helper: apply favicon links for a given URL (creates common sizes and apple touch)
const applyFaviconLinks = (iconUrl: string) => {
  // Do NOT cache-bust signed URLs (e.g., S3 pre-signed) or the signature will break
  const isSignedUrl = /[?&]X-Amz-/.test(iconUrl) || /[?&]Signature=/.test(iconUrl);
  const hrefToUse = isSignedUrl
    ? iconUrl
    : (iconUrl.includes('?') ? `${iconUrl}&v=${Date.now()}` : `${iconUrl}?v=${Date.now()}`);

  removeAllFaviconLinks();
  createFaviconLink(hrefToUse, 'icon', '16x16');
  createFaviconLink(hrefToUse, 'icon', '32x32');
  createFaviconLink(hrefToUse, 'icon');
  createFaviconLink(hrefToUse, 'shortcut icon');
  createFaviconLink(hrefToUse, 'apple-touch-icon', '180x180');
  // Nudge browsers to refresh the favicon
  setTimeout(() => {
    const links = document.querySelectorAll<HTMLLinkElement>('link[rel*="icon"]');
    links.forEach((link) => {
      const originalHref = link.href;
      link.href = '';
      setTimeout(() => {
        link.href = originalHref;
      }, 1);
    });
  }, 100);
};

// Apply tab title and favicon from stored Preferences. Optional fallbackTitle used if no tabText stored.
export const applyTabBranding = async (
  fallbackTitle?: string
): Promise<TabBrandingResult> => {
  try {
    const instituteId = (await Preferences.get({ key: "InstituteId" })).value || "";
    let tabText: string | null = null;
    let iconUrl: string | null = null;
    let fontFamily: string | null = null;

    if (instituteId) {
      const learner = await Preferences.get({ key: `LEARNER_${instituteId}` });
      if (learner?.value) {
        const parsed = JSON.parse(learner.value);
        tabText = parsed?.tabText || null;
        fontFamily = parsed?.fontFamily || null;
        if (parsed?.tabIconFileId) {
          try {
            iconUrl = await getPublicUrlWithoutLogin(parsed.tabIconFileId);
          } catch {
            iconUrl = null;
          }
        }
      }
    }

    // Update document title
    if (tabText || fallbackTitle) {
      document.title = tabText ?? (fallbackTitle as string);
    }

    // Apply font family if provided
    try {
      if (fontFamily) {
        const mapFamily = (f: string) => {
          const key = String(f).toUpperCase();
          if (key === "INTER") return 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
          if (key === "CAIRO") return 'Cairo, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
          if (key === "PLAYPEN SANS") return 'Playpen Sans, cursive, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
          return f;
        };
        const resolved = mapFamily(fontFamily);
        document.documentElement.style.setProperty("--app-font-family", resolved);
        document.body.style.fontFamily = resolved;
      }
    } catch {
      // Ignore font family errors
    }

    // Ensure we always have some icon to show
    if (!iconUrl) {
      iconUrl = FALLBACK_FAVICON_URL;
    }

    // Update favicon via DOM - but only if it's different from current
    const shouldUpdateFavicon = iconUrl !== currentFaviconUrl;
    
    if (shouldUpdateFavicon) {
      console.log('[Branding] Favicon change detected:', currentFaviconUrl, '->', iconUrl);
      currentFaviconUrl = iconUrl;
      
      try {
        applyFaviconLinks(iconUrl);
      } catch (e) {
        console.warn('[Branding] Failed to update favicon links', e);
      }
      
      // Start monitoring to prevent favicon resets
      startFaviconMonitoring();
    } else {
      console.log('[Branding] Favicon unchanged, skipping update');
    }

    lastFaviconRefreshMs = Date.now();
    return { iconUrl, tabText };
  } catch {
    return { iconUrl: null, tabText: null };
  }
};

// Function to monitor and maintain favicon
const startFaviconMonitoring = () => {
  // Clear any existing monitor
  if (faviconMonitorInterval) {
    clearInterval(faviconMonitorInterval);
  }
  
  // Only monitor if we have a custom favicon
  if (!currentFaviconUrl) {
    return;
  }
  
  faviconMonitorInterval = setInterval(async () => {
    try {
      const customFaviconLinks = document.querySelectorAll<HTMLLinkElement>('link[data-custom-favicon="true"]');
      const allFaviconLinks = document.querySelectorAll<HTMLLinkElement>('link[rel*="icon"]');
      
      // Check if our custom favicon links are missing or if unwanted favicon links appeared
      const hasCustomFavicons = customFaviconLinks.length > 0;
      const hasUnwantedFavicons = Array.from(allFaviconLinks).some(link => 
        !link.hasAttribute('data-custom-favicon') && 
        (link.href.includes('favicon.ico') || link.href.includes('/favicon'))
      );
      
      // Also refresh periodically to handle expiring signed URLs
      const now = Date.now();
      const isTimeToRefresh = now - lastFaviconRefreshMs > FAVICON_REFRESH_INTERVAL_MS;

      if (!hasCustomFavicons || hasUnwantedFavicons) {
        console.log('[Branding] Favicon reset detected, reapplying custom favicon');
        
        // Remove all favicon links
        allFaviconLinks.forEach(link => link.remove());
        
        // Reapply favicon using the last known URL or fallback
        applyFaviconLinks(currentFaviconUrl || FALLBACK_FAVICON_URL);
        lastFaviconRefreshMs = Date.now();
      } else if (isTimeToRefresh) {
        console.log('[Branding] Periodic favicon refresh');
        try {
          const instituteId = (await Preferences.get({ key: 'InstituteId' })).value || "";
          let nextUrl: string | null = null;
          if (instituteId) {
            const learner = await Preferences.get({ key: `LEARNER_${instituteId}` });
            const parsed = learner?.value ? JSON.parse(learner.value) : null;
            const fileId = parsed?.tabIconFileId || null;
            if (fileId) {
              try {
                nextUrl = await getPublicUrlWithoutLogin(fileId);
              } catch {
                nextUrl = null;
              }
            }
          }
          if (!nextUrl) {
            nextUrl = FALLBACK_FAVICON_URL;
          }
          if (nextUrl !== currentFaviconUrl) {
            currentFaviconUrl = nextUrl;
            applyFaviconLinks(nextUrl);
          } else {
            // Even if unchanged, reapply to bust cache in case URL has expired server-side
            applyFaviconLinks(nextUrl);
          }
        } catch (e) {
          console.warn('[Branding] Error refreshing favicon URL:', e);
          // Apply fallback on error
          currentFaviconUrl = FALLBACK_FAVICON_URL;
          applyFaviconLinks(FALLBACK_FAVICON_URL);
        }
        lastFaviconRefreshMs = Date.now();
      }
    } catch (e) {
      console.warn('[Branding] Error in favicon monitoring:', e);
    }
  }, 5000); // Check every 5 seconds
};

// Function to stop favicon monitoring (useful for cleanup)
export const stopFaviconMonitoring = () => {
  if (faviconMonitorInterval) {
    clearInterval(faviconMonitorInterval);
    faviconMonitorInterval = null;
  }
};


