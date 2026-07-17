// Role-based institute theme, stored under the THEME_SETTING key in the
// institute's settings JSON (see admin_core_service SettingKeyEnums).
// Brand keeps flowing through the existing institute_theme_code / theme.json
// path unchanged.
export const THEME_ROLE_SETTINGS_KEY = 'themeRoleSettings';

export interface NavRoleColors {
    surface: string;
    surfaceHover: string;
    active: string;
    activeText: string;
    text: string;
}

export interface ThemeRoleSettings {
    version?: number;
    mode?: 'preset' | 'custom' | 'legacy';
    roles?: {
        nav?: NavRoleColors;
        // Single base hex each — the 50-500 ramp is generated from it in the
        // learner app (theme-provider.tsx). Admin has no secondary-*/
        // tertiary-* tokens of its own (see this app's CLAUDE.md — they're a
        // learner-only extra), so this dialog only *saves* these values; it
        // never renders with them.
        secondary?: string;
        tertiary?: string;
        // Page canvas (--background), which is white in both apps by default.
        // Institutes with a light brand tint (cream, pale blue…) set it here.
        // Cards/sheets stay white so they keep reading as raised surfaces —
        // this only repaints the canvas behind them. Applies to BOTH apps.
        // Expected to be a light tint: --foreground stays dark, so a dark
        // value would break text contrast (the picker warns about this).
        background?: string;
    };
}
