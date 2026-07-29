/**
 * Shared video-URL helpers for catalogue page-builder blocks.
 *
 * Extracted verbatim from MediaShowcaseComponent so the hero section (and any
 * future block) can accept the same range of pasted URLs instead of each
 * component re-implementing YouTube/Vimeo parsing. Pure functions, no imports.
 *
 * Accepted YouTube shapes: watch?v=, youtu.be/, /embed/, /v/, /live/.
 * Vimeo: vimeo.com/<id>, vimeo.com/video/<id>, player.vimeo.com/video/<id>.
 */

/** True when the URL points at YouTube (any of the accepted shapes). */
export const isYouTubeUrl = (url: string): boolean => {
  if (!url) return false;
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(url);
};

/** True when the URL points at Vimeo. */
export const isVimeoUrl = (url: string): boolean => {
  if (!url) return false;
  return /^(https?:\/\/)?(www\.)?(player\.)?vimeo\.com\/.+/.test(url);
};

/** Numeric Vimeo id, or null when the URL isn't a recognizable Vimeo link. */
export const extractVimeoVideoId = (url: string): string | null => {
  if (!url) return null;
  const match = url.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/);
  return match ? match[1] : null;
};

/** Player URL for an iframe. Returns the input untouched if no id is found. */
export const convertToVimeoEmbedUrl = (url: string): string => {
  const videoId = extractVimeoVideoId(url);
  if (!videoId) return url;
  return `https://player.vimeo.com/video/${videoId}?badge=0&autopause=0&player_id=0`;
};

/** 11-char YouTube id, or null when the URL isn't a recognizable YouTube link.
 *  `shorts/` matters: a Shorts link satisfies isYouTubeUrl, so without it here
 *  the URL passes through unconverted and the iframe loads a watch page, which
 *  YouTube refuses to embed. */
export const extractYouTubeVideoId = (url: string): string | null => {
  if (!url) return null;
  const regExp =
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|live\/|shorts\/))([a-zA-Z0-9_-]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
};

/**
 * Embed URL for an iframe, on the privacy-preserving nocookie host. Returns the
 * input untouched if no id is found, so a already-embed URL still works.
 */
export const convertToYouTubeEmbedUrl = (url: string): string => {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return url;

  const params = new URLSearchParams({
    modestbranding: '1',
    rel: '0',
    fs: '1',
    playsinline: '1',
  });

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
};

/** Rejects blanks and the page-builder's placeholder sentinel values. */
export const isValidVideoUrl = (url: string): boolean => {
  if (!url) return false;
  if (url.includes('/api/placeholder/')) return false;
  if (url.trim() === '') return false;
  if (url === 'null' || url === 'undefined') return false;
  return true;
};

/** True for a hosted/uploaded video file rather than a YouTube/Vimeo page. */
export const isDirectVideoFile = (url: string): boolean => {
  if (!url) return false;
  return /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i.test(url);
};
