import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeProviderProps {
    children: React.ReactNode;
    defaultTheme?: Theme;
    storageKey?: string;
}

const ThemeContext = createContext<{
    theme: Theme;
    setTheme: (t: Theme) => void;
}>({
    theme: 'dark',
    setTheme: () => null,
});

export function ThemeProvider({
    children,
    defaultTheme = 'dark',
    storageKey = 'vacademy-learner-theme',
}: ThemeProviderProps) {
    const [currentTheme, setCurrentTheme] = useState<Theme>(
        () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
    );

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
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within a ThemeProvider');
    return context;
}
