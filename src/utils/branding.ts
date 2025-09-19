import { Preferences } from "@capacitor/preferences";
import { getPublicUrl } from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/excalidrawUtils";

export interface TabBrandingResult {
  iconUrl: string | null;
  tabText: string | null;
}

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
            iconUrl = await getPublicUrl(parsed.tabIconFileId);
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
          return f;
        };
        const resolved = mapFamily(fontFamily);
        document.documentElement.style.setProperty("--app-font-family", resolved);
        document.body.style.fontFamily = resolved;
      }
    } catch {
      // Ignore font family errors
    }

    // Update favicon via DOM
    if (iconUrl) {
      try {
        // Add cache busting to ensure fresh icon loads
        const cacheBustedUrl = `${iconUrl}?v=${Date.now()}`;
        
        // Remove all existing favicon links to prevent conflicts
        const existingLinks = document.querySelectorAll<HTMLLinkElement>('link[rel*="icon"]');
        existingLinks.forEach((link) => {
          console.log('[Branding] Removing existing favicon link:', link.outerHTML);
          link.remove();
        });

        // Helper to create a new link
        const createIcon = (rel: string, sizes?: string, type?: string) => {
          const el = document.createElement('link');
          el.rel = rel;
          if (sizes) el.setAttribute('sizes', sizes);
          if (type) el.type = type;
          el.href = cacheBustedUrl;
          document.head.appendChild(el);
          console.log('[Branding] Created', rel, sizes || '', '->', cacheBustedUrl);
          return el;
        };

        // Create fresh favicon links for better browser support
        createIcon('icon', '16x16', 'image/png');
        createIcon('icon', '32x32', 'image/png');
        createIcon('icon');
        createIcon('shortcut icon');
        createIcon('apple-touch-icon', '180x180', 'image/png');
        
        // Force favicon update by temporarily changing the href
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
        
      } catch (e) {
        console.warn('[Branding] Failed to update favicon links', e);
      }
    } else {
      // If no iconUrl, remove all favicon links to prevent showing default favicon.ico
      try {
        const existingLinks = document.querySelectorAll<HTMLLinkElement>('link[rel*="icon"]');
        existingLinks.forEach((link) => {
          console.log('[Branding] Removing favicon link (no icon):', link.outerHTML);
          link.remove();
        });
      } catch (e) {
        console.warn('[Branding] Failed to remove favicon links', e);
      }
    }

    return { iconUrl, tabText };
  } catch {
    return { iconUrl: null, tabText: null };
  }
};


