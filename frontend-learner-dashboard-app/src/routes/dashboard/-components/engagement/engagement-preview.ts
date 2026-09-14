import DOMPurify from "dompurify";
import type { EngagementItem } from "@/services/engagement";

/**
 * Turn a task's authored HTML into a short plain-text glimpse for the dashboard.
 *
 * Sanitize first, then read textContent: parsing raw HTML into a detached element
 * without sanitizing would still run `onerror` handlers on any injected markup.
 */
export function excerptFromHtml(html: string | null | undefined, max = 160): string {
  if (!html) return "";
  try {
    const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
    const holder = document.createElement("div");
    holder.innerHTML = clean;
    const text = (holder.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text.length <= max) return text;
    // Cut on a word boundary so the glimpse does not end mid-word.
    return `${text.slice(0, max).replace(/\s+\S*$/, "")}…`;
  } catch {
    return "";
  }
}

/** The glimpse a task shows on the dashboard, before it is opened. */
export function glimpseFor(item: EngagementItem): string {
  if (item.itemType === "COURSE_SLIDE") return "";
  return excerptFromHtml(item.contentHtml, 160);
}
