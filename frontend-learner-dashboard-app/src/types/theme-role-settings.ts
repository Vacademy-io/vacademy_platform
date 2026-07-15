// Role-based institute theme, stored under the THEME_SETTING key in the
// institute's settings JSON (see admin_core_service SettingKeyEnums).
// Brand keeps flowing through the existing institute_theme_code / theme.json
// path unchanged.
export const THEME_ROLE_SETTINGS_KEY = "themeRoleSettings";

export interface NavRoleColors {
  surface: string;
  surfaceHover: string;
  active: string;
  activeText: string;
  text: string;
}

export interface ThemeRoleSettings {
  version?: number;
  mode?: "preset" | "custom" | "legacy";
  roles?: {
    nav?: NavRoleColors;
    // Single base hex each — the 50-500 ramp is generated from it (same
    // formula as brand). Learner-app-only: these tokens don't exist in the
    // admin dashboard (see its CLAUDE.md — secondary-*/tertiary-* are a
    // learner extra), so setting these has no visual effect there.
    secondary?: string;
    tertiary?: string;
  };
}
