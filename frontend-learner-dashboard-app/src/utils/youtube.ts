/**
 * YouTube URL helpers shared by the live-class embed players.
 *
 * Handles every common share form:
 *   https://www.youtube.com/watch?v=<id>            (plus extra query params)
 *   https://youtu.be/<id>?si=...                    (mobile/share links)
 *   https://www.youtube.com/shorts/<id>
 *   https://www.youtube.com/live/<id>
 *   https://www.youtube.com/embed/<id> , /v/<id>
 */
const YOUTUBE_ID_REGEX =
  /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|live\/|shorts\/))([a-zA-Z0-9_-]{11})/;

export const extractYouTubeVideoId = (
  url: string | null | undefined
): string | null => {
  if (!url) return null;
  const match = url.match(YOUTUBE_ID_REGEX);
  return match ? match[1] : null;
};

/**
 * True when the link is a playable YouTube URL. Used to embed YouTube links
 * even when the session's declared link_type is "other" — admins paste
 * youtu.be/shorts links with the platform dropdown left untouched, and
 * YouTube always iframes cleanly, so URL detection beats the declared type.
 */
export const isYouTubeUrl = (url: string | null | undefined): boolean =>
  extractYouTubeVideoId(url) !== null;
