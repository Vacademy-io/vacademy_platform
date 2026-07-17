import { Preferences } from "@capacitor/preferences";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";

export interface TabBrandingResult {
  iconUrl: string | null;
  tabText: string | null;
}

/* ============================================================================
 * Font stacks (i18n Phase 1 — Arabic-first).
 *
 * SINGLE SOURCE OF TRUTH for every runtime `--app-font-family` / body font
 * write. White-label branding used to REPLACE the whole stack, which dropped
 * the 'Noto Naskh Arabic' fallback that src/index.css puts in the default
 * chain — so a branded institute rendered Arabic in whatever the OS happened
 * to pick (often a face with no Arabic glyphs at all). Every setter now routes
 * through resolveFontStack()/buildFontStack() so the Arabic face can never be
 * dropped again.
 *
 * Latin rendering is unchanged: the Noto Naskh Arabic @font-face in index.css
 * is unicode-range-scoped to Arabic-script codepoints, so Latin text can never
 * match it and simply continues down to the next family in the list. Brand
 * fonts that DO carry Arabic glyphs (e.g. Cairo) still win, because they sit
 * ahead of the fallback.
 * ========================================================================== */

/** Arabic-script face. @font-face + unicode-range live in src/index.css. */
const ARABIC_FALLBACK = "'Noto Naskh Arabic'";

/** Emoji tail shared by the branded stacks below. Kept verbatim. */
const EMOJI_TAIL =
  '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';

/** System tail shared by the sans-serif branded stacks below. Kept verbatim. */
const SYSTEM_TAIL = `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", ${EMOJI_TAIL}`;

/**
 * Builds a full font stack: brand font → Arabic fallback → system fallbacks.
 * The Arabic face is injected here and nowhere else, so no caller can omit it.
 */
export function buildFontStack(brandFont?: string, tail: string = SYSTEM_TAIL): string {
  return [brandFont, ARABIC_FALLBACK, tail].filter(Boolean).join(", ");
}

/** True when `stack` already names the Arabic face (avoids double-insertion). */
const hasArabicFallback = (stack: string): boolean =>
  /noto\s+naskh\s+arabic/i.test(stack);

/**
 * Injects the Arabic fallback into a caller-supplied CSS font stack (e.g. a
 * catalogue's `fonts.family` JSON blob) directly after the first family.
 *
 * It must go after the brand font (so branding still wins for Latin, and for
 * Arabic when the brand font has Arabic glyphs) but BEFORE any generic family
 * such as `sans-serif`/`cursive` — a generic matches every codepoint, so an
 * Arabic face appended after one would never be reached.
 */
export function withArabicFallback(stack: string): string {
  const trimmed = stack.trim();
  if (!trimmed) return buildFontStack();
  if (hasArabicFallback(trimmed)) return trimmed;

  const [first, ...rest] = trimmed.split(",");
  return [first!.trim(), ARABIC_FALLBACK, ...rest.map((part) => part.trim())].join(", ");
}

/** Default stack when an institute has no branded font (e.g. /resolve 404). */
const DEFAULT_STACK = buildFontStack("Inter");

/**
 * Maps an institute's configured font to its full stack, Arabic fallback
 * included. Known brand keys expand to their curated stack; anything else is
 * treated as a literal CSS stack and only gains the Arabic fallback.
 *
 * This replaces the `mapFamily` helper that was copy-pasted verbatim across
 * branding.ts, login-form, forgot-password-form and the two Modular*Container
 * files — every one of which dropped the Arabic face.
 */
export function resolveFontStack(fontFamily?: string | null): string {
  if (!fontFamily) return DEFAULT_STACK;

  switch (String(fontFamily).toUpperCase()) {
    case "INTER":
      return DEFAULT_STACK;
    case "CAIRO":
      return buildFontStack("Cairo");
    case "PLAYPEN SANS":
      return buildFontStack("Playpen Sans", `cursive, ${EMOJI_TAIL}`);
    case "WORK SANS":
      return buildFontStack("Work Sans");
    case "LEXEND":
      return buildFontStack("Lexend");
    default:
      return withArabicFallback(String(fontFamily));
  }
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

    // Apply font family if provided, else fall back to default Inter stack.
    // resolveFontStack keeps the Arabic fallback in the chain either way.
    try {
      const resolved = resolveFontStack(fontFamily);
      document.documentElement.style.setProperty("--app-font-family", resolved);
      document.body.style.fontFamily = resolved;
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


