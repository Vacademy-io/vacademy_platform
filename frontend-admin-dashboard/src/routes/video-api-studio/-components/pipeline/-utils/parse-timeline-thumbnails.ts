/**
 * Extract per-scene preview-image / preview-video URLs from a finished
 * `time_based_frame.json`. The timeline shape is:
 *
 * ```
 * { entries: [{ id, index, start, end, html, ... }, ...] }
 * ```
 *
 * Each shot's `html` string is the rendered HTML (post `_ensure_fonts`)
 * containing `<img data-img-prompt=...>` and / or `<video src=...>` tags.
 * We just need the first image (or fall back to the video poster) per
 * scene to use as a thumbnail in the SceneNode.
 *
 * Pure function, runs on the FE — no BE changes needed for Phase 2.
 */

export interface TimelineEntry {
    id?: string;
    index?: number;
    start?: number;
    end?: number;
    html?: string;
}

/**
 * One audio track entry from `time_based_frame.json -> meta.audio_tracks[]`.
 * The pipeline writes the merged background-music track here with
 * `id === 'background-music'`. Other entries may exist if the user added
 * SFX / additional tracks via the editor.
 */
export interface TimelineAudioTrack {
    id?: string;
    label?: string;
    url?: string;
    volume?: number;
    delay?: number;
    fadeIn?: number;
    fadeOut?: number;
}

/**
 * Style-guide palette pulled out of the LLM's design pass. `processHtmlContent`
 * uses this to seed CSS variables (`--background-color`, `--primary-color`,
 * etc.) so embedded iframes match the theme of the rendered video.
 */
export interface TimelinePalette {
    background?: string;
    text?: string;
    text_secondary?: string;
    primary?: string;
    accent?: string;
}

/**
 * Per-shot metadata `_write_timeline` writes to `meta.shots[]` when a plan
 * exists. Carries the v3 ShotPlanner + NarrationWriter fields plus the
 * per-shot AI video (Veo) telemetry the orchestrator stamped onto the entry.
 * All fields optional — older runs only populate the base subset.
 */
export interface TimelineShotMeta {
    shot_idx?: number;
    shot_type?: string;
    intent_role?: string;
    narration_brief?: string;
    narration_text?: string;
    audio_policy?: 'narration_only' | 'intrinsic_only';
    background_treatment?: string;
    transition_in?: string;
    start_time?: number;
    duration?: number;
    audio_url?: string;
    audio_words_url?: string;
    audio_script_url?: string;
    audio_duration_s?: number;
    audio_skipped?: boolean;
    // ── AI video (Veo) per-shot telemetry ──
    _ai_video_audio_on?: boolean;
    _ai_video_request_id?: string;
    _ai_video_url?: string;
    _ai_video_cost_usd?: number;
    _ai_video_cost_credits?: number;
    _ai_video_elapsed_s?: number;
    _ai_video_segments?: Array<{
        seg_idx?: number;
        video_url?: string;
        duration_s?: number;
        request_id?: string;
        cache_hit?: boolean;
    }>;
}

export interface TimelineJson {
    entries?: TimelineEntry[];
    meta?: {
        audio_tracks?: TimelineAudioTrack[];
        palette?: TimelinePalette;
        /** v3 + AI-video runs: per-shot metadata, written by `_write_timeline`. */
        shots?: TimelineShotMeta[];
        /** v3 only: plan-level recurring motifs. */
        recurring_motifs?: Array<{
            description: string;
            screen_position?: string;
            when_visible?: string;
        }>;
        [key: string]: unknown;
    };
}

export interface SceneThumbnails {
    /** First `<img src>` in the entry (regardless of whether it's stock or AI). */
    imageUrl?: string;
    /** First `<video src>` in the entry — used as a moving thumbnail when present. */
    videoUrl?: string;
    /**
     * Full rendered HTML for the shot. Surfaced so the pipeline view can
     * embed an iframe-based preview that's playable for text-driven scenes
     * (no image/video) and gives a richer side-sheet preview for everything else.
     */
    html?: string;
}

