import { useState, useEffect } from "react";

/**
 * Returns true when the "Cleaner Play" UI skin is active.
 * Listens for class changes on <html> via MutationObserver. Mirrors
 * use-play-theme.ts — kept as a separate hook (not a shared param) so
 * components can react to either skin independently.
 */
export function useCleanerPlayTheme(): boolean {
  const [isCleanerPlay, setIsCleanerPlay] = useState(
    () => document.documentElement.classList.contains("ui-cleaner-play")
  );

  useEffect(() => {
    const root = document.documentElement;

    const observer = new MutationObserver(() => {
      setIsCleanerPlay(root.classList.contains("ui-cleaner-play"));
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class"],
    });

    setIsCleanerPlay(root.classList.contains("ui-cleaner-play"));

    return () => observer.disconnect();
  }, []);

  return isCleanerPlay;
}
