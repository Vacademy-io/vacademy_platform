"use client";

import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import convert from "color-convert";
import themeData from "@/constants/themes/theme.json";
import { HOLISTIC_INSTITUTE_ID } from "@/constants/urls";
import { getInstituteId } from "@/utils/study-library/get-list-from-stores/getPackageSessionId";

type ThemeContextType = {
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
  getPrimaryColorCode: () => string;
};

const ThemeContext = createContext<ThemeContextType>({
  primaryColor: import.meta.env.VITE_DEFAULT_THEME_COLOR ?? "neutral",
  setPrimaryColor: () => {},
  getPrimaryColorCode: () => "#6B7280",
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [primaryColor, setPrimaryColor] = useState(
    import.meta.env.VITE_DEFAULT_THEME_COLOR ?? "neutral"
  );

  const getPrimaryColorCode = () => {
    const entry = themeData.themes.find((theme) => theme.code === primaryColor) as
      | { colors?: { primary?: Record<"500", string> } }
      | undefined;
    const hex = entry?.colors?.primary?.["500"];
    return hex || "#6B7280";
  };

  // Apply CSS variables when primary color changes
  useEffect(() => {
    // Find the theme in our JSON data by code
    const theme = themeData.themes.find((t) => t.code === primaryColor);

    if (theme && theme.colors) {
      // If we found the theme in our JSON, use those exact colors as HSL values
      const setHSLFromHex = (cssVar: string, hexColor: string) => {
        try {
          const [h, s, l] = convert.hex.hsl(hexColor.replace("#", ""));
          document.documentElement.style.setProperty(
            cssVar,
            `${h} ${s}% ${l}%`
          );
        } catch (error) {
          console.error(
            `Error converting color ${hexColor} for ${cssVar}:`,
            error
          );
        }
      };

      // Support both nested (primary.{50..500}) and flat ("primary-50") shapes
      type Shade = "50" | "100" | "200" | "300" | "400" | "500";
      type Palette = Record<Shade, string>;
      type NestedColors = {
        primary: Palette;
        secondary?: Palette;
        tertiary?: Palette;
      };
      type FlatColors = Record<`${"primary" | "secondary" | "tertiary"}-${Shade}`, string>;
      type ThemeColors = NestedColors | FlatColors;

      const isRecord = (value: unknown): value is Record<string, unknown> =>
        value !== null && typeof value === "object";

      const isNestedColors = (value: unknown): value is NestedColors => {
        if (!isRecord(value)) return false;
        const p = (value as Record<string, unknown>)["primary"];
        if (!isRecord(p)) return false;
        return typeof (p as Record<string, unknown>)["500"] === "string";
      };

      const getColorHex = (
        category: "primary" | "secondary" | "tertiary",
        shade: Shade
      ): string | undefined => {
        const colors: ThemeColors = theme.colors as unknown as ThemeColors;
        if (isNestedColors(colors)) {
          const palette = colors[category];
          return palette ? palette[shade] : undefined;
        }
        const key = `${category}-${shade}` as const;
        return (colors as FlatColors)[key];
      };

      const shades: Array<"50" | "100" | "200" | "300" | "400" | "500"> = [
        "50",
        "100",
        "200",
        "300",
        "400",
        "500",
      ];

      // Primary palette
      const primary500 = getColorHex("primary", "500");
      if (primary500) {
        setHSLFromHex("--primary", primary500);
      }
      shades.forEach((shade) => {
        const hex = getColorHex("primary", shade);
        if (hex) setHSLFromHex(`--primary-${shade}`, hex);
      });

      // Set primary foreground based on the brightness of primary-500
      const [, , l] = convert.hex.hsl((primary500 || "#000000").replace("#", ""));
      document.documentElement.style.setProperty(
        "--primary-foreground",
        l > 60 ? "222.2 47.4% 11.2%" : "210 40% 98%"
      );

      // Secondary palette (for vibrant accents)
      shades.forEach((shade) => {
        const hex = getColorHex("secondary", shade);
        if (hex) setHSLFromHex(`--secondary-${shade}`, hex);
      });

      // Tertiary palette (for vibrant accents)
      shades.forEach((shade) => {
        const hex = getColorHex("tertiary", shade);
        if (hex) setHSLFromHex(`--tertiary-${shade}`, hex);
      });

      // Store the theme selection
      localStorage.setItem("theme-code", primaryColor);
    } else if (primaryColor.startsWith("#")) {
      // Handle custom hex colors (for color picker)
      const [h, s, l] = convert.hex.hsl(primaryColor.replace("#", ""));

      // Set primary color variable in HSL format
      document.documentElement.style.setProperty(
        "--primary",
        `${h} ${s}% ${l}%`
      );
      document.documentElement.style.setProperty(
        "--primary-500",
        `${h} ${s}% ${l}%`
      );

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

      // Store the custom color
      localStorage.setItem("theme-custom-color", primaryColor);
      localStorage.removeItem("theme-code");
    }
  }, [primaryColor]);

  useEffect(() => {
    const initializeTheme = async () => {
      const instituteId = await getInstituteId();
      // Check if institute ID matches and set holistic theme
      if (instituteId === HOLISTIC_INSTITUTE_ID) {
        setPrimaryColor("holistic");
        return;
      }
      const savedThemeCode = localStorage.getItem("theme-code");
      const savedCustomColor = localStorage.getItem("theme-custom-color");

      if (savedThemeCode) {
        setPrimaryColor(savedThemeCode);
      } else if (savedCustomColor) {
        setPrimaryColor(savedCustomColor);
      }
    };

    initializeTheme();
  }, []);

  return (
    <ThemeContext.Provider
      value={{ primaryColor, setPrimaryColor, getPrimaryColorCode }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
