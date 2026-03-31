import { useState, useEffect } from "react";

/**
 * Returns true when the "play" UI skin is active.
 * Listens for class changes on <html> via MutationObserver.
 */
export function usePlayTheme(): boolean {
  const [isPlay, setIsPlay] = useState(
    () => document.documentElement.classList.contains("ui-play")
  );

  useEffect(() => {
    const root = document.documentElement;

    const observer = new MutationObserver(() => {
      setIsPlay(root.classList.contains("ui-play"));
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Sync on mount in case it changed between render and effect
    setIsPlay(root.classList.contains("ui-play"));

    return () => observer.disconnect();
  }, []);

  return isPlay;
}
