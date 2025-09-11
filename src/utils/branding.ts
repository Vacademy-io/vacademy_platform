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
    } catch {}

    // Update favicon via DOM
    if (iconUrl) {
      try {
        // Helper to upsert a link
        const upsertIcon = (rel: string, sizes?: string, type?: string) => {
          let sel = `link[rel="${rel}"]` + (sizes ? `[sizes="${sizes}"]` : '');
          let el = document.querySelector<HTMLLinkElement>(sel);
          if (!el) {
            el = document.createElement('link');
            el.rel = rel as any;
            if (sizes) el.sizes = sizes as any;
            if (type) el.type = type;
            document.head.appendChild(el);
          }
          el.href = iconUrl;
          console.log('[Branding] Set', rel, sizes || '', '->', iconUrl);
        };

        // Update existing icon links of any rel*="icon"
        const links = document.querySelectorAll<HTMLLinkElement>('link[rel*="icon"]');
        links.forEach((lnk) => {
          console.log('[Branding] Updating favicon link:', lnk.outerHTML, '->', iconUrl);
          lnk.href = iconUrl;
        });

        // Ensure common variants exist for better browser support
        upsertIcon('icon', '16x16', 'image/png');
        upsertIcon('icon', '32x32', 'image/png');
        upsertIcon('icon');
        upsertIcon('shortcut icon');
        upsertIcon('apple-touch-icon', '180x180', 'image/png');
      } catch (e) {
        console.warn('[Branding] Failed to update favicon links', e);
      }
    }

    return { iconUrl, tabText };
  } catch {
    return { iconUrl: null, tabText: null };
  }
};


