'use client';

import type React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import convert from 'color-convert';
import themeData from '@/constants/themes/theme.json';
import { getInstituteId } from '@/constants/helper';
import { HOLISTIC_INSTITUTE_ID } from '@/constants/urls';
import {
    THEME_ROLE_SETTINGS_KEY,
    type NavRoleColors,
    type ThemeRoleSettings,
} from '@/types/theme-role-settings';
import { rampFromHsl, hslVar, SHADES } from '@/lib/theme-ramp';
import { resolveFontStack } from '@/utils/font';

// Institute-authored page background (THEME_SETTING `background` role).
// Repaints the canvas only — --card stays white, so cards keep reading as
// raised surfaces on a tinted page. Mirrors the learner app's
// applyBackgroundRole so one saved setting themes both.
const applyBackgroundRole = () => {
    let background: string | undefined;
    try {
        const raw = localStorage.getItem(THEME_ROLE_SETTINGS_KEY);
        const parsed: ThemeRoleSettings | null = raw ? JSON.parse(raw) : null;
        background = parsed?.roles?.background;
    } catch {
        background = undefined;
    }

    const root = document.documentElement;
    if (!background) {
        // No override (or it was cleared): drop any inline value so the
        // stylesheet default (white) applies again.
        root.style.removeProperty('--background');
        return;
    }

    try {
        const [h, s, l] = convert.hex.hsl(background.replace('#', ''));
        root.style.setProperty('--background', hslVar([h, s, l]));
    } catch {
        // ignore malformed institute-authored hex
    }
};

// Institute-authored font (THEME_SETTING `fontFamily` role) -> --app-font-family.
// Curated key resolved via the shared resolveFontStack. No-op when unset, so
// the app keeps its bundled default for non-configured institutes.
const applyInstituteFont = () => {
    let fontFamily: string | undefined;
    try {
        const raw = localStorage.getItem(THEME_ROLE_SETTINGS_KEY);
        const parsed: ThemeRoleSettings | null = raw ? JSON.parse(raw) : null;
        fontFamily = parsed?.roles?.fontFamily;
    } catch {
        fontFamily = undefined;
    }
    if (!fontFamily) return;
    const stack = resolveFontStack(fontFamily);
    if (!stack) return;
    document.documentElement.style.setProperty('--app-font-family', stack);
    document.body.style.fontFamily = stack;
};

// Applies the `nav` role (rail surface, hover, active, active-text, text)
// from institute settings if one has been saved (THEME_SETTING). With no
// override, the default REPRODUCES the admin CategoryRail's current
// hardcoded look — a solid primary-500 rail with a white active-category
// pill and a neutral-900 icon on it (see category-rail.tsx) — NOT the
// learner app's white-sidebar default. The two apps have genuinely
// different current looks, so each has its own no-op default; an explicit
// institute-authored nav role is what unifies them once someone opts in.
const applyNavRoles = (h: number, s: number, l: number) => {
    const setHSL = (cssVar: string, hue: number, sat: number, light: number) => {
        const wrap = (deg: number) => ((deg % 360) + 360) % 360;
        document.documentElement.style.setProperty(cssVar, `${wrap(hue)} ${sat}% ${light}%`);
    };

    let nav: NavRoleColors | undefined;
    try {
        const raw = localStorage.getItem(THEME_ROLE_SETTINGS_KEY);
        const parsed: ThemeRoleSettings | null = raw ? JSON.parse(raw) : null;
        nav = parsed?.roles?.nav;
    } catch {
        nav = undefined;
    }

    if (nav) {
        const setFromHex = (cssVar: string, hex: string) => {
            try {
                const [hh, ss, ll] = convert.hex.hsl(hex.replace('#', ''));
                setHSL(cssVar, hh, ss, ll);
            } catch {
                // ignore malformed institute-authored hex
            }
        };
        setFromHex('--nav-surface', nav.surface);
        setFromHex('--nav-surface-hover', nav.surfaceHover);
        setFromHex('--nav-active', nav.active);
        setFromHex('--nav-active-text', nav.activeText);
        setFromHex('--nav-text', nav.text);
        return;
    }

    // Legacy default: solid primary-500 rail (today's bg-primary-500), white
    // active-category pill, neutral-900 icon on that pill (Tailwind's default
    // neutral-900 converts to hsl(0, 0%, 9%)).
    setHSL('--nav-surface', h, s, l); // == primary-500
    setHSL('--nav-surface-hover', h, s, Math.max(l - 6, 0)); // slightly darker, nothing consumes this yet
    setHSL('--nav-active', 0, 0, 100); // == white
    setHSL('--nav-active-text', 0, 0, 9); // == neutral-900
    setHSL('--nav-text', 0, 0, 100); // white — today's inactive rail label is white/70
};

