import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "light",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

/**
 * Mode provider PINNED TO LIGHT (2026-06-11): dark-mode fidelity is not
 * ready across the redesigned surfaces (play/vibrant are light-first), so
 * the toggle was removed and this provider forces light — including
 * rescuing users whose stored preference says "dark" from before.
 * When a dark-fidelity pass lands, restore the real implementation
 * (persist light/dark/system + apply the resolved class + follow OS
 * changes in system mode) and re-add the UserMenu toggle.
 */
export function ThemeProvider({
  children,
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add("light");
    try {
      localStorage.setItem(storageKey, "light");
    } catch {
      // Storage unavailable — the class is applied either way.
    }
  }, [storageKey]);

  const value = {
    theme,
    setTheme: (nextTheme: Theme) => {
      void nextTheme;
      try {
        localStorage.setItem(storageKey, "light");
      } catch {
        // Storage unavailable — stay light.
      }
      setThemeState("light");
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