/**
 * Pull the first `<img src="…">` and first `<video src="…">` (or
 * `<source src="…">`) URL out of an HTML string. Robust to attribute
 * ordering, single vs double quotes, and arbitrary whitespace.
 *
 * We deliberately use regex rather than `DOMParser` because the timeline's
 * HTML strings are ~50KB each and we may parse 30+ of them — a regex pass
 * is ~10× faster and we only need two attribute values per entry.
 */
export function extractSceneThumbnails(html: string | undefined): SceneThumbnails {
    if (!html) return {};
    const imgMatch = html.match(/<img\b[^>]*?\bsrc\s*=\s*['"]([^'"]+)['"]/i);
    const videoSrcMatch = html.match(/<video\b[^>]*?\bsrc\s*=\s*['"]([^'"]+)['"]/i);
    const sourceMatch = html.match(/<source\b[^>]*?\bsrc\s*=\s*['"]([^'"]+)['"]/i);
    const imageUrl = imgMatch?.[1];
    // Browser <video> tags can carry the URL on the element OR a nested
    // `<source>` — fall back to the latter when src isn't on <video>.
    const videoUrl = videoSrcMatch?.[1] ?? sourceMatch?.[1];
    // Skip data: / blob: URIs — those won't render as remote thumbs.
    return {
        imageUrl: imageUrl && /^https?:/.test(imageUrl) ? imageUrl : undefined,
        videoUrl: videoUrl && /^https?:/.test(videoUrl) ? videoUrl : undefined,
    };
}

/**
 * Map every entry by its `index` (or position) to its extracted thumbnails.
 * Caller merges this into the derived `scenes[]` array via shot-index lookup.
 */
export function parseTimelineThumbnails(
    timeline: TimelineJson | null | undefined
): Record<number, SceneThumbnails> {
    if (!timeline?.entries) return {};
    const out: Record<number, SceneThumbnails> = {};
    timeline.entries.forEach((entry, position) => {
        const idx = typeof entry.index === 'number' ? entry.index : position;
        out[idx] = { ...extractSceneThumbnails(entry.html), html: entry.html };
    });
    return out;
}

/**
 * Pull the style-guide palette out of `meta.palette`. Used to seed
 * `processHtmlContent` so embedded scene previews render with the same
 * theme variables the final MP4 was rendered against.
 */
export function pickPalette(
    timeline: TimelineJson | null | undefined
): TimelinePalette | undefined {
    return timeline?.meta?.palette;
}

/**
 * Pull the v3 per-shot meta map out of `timeline.json -> meta.shots[]`. Keyed
 * by `shot_idx` (or array position when missing) so the caller can merge it
 * into the `SceneSlot` array by index lookup.
 */
export function pickShotMetaByIndex(
    timeline: TimelineJson | null | undefined
): Record<number, TimelineShotMeta> {
    const shots = timeline?.meta?.shots;
    if (!Array.isArray(shots)) return {};
    const out: Record<number, TimelineShotMeta> = {};
    shots.forEach((shot, position) => {
        const idx = typeof shot?.shot_idx === 'number' ? shot.shot_idx : position;
        out[idx] = shot;
    });
    return out;
}

/** Pull plan-level recurring motifs out of `meta.recurring_motifs`. */
export function pickRecurringMotifs(
    timeline: TimelineJson | null | undefined
): Array<{ description: string; screen_position?: string; when_visible?: string }> {
    const motifs = timeline?.meta?.recurring_motifs;
    return Array.isArray(motifs) ? motifs : [];
}

/**
 * Pull the merged background-music track (if any) out of the timeline JSON's
 * `meta.audio_tracks[]`. The pipeline always writes the auto-generated /
 * fallback bed under `id === 'background-music'`; user-added editor tracks
 * use other ids.
 */
export function pickBackgroundMusicTrack(
    timeline: TimelineJson | null | undefined
): TimelineAudioTrack | undefined {
    const tracks = timeline?.meta?.audio_tracks;
    if (!Array.isArray(tracks) || tracks.length === 0) return undefined;
    return (
        tracks.find((t) => t?.id === 'background-music' && !!t.url) ??
        // Tolerate label-only matches (very old timeline.json from before the id
        // convention was added — not strictly necessary for v1 but cheap).
        tracks.find((t) => /background\s*music/i.test(t?.label ?? '') && !!t.url)
    );
}