type ThemeContextType = {
    primaryColor: string;
    setPrimaryColor: (color: string) => void;
    getPrimaryColorCode: () => string;
};

const ThemeContext = createContext<ThemeContextType>({
    primaryColor: 'primary', // Store the theme code instead of hex
    setPrimaryColor: () => {},
    getPrimaryColorCode: () => '#ED7424',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [primaryColor, setPrimaryColor] = useState(() => {
        try {
            const saved = typeof window !== 'undefined' ? localStorage.getItem('theme-code') : null;
            return saved || 'primary';
        } catch {
            return 'primary';
        }
    }); // Default theme code

    const getPrimaryColorCode = () => {
        return (
            themeData.themes.find((theme) => theme.code === primaryColor)?.colors['primary-500'] ||
            '#ED7424'
        );
    };
    // Apply CSS variables when primary color changes
    useEffect(() => {
        // Find the theme in our JSON data by code
        const theme = themeData.themes.find((t) => t.code === primaryColor);

        if (theme && theme.colors) {
            // If we found the theme in our JSON, use those exact colors as HSL values
            const setHSLFromHex = (cssVar: string, hexColor: string) => {
                try {
                    const [h, s, l] = convert.hex.hsl(hexColor.replace('#', ''));
                    document.documentElement.style.setProperty(cssVar, `${h} ${s}% ${l}%`);
                } catch (error) {
                    console.error(`Error converting color ${hexColor} for ${cssVar}:`, error);
                }
            };

            // Set all the color variables using our JSON theme data
            setHSLFromHex('--primary', theme.colors['primary-500']);
            setHSLFromHex('--primary-50', theme.colors['primary-50']);
            setHSLFromHex('--primary-100', theme.colors['primary-100']);
            setHSLFromHex('--primary-200', theme.colors['primary-200']);
            setHSLFromHex('--primary-300', theme.colors['primary-300']);
            setHSLFromHex('--primary-400', theme.colors['primary-400']);
            setHSLFromHex('--primary-500', theme.colors['primary-500']);

            // Set primary foreground based on the brightness of primary-500
            const [ph, ps, pl] = convert.hex.hsl(theme.colors['primary-500'].replace('#', ''));
            document.documentElement.style.setProperty(
                '--primary-foreground',
                pl > 60 ? '222.2 47.4% 11.2%' : '210 40% 98%'
            );

            // Nav role (sidebar/rail) — explicit institute override or derived default.
            applyNavRoles(ph, ps, pl);
            // Institute-authored page canvas, if any.
            applyBackgroundRole();
            applyInstituteFont();

            // Store the theme selection
            localStorage.setItem('theme-code', primaryColor);
        } else if (primaryColor.startsWith('#')) {
            // Custom institute brand hex (color picker). Same tint curve as
            // the presets — see lib/theme-ramp.ts for why this isn't the old
            // saturation-raising formula (dark/saturated brands went neon,
            // greys went pink).
            const [h, s, l] = convert.hex.hsl(primaryColor.replace('#', ''));
            const ramp = rampFromHsl(h, s, l);

            document.documentElement.style.setProperty('--primary', hslVar(ramp['500']));
            SHADES.forEach((shade) => {
                document.documentElement.style.setProperty(
                    `--primary-${shade}`,
                    hslVar(ramp[shade])
                );
            });

            // Set primary foreground (text on primary background)
            document.documentElement.style.setProperty(
                '--primary-foreground',
                l > 60 ? '222.2 47.4% 11.2%' : '210 40% 98%'
            );

            // Nav role (sidebar/rail) — explicit institute override or derived default.
            applyNavRoles(h, s, l);
            applyBackgroundRole();
            applyInstituteFont();

            // Store the custom color
            localStorage.setItem('theme-custom-color', primaryColor);
            localStorage.removeItem('theme-code');
        }
    }, [primaryColor]);

    // Initialize theme from localStorage if available
    useEffect(() => {
        const instituteId = getInstituteId();

        // Check if institute ID matches and set holistic theme
        if (instituteId === HOLISTIC_INSTITUTE_ID) {
            setPrimaryColor('holistic');
            return;
        }

        // Only check localStorage if not the specific institute
        const savedThemeCode = localStorage.getItem('theme-code');
        const savedCustomColor = localStorage.getItem('theme-custom-color');

        if (savedThemeCode) {
            setPrimaryColor(savedThemeCode);
        } else if (savedCustomColor) {
            setPrimaryColor(savedCustomColor);
        }
    }, [primaryColor]);

    return (
        <ThemeContext.Provider value={{ primaryColor, setPrimaryColor, getPrimaryColorCode }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
