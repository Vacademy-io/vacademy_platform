import themeData from '@/constants/themes/theme.json';

/**
 * Brand presets offered in the theme picker, in grid order. Codes must exist
 * in BOTH apps' theme.json — the learner resolves the same `institute_theme_code`
 * against its own copy, and an unknown code there silently leaves the learner
 * on its default. `holistic` is intentionally absent: it's institute-specific
 * and applied by ID, not chosen.
 */
export const PRESET_THEMES: Array<{ name: string; code: string }> = [
    { name: 'Orange', code: 'primary' },
    { name: 'Blue', code: 'blue' },
    { name: 'Green', code: 'green' },
    { name: 'Purple', code: 'purple' },
    { name: 'Red', code: 'red' },
    { name: 'Pink', code: 'pink' },
    { name: 'Indigo', code: 'indigo' },
    { name: 'Yellow', code: 'amber' },
    { name: 'Cyan', code: 'cyan' },
    { name: 'Teal', code: 'teal' },
    { name: 'Lime', code: 'lime' },
    { name: 'Violet', code: 'violet' },
    { name: 'Maroon', code: 'maroon' },
    { name: 'Navy', code: 'navy' },
    { name: 'Brown', code: 'brown' },
    { name: 'Slate', code: 'slate' },
    { name: 'Charcoal', code: 'charcoal' },
];

/** Sentinel used by the picker for "not a preset — an institute-chosen hex". */
export const CUSTOM_THEME_ID = 'custom';

/** Dark→light swatch strip for a preset tile. */
export const getThemeShades = (code: string): string[] => {
    const theme = themeData.themes.find((t) => t.code === code);
    if (!theme?.colors) return [];
    return Object.values(theme.colors as Record<string, string>);
};

/** A saved `institute_theme_code` is either a preset code or a raw hex. */
export const isCustomThemeCode = (code: string | undefined | null): boolean =>
    !!code && code.startsWith('#');
