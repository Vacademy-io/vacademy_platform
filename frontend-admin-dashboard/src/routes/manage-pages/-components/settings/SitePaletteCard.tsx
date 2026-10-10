import type { FC } from 'react';

/** globalSettings.theme as stored: hand- or AI-written JSON. */
type Theme = Record<string, unknown>;

export interface SitePaletteCardProps {
    /** globalSettings.theme; it has a `palette` object (the card is only mounted then). */
    theme: Theme;
    /** Replaces globalSettings.theme with `next`; spread `theme` to keep its other keys. */
    onThemeChange: (next: Theme) => void;
}

/**
 * The site's own colour palette (theme.palette) and content width
 * (theme.contentMaxWidth). PropertyPanel mounts it in Global Settings only
 * when theme.palette exists; filled in by a later change.
 */
export const SitePaletteCard: FC<SitePaletteCardProps> = () => null;
