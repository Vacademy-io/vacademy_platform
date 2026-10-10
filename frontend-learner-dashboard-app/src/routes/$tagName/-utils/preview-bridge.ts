/**
 * The page editor's "Website" view frames this site with ?preview=true and
 * drives it over postMessage (CourseCataloguePage). These helpers keep that
 * channel to the real parent frame, so a page that merely opens the site in a
 * window of its own cannot paint a made-up site onto the institute's domain.
 *
 *   editor → site  CATALOGUE_CONFIG_UPDATE {payload, previewPath?},
 *                  HIGHLIGHT_COMPONENT {componentId}, PREVIEW_INTERACT {on}
 *   site → editor  PREVIEW_READY, COMPONENT_SELECTED {componentId, pageId, parentId?},
 *                  PREVIEW_NAVIGATE {route}
 */
import { RouteMatcher } from "../-services/route-matcher";

/** Admin dashboard origins allowed to drive the preview, comma separated.
 *  Unset = any parent frame, so a white-label admin domain keeps working
 *  until it is listed. */
export const parseAdminOrigins = (raw: unknown): string[] =>
  typeof raw === "string"
    ? raw
        .split(",")
        .map((origin) => origin.trim().replace(/\/+$/, ""))
        .filter(Boolean)
    : [];

export const PREVIEW_ADMIN_ORIGINS = parseAdminOrigins(import.meta.env.VITE_PREVIEW_ADMIN_ORIGINS);

type FrameWindow = Pick<Window, "parent">;

/** True when this document is inside another one (the editor's iframe). */
export const isFramed = (win: FrameWindow = window): boolean => win.parent !== win;

/** A message the site should obey: sent by the frame that embeds it, from an
 *  allowed admin origin. Anything else (another window, a sibling frame, an
 *  unlisted origin) is ignored. */
export const isEditorMessage = (
  event: Pick<MessageEvent, "source" | "origin">,
  win: FrameWindow = window,
  allowedOrigins: string[] = PREVIEW_ADMIN_ORIGINS,
): boolean =>
  isFramed(win) &&
  event.source === win.parent &&
  (allowedOrigins.length === 0 || allowedOrigins.includes(event.origin));

/** Where PREVIEW_READY may go before the editor has spoken: each listed
 *  origin (postMessage drops the ones that do not match), or any. */
export const readyTargets = (allowedOrigins: string[] = PREVIEW_ADMIN_ORIGINS): string[] =>
  allowedOrigins.length ? allowedOrigins : ["*"];

/** The page route a link inside the site points at ("" = home), or null when
 *  it leaves the site (another host, mailto:, tel:). */
export const previewRouteFromHref = (
  href: string,
  base: { origin: string; tagName: string },
): string | null => {
  let url: URL;
  try {
    url = new URL(href, base.origin);
  } catch {
    return null;
  }
  if (url.origin !== base.origin) return null;
  return RouteMatcher.segmentsAfterBase(url.pathname, base.tagName)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join("/");
};

/** Same page, whatever the trailing slash ("/acme" and "/acme/"). */
export const isSamePath = (a: string, b: string): boolean => a.replace(/\/+$/, "") === b.replace(/\/+$/, "");

/** "heroSection" → "Hero section": a readable name for a hidden block. */
export const blockTypeLabel = (type: unknown): string => {
  const words = String(type || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "";
};
