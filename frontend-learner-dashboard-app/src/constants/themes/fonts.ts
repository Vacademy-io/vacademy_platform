/**
 * Curated institute font set — the families the apps actually load (see the
 * Google Fonts <link>s in each app's index.html). Keys match resolveFontStack
 * (utils/font.ts here, utils/branding.ts in the learner app) so a saved
 * `THEME_SETTING.roles.fontFamily` renders identically everywhere.
 *
 * Deliberately curated rather than free-text: only fonts with a loaded
 * @font-face render, so the picker can't pick something that silently falls
 * back to the system default.
 */
export interface FontChoice {
    /** Stored value + resolveFontStack key. */
    key: string;
    /** Human label in the picker. */
    label: string;
    /** A representative CSS family for the picker's own preview text. */
    previewFamily: string;
    note?: string;
}

export const FONT_CHOICES: FontChoice[] = [
    {
        key: 'Plus Jakarta Sans',
        label: 'Plus Jakarta Sans',
        previewFamily: "'Plus Jakarta Sans', sans-serif",
        note: 'Learner app default',
    },
    { key: 'Inter', label: 'Inter', previewFamily: 'Inter, sans-serif', note: 'Admin default' },
    { key: 'Lexend', label: 'Lexend', previewFamily: 'Lexend, sans-serif' },
    { key: 'Work Sans', label: 'Work Sans', previewFamily: "'Work Sans', sans-serif" },
    { key: 'Open Sans', label: 'Open Sans', previewFamily: "'Open Sans', sans-serif" },
    { key: 'Cairo', label: 'Cairo', previewFamily: 'Cairo, sans-serif', note: 'Good for Arabic' },
    {
        key: 'Playpen Sans',
        label: 'Playpen Sans',
        previewFamily: "'Playpen Sans', cursive",
        note: 'Playful / handwritten',
    },
];

/** The value a picker shows when no institute font override is set. */
export const DEFAULT_FONT_KEY = 'Plus Jakarta Sans';
