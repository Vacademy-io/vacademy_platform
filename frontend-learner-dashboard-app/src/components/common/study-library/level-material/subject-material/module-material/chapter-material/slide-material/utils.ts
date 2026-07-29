// export const getEpochTimeInMillis = (): number => {
//     return new Date().getTime(); // Returns epoch time in milliseconds
// };

import clsx, { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export interface CodeExecutionResult {
  output: string;
  needsInput: boolean;
  hasError?: boolean;
}

export const getEpochTimeInMillis = (): number => {
  return Date.now();
};

export const getISTTimeISO = () => {
  return new Date(new Date().getTime() + 330 * 60000).toISOString();
};

export const getISTTime = () => {
  return new Date().toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
  });
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * HTMLMediaElement.play() returns a promise that REJECTS whenever the request is
 * interrupted before playback starts — the element gets removed from the DOM
 * (slide switch, a course-init refetch re-rendering the player, a `key` swap on
 * the media element, cleanup blanking `src`), or pause() lands first (question
 * overlays, concentration checks). Nothing is broken for the learner, but a bare
 * `el.play()` leaves that rejection un-awaited, so it surfaces as an unhandled
 * promise rejection and Sentry logs it as a crash. Swallow the interruption and
 * autoplay-policy cases; genuine decode/source failures still reach the media
 * element's own onError handler.
 */
export function safePlay(el: HTMLMediaElement | null | undefined) {
  if (!el) return;
  const played = el.play();
  if (!played || typeof played.catch !== "function") return;
  played.catch((err: unknown) => {
    const name = (err as { name?: string } | null)?.name;
    // AbortError is pure noise — the request was cancelled because the element
    // was removed or paused, and there is nothing to act on. Everything else
    // (notably NotAllowedError from the autoplay policy) stays visible in the
    // console for debugging, just never as an unhandled rejection.
    if (name === "AbortError") return;
    console.warn("Media play() was rejected:", err);
  });
}

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return (
    Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
  );
}
