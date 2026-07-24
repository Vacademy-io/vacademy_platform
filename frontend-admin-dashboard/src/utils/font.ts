const SYSTEM_TAIL =
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';

const wrap = (family: string) =>
    family.includes(' ') && !family.startsWith('"') ? `"${family}"` : family;

// Curated families loaded via the Google Fonts <link>s in index.html.
const CURATED: Record<string, string> = {
    INTER: 'Inter',
    'PLUS JAKARTA SANS': 'Plus Jakarta Sans',
    LEXEND: 'Lexend',
    'WORK SANS': 'Work Sans',
    'OPEN SANS': 'Open Sans',
    CAIRO: 'Cairo',
    'PLAYPEN SANS': 'Playpen Sans',
};

/**
 * Maps an institute's configured font to a full CSS stack. Known curated keys
 * expand to a stack with a system fallback tail; anything else is treated as a
 * literal family and gets the same tail. Mirrors the learner app's
 * resolveFontStack (utils/branding.ts) so a saved THEME_SETTING.roles.fontFamily
 * renders the same in both apps.
 */
export function resolveFontStack(font?: string | null): string | null {
    if (!font) return null;
    const key = String(font).trim();
    const family = CURATED[key.toUpperCase()];
    if (family) return `${wrap(family)}, ${SYSTEM_TAIL}`;
    // Unknown value: treat as a literal family, still give it a fallback tail.
    return `${wrap(key)}, ${SYSTEM_TAIL}`;
}
