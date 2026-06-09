import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useSlideContentProtection } from "@/hooks/useSlideContentProtection";

/**
 * Renders the slide content protection while a slide is open (per-institute,
 * per-role; bypassed with `?access=dev`). Two layers, both best-effort:
 *
 *  1. Block right-click and the view-source / DevTools key combos. Right-click
 *     and Ctrl+U are reliably blocked; F12 / Ctrl+Shift+I are NOT — browsers
 *     ignore preventDefault for those, by design.
 *  2. Because F12 can't be prevented, DETECT when DevTools is open (via the
 *     window size gap) and cover the slide with a reversible overlay. This runs
 *     on desktop web only — it is skipped in the native app, where the size gap
 *     would false-positive for normal users.
 *
 * None of this is a real security boundary; it is deterrence. True prevention
 * needs backend signed/streamed content.
 */
export function SlideProtectionGuard() {
  const { protectionEnabled } = useSlideContentProtection();
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);

  // Layer 1 — block context menu + view-source/DevTools shortcuts.
  useEffect(() => {
    if (!protectionEnabled) return;
    const blockContextMenu = (e: MouseEvent) => e.preventDefault();
    const blockKeys = (e: KeyboardEvent) => {
      const key = e.key;
      const isF12 = key === "F12";
      const isViewSource = (e.ctrlKey || e.metaKey) && (key === "u" || key === "U");
      const isDevTools =
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        ["i", "I", "j", "J", "c", "C"].includes(key);
      if (isF12 || isViewSource || isDevTools) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("keydown", blockKeys, true);
    return () => {
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("keydown", blockKeys, true);
    };
  }, [protectionEnabled]);

  // Layer 2 — desktop-web-only DevTools detection via the window size gap.
  useEffect(() => {
    if (!protectionEnabled || Capacitor.isNativePlatform()) {
      setDevtoolsOpen(false);
      return;
    }
    const THRESHOLD = 170;
    const check = () => {
      const gap = Math.max(
        window.outerWidth - window.innerWidth,
        window.outerHeight - window.innerHeight
      );
      setDevtoolsOpen(gap > THRESHOLD);
    };
    check();
    const intervalId = window.setInterval(check, 1000);
    window.addEventListener("resize", check);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("resize", check);
    };
  }, [protectionEnabled]);

  if (!protectionEnabled || !devtoolsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white p-6 text-center">
      <div className="max-w-md space-y-2">
        <p className="text-lg font-semibold text-neutral-800">Content hidden</p>
        <p className="text-sm text-neutral-600">
          Please close developer tools to continue viewing this slide.
        </p>
      </div>
    </div>
  );
}
