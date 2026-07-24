import convert from 'color-convert';
import navPresetData from './nav-presets.json';
import type { NavRoleColors } from '@/types/theme-role-settings';

const hexFromHsl = (h: number, s: number, l: number): string => {
    const wrap = (deg: number) => ((deg % 360) + 360) % 360;
    return `#${convert.hsl.hex([wrap(h), s, l])}`;
};

export interface NavPresetOption {
    id: string;
    label: string;
    description: string;
    /** null = no override — institute keeps today's light, primary-tinted sidebar. */
    build: (brandHex: string) => NavRoleColors | null;
}

type FixedNavPresetData = {
    id: string;
    label: string;
    description: string;
    kind: 'match-brand' | 'fixed' | 'brand-tinted' | 'brand-tinted-light';
    colors?: { surface: string; surfaceHover: string; activeText: string; text: string };
    activeText?: string;
};

export const navPresets: NavPresetOption[] = (navPresetData.presets as FixedNavPresetData[]).map(
    (preset) => ({
        id: preset.id,
        label: preset.label,
        description: preset.description,
        build: (brandHex: string): NavRoleColors | null => {
            if (preset.kind === 'match-brand') return null;
            if (preset.kind === 'fixed' && preset.colors) {
                return { ...preset.colors, active: brandHex };
            }
            if (preset.kind === 'brand-tinted') {
                const [h, s] = convert.hex.hsl(brandHex.replace('#', ''));
                const navSat = Math.min(s * 0.35, 30);
                return {
                    surface: hexFromHsl(h, navSat, 14),
                    surfaceHover: hexFromHsl(h, navSat, 20),
                    active: brandHex,
                    activeText: preset.activeText ?? brandHex,
                    text: hexFromHsl(h, navSat * 0.6, 65),
                };
            }
            if (preset.kind === 'brand-tinted-light') {
                const [h, s, l] = convert.hex.hsl(brandHex.replace('#', ''));
                return {
                    surface: hexFromHsl(h, Math.min(s * 0.3, 25), 96),
                    surfaceHover: hexFromHsl(h, Math.min(s * 0.3, 25), 91),
                    active: brandHex,
                    activeText: preset.activeText ?? (l > 60 ? hexFromHsl(0, 0, 9) : hexFromHsl(0, 0, 100)),
                    text: hexFromHsl(h, Math.min(s * 0.2, 18), 30),
                };
            }
            return null;
        },
    })
);
