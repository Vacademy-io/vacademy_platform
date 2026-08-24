/**
 * Turning the branding on a verification response into something renderable.
 *
 * <p>These values come from institute rows that predate any validation, so the
 * verification page — which strangers open to decide whether a document is
 * genuine — has to survive whatever is in them. A theme stored as `ED7424`, a
 * website stored without a scheme, or a colour someone typed as "orange" must
 * all end in a page that renders, because a page that looks broken reads as
 * "this certificate is suspect".
 */

/**
 * `#RRGGBB` if the value is a usable colour, otherwise null so the caller falls
 * back to its own tokens.
 *
 * <p>Anything unrecognisable is dropped rather than passed through: an
 * unparseable value in a `background-color` silently paints nothing, which
 * looks like a bug rather than an unbranded institute.
 */
export function normalizeThemeColor(raw: string | null | undefined): string | null {
  const value = (raw || "").trim();
  if (!value) return null;
  const hex = value.startsWith("#") ? value : `#${value}`;
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex) ? hex : null;
}

/** A website stored as "edustream.ae" still has to be a working link. */
export const ensureHttp = (url: string): string =>
  /^https?:\/\//i.test(url) ? url : `https://${url}`;

/** What to print for it: the host, without scheme noise or a trailing slash. */
export const displayHost = (url: string): string =>
  url.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
