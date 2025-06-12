'use client';

import type React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import convert from 'color-convert';
import themeData from '@/constants/themes/theme.json';

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
    const [primaryColor, setPrimaryColor] = useState('primary'); // Default theme code

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
            const [, , l] = convert.hex.hsl(theme.colors['primary-500'].replace('#', ''));
            document.documentElement.style.setProperty(
                '--primary-foreground',
                l > 60 ? '222.2 47.4% 11.2%' : '210 40% 98%'
            );

            // Store the theme selection
            localStorage.setItem('theme-code', primaryColor);
        } else if (primaryColor.startsWith('#')) {
            // Handle custom hex colors (for color picker)
            const [h, s, l] = convert.hex.hsl(primaryColor.replace('#', ''));

            // Set primary color variable in HSL format
            document.documentElement.style.setProperty('--primary', `${h} ${s}% ${l}%`);
            document.documentElement.style.setProperty('--primary-500', `${h} ${s}% ${l}%`);

            // Set primary foreground (text on primary background)
            document.documentElement.style.setProperty(
                '--primary-foreground',
                l > 60 ? '222.2 47.4% 11.2%' : '210 40% 98%'
            );

            // Set different shades of the primary color
            document.documentElement.style.setProperty(
                '--primary-50',
                `${h} ${Math.min(s + 40, 100)}% ${Math.min(l + 45, 96)}%`
            );
            document.documentElement.style.setProperty(
                '--primary-100',
                `${h} ${Math.min(s + 30, 90)}% ${Math.min(l + 38, 92)}%`
            );
            document.documentElement.style.setProperty(
                '--primary-200',
                `${h} ${Math.min(s + 20, 88)}% ${Math.min(l + 29, 83)}%`
            );
            document.documentElement.style.setProperty(
                '--primary-300',
                `${h} ${Math.min(s + 10, 87)}% ${Math.min(l + 18, 72)}%`
            );
            document.documentElement.style.setProperty(
                '--primary-400',
                `${h} ${Math.min(s + 5, 86)}% ${Math.min(l + 7, 61)}%`
            );

            // Store the custom color
            localStorage.setItem('theme-custom-color', primaryColor);
            localStorage.removeItem('theme-code');
        }
    }, [primaryColor]);

    // Initialize theme from localStorage if available
    useEffect(() => {
        const savedThemeCode = localStorage.getItem('theme-code');
        const savedCustomColor = localStorage.getItem('theme-custom-color');

        if (savedThemeCode) {
            setPrimaryColor(savedThemeCode);
        } else if (savedCustomColor) {
            setPrimaryColor(savedCustomColor);
        }
    }, []);

    return (
        <ThemeContext.Provider value={{ primaryColor, setPrimaryColor, getPrimaryColorCode }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
