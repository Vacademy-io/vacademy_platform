import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeProviderProps {
    children: React.ReactNode;
    defaultTheme?: Theme;
    storageKey?: string;
}

interface ThemeContextValue {
    theme: Theme;
    setTheme: (value: Theme) => void;
}

const INITIAL_CONTEXT: ThemeContextValue = {
    theme: 'dark',
    setTheme: () => undefined,
};

const ThemeContext = createContext(INITIAL_CONTEXT);

export function ThemeProvider({
    children,
    defaultTheme = 'dark',
    storageKey = 'vacademy-learner-theme',
}: ThemeProviderProps) {
    const [currentTheme, setCurrentTheme] = useState<Theme>(() => {
        const stored = localStorage.getItem(storageKey);
        if (stored === 'dark' || stored === 'light' || stored === 'system') {
            return stored;
        }
        return defaultTheme;
    });

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');

        if (currentTheme === 'system') {
            const resolved = window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light';
            root.classList.add(resolved);
        } else {
            root.classList.add(currentTheme);
        }
    }, [currentTheme]);

    return (
        <ThemeContext.Provider
            value={{
                theme: currentTheme,
                setTheme: (newTheme: Theme) => {
                    localStorage.setItem(storageKey, newTheme);
                    setCurrentTheme(newTheme);
                },
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
