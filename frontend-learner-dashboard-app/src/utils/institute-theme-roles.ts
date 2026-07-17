import convert from "color-convert";
import { hslVar } from "@/lib/theme-ramp";
import {
  THEME_ROLE_SETTINGS_KEY,
  type ThemeRoleSettings,
} from "@/types/theme-role-settings";

/**
 * Role-based theme (nav / secondary / tertiary / background) plumbing that has
 * to work on BOTH the logged-in path and the public/no-login pages (enroll-by-
 * invite, custom-domain landing, product pages).
 *
 * The logged-in path caches THEME_SETTING into localStorage via
 * fetchAndStoreInstituteDetails, and the ThemeProvider reads it from there. The
 * public pages never call that fetch — they get institute data from the public
 * endpoints — so without this helper their canvas/background role is simply
 * never loaded, and an institute-set page background silently doesn't render.
 */

/** Parse the current cached role settings, if any. */
export function readThemeRoleSettings(): ThemeRoleSettings | null {
  try {
    const raw = localStorage.getItem(THEME_ROLE_SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as ThemeRoleSettings) : null;
  } catch {
    return null;
  }
}

/**
 * Extract THEME_SETTING.data out of an institute's settings JSON (the
 * `institute_settings_json` / public `setting` field, string or object) and
 * cache it into localStorage under THEME_ROLE_SETTINGS_KEY — the exact shape
 * and key the ThemeProvider already reads. Clears the key when there are no
 * roles, so switching to an institute without an override doesn't inherit the
 * previous one. Returns the parsed settings for convenience.
 */
export function syncThemeRoleSettingsFromSettingJson(
  settingJson: unknown
): ThemeRoleSettings | null {
  try {
    const parsed =
      typeof settingJson === "string"
        ? settingJson
          ? JSON.parse(settingJson)
          : null
        : settingJson;
    const data: ThemeRoleSettings | undefined =
      parsed?.setting?.THEME_SETTING?.data;
    if (data?.roles && Object.keys(data.roles).length > 0) {
      localStorage.setItem(THEME_ROLE_SETTINGS_KEY, JSON.stringify(data));
      return data;
    }
    localStorage.removeItem(THEME_ROLE_SETTINGS_KEY);
    return data ?? null;
  } catch {
    return null;
  }
}

/**
 * Apply the institute-authored page background (THEME_SETTING `background`
 * role) to the document. Repaints the canvas only — --card stays white, so
 * cards keep reading as raised surfaces on a tinted page. Inline custom
 * properties outrank the stylesheet, so this also wins over
 * cleaner-play-theme.css's forced white; --cp-bg is set too so that skin's
 * canvas rule follows along. Removing the value falls back to the stylesheet
 * default (white).
 */
export function applyInstituteBackground(): void {
  const background = readThemeRoleSettings()?.roles?.background;
  const root = document.documentElement;
  if (!background) {
    root.style.removeProperty("--background");
    root.style.removeProperty("--cp-bg");
    return;
  }
  try {
    const [h, s, l] = convert.hex.hsl(background.replace("#", ""));
    const value = hslVar([h, s, l]);
    root.style.setProperty("--background", value);
    root.style.setProperty("--cp-bg", value);
  } catch {
    // ignore malformed institute-authored hex
  }
}
