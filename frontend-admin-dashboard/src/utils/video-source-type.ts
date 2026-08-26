/**
 * Resolves which player a VIDEO slide should use.
 *
 * `video_slide.source_type` is the intended source of truth, but it is nullable
 * in admin_core_service and the backend persists whatever the client sends
 * without inferring it from the URL. Bulk imports that omit the field therefore
 * leave Vimeo-backed slides with a blank source_type, and a blank value used to
 * fall through to the YouTube player — which cannot parse a Vimeo link, so the
 * preview showed an empty frame that never played.
 *
 * Sniffing the URL as a fallback keeps those rows playable without depending on
 * a data backfill, and stops a future copy/import from reintroducing the same
 * blank player.
 *
 * The stored value tells us the host unambiguously: linked videos hold a full
 * URL, while S3-uploaded ones hold a bare media-service file id (a UUID with no
 * scheme). Those two shapes never overlap in practice.
 */

export type ResolvedVideoSourceType = 'VIMEO' | 'FILE_ID' | 'YOUTUBE';

/** Matches vimeo.com/<id>, vimeo.com/video/<id> and player.vimeo.com/video/<id>. */
const VIMEO_URL_PATTERN = /(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/;

/** A bare media-service file id — never a link, so it can only be an upload. */
const FILE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type VideoSlideLike =
    | {
          source_type?: string | null;
          url?: string | null;
          published_url?: string | null;
      }
    | null
    | undefined;

const videoUrlOf = (videoSlide: VideoSlideLike): string =>
    videoSlide?.published_url || videoSlide?.url || '';

/** Numeric Vimeo id from a slide's URL, or '' when it isn't a Vimeo link. */
export const extractVimeoId = (url: string): string => url.match(VIMEO_URL_PATTERN)?.[1] || '';

export const isVimeoUrl = (url: string): boolean => VIMEO_URL_PATTERN.test(url);

export const resolveVideoSourceType = (videoSlide: VideoSlideLike): ResolvedVideoSourceType => {
    const explicit = videoSlide?.source_type?.trim().toUpperCase();

    // An explicit VIMEO/FILE_ID is always honoured as-is.
    if (explicit === 'VIMEO') return 'VIMEO';
    if (explicit === 'FILE_ID') return 'FILE_ID';

    // Anything else (blank, 'VIDEO', 'YOUTUBE', …) doesn't identify the host, so
    // let the stored value decide before defaulting.
    const url = videoUrlOf(videoSlide).trim();
    if (isVimeoUrl(url)) return 'VIMEO';
    if (FILE_ID_PATTERN.test(url)) return 'FILE_ID';

    return 'YOUTUBE';
};
