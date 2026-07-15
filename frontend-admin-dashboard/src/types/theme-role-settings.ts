// Role-based institute theme, stored under the THEME_SETTING key in the
// institute's settings JSON (see admin_core_service SettingKeyEnums).
// Only `nav` is defined so far — brand keeps flowing through the existing
// institute_theme_code / theme.json path unchanged.
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
    };
}
