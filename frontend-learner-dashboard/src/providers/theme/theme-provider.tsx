"use client";

import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import convert from "color-convert";

type ThemeContextType = {
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  primaryColor: "#E67E22",
  setPrimaryColor: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [primaryColor, setPrimaryColor] = useState("#E67E22");

  // Apply CSS variables when primary color changes
  useEffect(() => {
    // Get HSL values
    const [h, s, l] = convert.hex.hsl(primaryColor);

    // Set primary color variable in HSL format
    document.documentElement.style.setProperty("--primary", `${h} ${s}% ${l}%`);

    // Set primary foreground (text on primary background)
    document.documentElement.style.setProperty(
      "--primary-foreground",
      l > 60 ? "222.2 47.4% 11.2%" : "210 40% 98%"
    );

    // Set different shades of the primary color
    document.documentElement.style.setProperty(
      "--primary-50",
      `${h} ${Math.min(s + 40, 100)}% ${Math.min(l + 45, 96)}%`
    );
    document.documentElement.style.setProperty(
      "--primary-100",
      `${h} ${Math.min(s + 30, 90)}% ${Math.min(l + 38, 92)}%`
    );
    document.documentElement.style.setProperty(
      "--primary-200",
      `${h} ${Math.min(s + 20, 88)}% ${Math.min(l + 29, 83)}%`
    );
    document.documentElement.style.setProperty(
      "--primary-300",
      `${h} ${Math.min(s + 10, 87)}% ${Math.min(l + 18, 72)}%`
    );
    document.documentElement.style.setProperty(
      "--primary-400",
      `${h} ${Math.min(s + 5, 86)}% ${Math.min(l + 7, 61)}%`
    );
    document.documentElement.style.setProperty(
      "--primary-500",
      `${h} ${s}% ${l}%`
    );

    // For secondary, we can use a complementary color (180° away on the color wheel)
    const hSecondary = (h + 180) % 360;
    document.documentElement.style.setProperty(
      "--secondary",
      `${hSecondary} ${s}% ${l}%`
    );
    document.documentElement.style.setProperty(
      "--secondary-foreground",
      l > 60 ? "222.2 47.4% 11.2%" : "210 40% 98%"
    );
  }, [primaryColor]);

  return (
    <ThemeContext.Provider value={{ primaryColor, setPrimaryColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
