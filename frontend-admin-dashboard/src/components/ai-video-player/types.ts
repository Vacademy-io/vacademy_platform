/**
 * AI Content Player - Type Definitions
 * Supports 12 different content types with 3 navigation modes
 */

/**
 * All supported content types
 */
export type ContentType =
    | 'VIDEO' // Default: time-synced HTML overlays
    | 'QUIZ' // Question-based assessments
    | 'STORYBOOK' // Page-by-page narratives
    | 'INTERACTIVE_GAME' // Self-contained HTML5 games
    | 'PUZZLE_BOOK' // Collection of puzzles
    | 'SIMULATION' // Physics/science sandboxes
    | 'FLASHCARDS' // Spaced-repetition cards
    | 'MAP_EXPLORATION' // Interactive SVG maps
    | 'WORKSHEET' // Printable worksheets
    | 'CODE_PLAYGROUND' // Code editor exercises
    | 'TIMELINE' // Chronological visualization
    | 'CONVERSATION' // Language dialogues
    | 'SLIDES'; // HTML presentation / PPT-style slide deck

/**
 * Navigation modes for content playback
 */
export type NavigationType = 'time_driven' | 'user_driven' | 'self_contained';

/**
 * Entry/Frame interface matching the time_based_frame.json structure
 */
export interface Entry {
    inTime?: number; // For time_driven content
    exitTime?: number; // For time_driven content
    start?: number; // Alternative time field
    end?: number; // Alternative time field
    html: string;
    id: string;
    z?: number;
    htmlStartX?: number;
    htmlStartY?: number;
    htmlEndX?: number;
    htmlEndY?: number;
    audio_url?: string; // Optional per-entry audio (for user_driven)
    sound_cues?: SoundCue[]; // Sound Planner cues — scheduled via useSoundScheduler
    opacity?: number; // Crossfade opacity (0..1) — set per-frame at render time during transition windows
    /**
     * The LLM model_id that authored this entry's HTML. Stamped at initial
     * generation in `_shot_task` and refreshed when the user accepts a
     * regen. Read at regen time by the BE so "Remake with AI" uses the SAME
     * model the shot was originally authored with (or whatever the user
     * chose in the regen "Advanced > Model" dropdown). Optional — old
     * timelines without this field fall back to the BE registry default.
     */
    html_model?: string;
    entry_meta?: {
        text?: string;
        audio_text?: string;
        /**
         * Per-shot caption override applied by the render server. When absent
         * or `null`, the global caption settings (from the render request body)
         * are used.
         *  - `hide: true` → no caption rendered during this entry's window.
         *  - `position`   → forces 'top' or 'bottom' for this entry only.
         *  - `null`       → explicit "clear" sentinel emitted by the editor so
         *                   the BE deep-merge overwrites any stale override.
         * Stored under `entry_meta` so it rides the existing pass-through-merge
         * `/frame/update` round-trip with no schema change.
         */
        caption_style?: {
            hide?: boolean;
            position?: 'top' | 'bottom';
        } | null;
        [key: string]: unknown;
    };
}

/**
 * Legacy Frame interface for backward compatibility
 */
export interface Frame extends Entry {
    inTime: number;
    exitTime: number;
}

/**
 * Branding configuration
 */
export interface BrandingConfig {
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    watermark_html?: string;
}

/**
 * MCQ question shown at a specific timestamp during VIDEO playback
 */
export interface MCQQuestion {
    time: number; // Video timestamp (seconds) at which to pause and show the question
    question: string; // Question text
    options: string[]; // Exactly 4 answer options
    correct: number; // 0-indexed position of the correct option
    explanation: string; // Brief explanation shown after the student answers
}

/**
 * An extra audio track (background music, sound effect, etc.)
 * mixed on top of the narration track in both the player and the render pipeline.
 */
export interface AudioTrack {
    id: string; // e.g. "track-1"
    label: string; // display name e.g. "Background Music"
    url: string; // S3 public URL to the audio file
    volume: number; // 0.0–2.0, default 1.0
    delay: number; // seconds to wait before starting, default 0
    fadeIn: number; // fade-in duration in seconds, default 0
    fadeOut: number; // fade-out duration in seconds, default 0
}

/**
 * A scheduled sound effect cue produced by the Sound Planner in the backend.
 * Played live by `useSoundScheduler` during playback — NOT baked into any MP4.
 *
 * Cues are stored per timeline entry. `t` is the shot-relative time (seconds
 * after the entry's `inTime`) and `absolute_time` is the global-clock time
 * (already offset by any branding intro) pre-computed by the backend so the
 * scheduler can fire against the player's master clock without recomputing.
 */
export interface SoundCue {
    /** e.g. "sfx_2_signature" — stable across runs */
    id: string;
    /** Shot-relative seconds (debug/inspection). */
    t: number;
    /** Global timeline seconds — preferred for scheduling. */
    absolute_time?: number;
    /** S3 URL of the sound file. */
    url: string;
    /** 0.0–1.0 */
    volume: number;
    /** Semantic role (e.g. "transition_whoosh", "impact"). */
    role: string;
    /** Clip duration in seconds (informational). */
    duration?: number;
}

/**
 * Timeline metadata supporting all content types
 */
export interface TimelineMeta {
    // Content type information
    content_type: ContentType;
    navigation: NavigationType;
    entry_label: string;

    // Language of the content (e.g. "English", "French") — used by TTS and captions
    language?: string;

    // Audio/timing information
    audio_start_at: number;
    total_duration: number | null;

    // Extra audio tracks (background music, etc.) mixed on top of narration
    audio_tracks?: AudioTrack[];

    // Dimensions
    dimensions?: {
        width: number;
        height: number;
    };

    // Branding
    branding?: BrandingConfig;

    // Legacy fields for backward compatibility
    intro_duration?: number;
    outro_duration?: number;
    content_starts_at?: number;
    content_ends_at?: number;

    // Chapter markers for progress bar navigation
    chapters?: Array<{ time: number; label: string }>;

    // Glossary terms with the video time they were first introduced
    glossary?: Array<{ term: string; time: number }>;

    // MCQ questions shown at specific timestamps during video playback
    questions?: MCQQuestion[];

    // Color palette from the style guide — ensures CSS variables match the LLM's theme
    palette?: {
        background?: string;
        text?: string;
        text_secondary?: string;
        primary?: string;
        accent?: string;
    };

    // Per-sentence audio clips. Populated post-TTS by the pipeline (or
    // backfilled via /sentences/build) so the editor's script tab can edit
    // a sentence and re-narrate just that clip. The global narration.mp3
    // remains the authoritative source the player uses for playback;
    // sentences[] is an editing-side index into that file.
    //
    // @deprecated — superseded by `shots` on v3-pipeline videos. Sentence
    // clips remain readable for legacy timelines; new editor work should
    // target `meta.shots[]`.
    sentences?: SentenceClip[];

    // Per-shot editor unit (v3 pipeline). Populated by `_write_timeline`
    // from the persisted shot_plan.json (ShotPlanner output) or, on legacy
    // runs, from director_plan.json. Each entry corresponds 1:1 to a shot
    // in the pipeline — editing here re-narrates that exact shot via the
    // `/external/video/v1/shot/regenerate` endpoint.
    //
    // When BOTH `shots` and `sentences` are present, the editor SHOULD
    // prefer `shots` (the v3 source of truth); `sentences` is left readable
    // for backward compatibility but not edited.
    shots?: ShotClip[];
}

/**
 * One per-sentence audio clip stored under TimelineMeta.sentences[].
 *
 * `start_time` is the position of this clip inside the global narration.mp3
 * (so existing time-based playback still works). `audio_url` is the
 * stand-alone clip used by the editor for re-narration. `words` are the
 * per-sentence word timestamps with times REBASED to the clip's start
 * (0..duration) so they can be consumed without knowing start_time.
 *
 * @deprecated — superseded by `ShotClip` on v3-pipeline videos.
 */
export interface SentenceClip {
    id: string;
    text: string;
    audio_url: string;
    start_time: number;
    duration: number;
    words: WordTimestamp[];
}

/**
 * One per-shot audio clip stored under TimelineMeta.shots[] (v3 pipeline).
 *
 * Mirrors `SentenceClip` but at the SHOT granularity — the same unit the
 * Director / ShotPlanner planned, the same unit per-shot TTS produced, the
 * same unit the editor re-narrates.
 *
 * - `audio_url` / `audio_words_url` / `audio_script_url` are `null` for
 *   shots with `audio_policy === 'intrinsic_only'` (SOURCE_CLIP speaker,
 *   AI_VIDEO_HERO + Veo audio) — those carry intrinsic audio and have no
 *   per-shot master narration MP3.
 * - `start_time` is the shot's start on the absolute video timeline (already
 *   offset by `meta.content_starts_at` like chapters/glossary/questions).
 * - `words` are per-shot, time-rebased to the shot's start so they can be
 *   consumed without knowing start_time.
 * - `narration_brief` is the ShotPlanner's per-shot intent (1-2 sentences)
 *   surfaced so the editor can show it as a hint while editing.
 */
export interface ShotClip {
    id: string;
    shot_idx: number;
    shot_type: string;
    text: string;
    audio_url: string | null;
    audio_words_url: string | null;
    audio_script_url: string | null;
    audio_duration_s: number;
    audio_skipped: boolean;
    audio_policy: 'narration_only' | 'intrinsic_only';
    start_time: number;
    duration: number;
    intent_role: string;
    narration_brief: string;
    words: WordTimestamp[];
}

/**
 * Complete timeline data structure
 */
export interface TimelineData {
    meta: TimelineMeta;
    entries: Entry[];
}

/**
 * Props for the main AIContentPlayer component
 */
export interface AIContentPlayerProps {
    timelineUrl: string;
    audioUrl?: string; // Optional - not needed for user_driven/self_contained
    wordsUrl?: string; // Optional - for captions/subtitles
    avatarUrl?: string; // Optional - talking head avatar video
    className?: string;
    width?: number;
    height?: number;
    onEntryChange?: (index: number, entry: Entry) => void;
    onComplete?: () => void;
    onDownloadClick?: () => void; // Optional - shows download button in controls
}

/**
 * Legacy props for backward compatibility
 */
export interface AIVideoPlayerProps extends AIContentPlayerProps {
    audioUrl: string;
}

/**
 * Content type display labels with emojis
 */
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
    VIDEO: '🎬 Video',
    QUIZ: '📝 Quiz',
    STORYBOOK: '📖 Storybook',
    INTERACTIVE_GAME: '🎮 Game',
    PUZZLE_BOOK: '🧩 Puzzles',
    SIMULATION: '🔬 Simulation',
    FLASHCARDS: '🃏 Flashcards',
    MAP_EXPLORATION: '🗺️ Map',
    WORKSHEET: '📋 Worksheet',
    CODE_PLAYGROUND: '💻 Code',
    TIMELINE: '⏳ Timeline',
    CONVERSATION: '🗣️ Conversation',
    SLIDES: '🖼️ Slides',
};

/**
 * Default navigation mode by content type
 */
export const CONTENT_TYPE_NAVIGATION: Record<ContentType, NavigationType> = {
    VIDEO: 'time_driven',
    QUIZ: 'user_driven',
    STORYBOOK: 'user_driven',
    INTERACTIVE_GAME: 'self_contained',
    PUZZLE_BOOK: 'user_driven',
    SIMULATION: 'self_contained',
    FLASHCARDS: 'user_driven',
    MAP_EXPLORATION: 'user_driven',
    WORKSHEET: 'user_driven',
    CODE_PLAYGROUND: 'self_contained',
    TIMELINE: 'user_driven',
    CONVERSATION: 'user_driven',
    SLIDES: 'user_driven',
};

/**
 * Default entry labels by content type
 */
export const CONTENT_TYPE_ENTRY_LABELS: Record<ContentType, string> = {
    VIDEO: 'segment',
    QUIZ: 'question',
    STORYBOOK: 'page',
    INTERACTIVE_GAME: 'game',
    PUZZLE_BOOK: 'puzzle',
    SIMULATION: 'simulation',
    FLASHCARDS: 'card',
    MAP_EXPLORATION: 'region',
    WORKSHEET: 'exercise',
    CODE_PLAYGROUND: 'exercise',
    TIMELINE: 'event',
    CONVERSATION: 'exchange',
    SLIDES: 'slide',
};

/**
 * Format entry label for display
 * Example: "question" → "Question 3 of 10"
 */
export function formatEntryLabel(label: string, index: number, total: number): string {
    const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
    return `${capitalized} ${index + 1} of ${total}`;
}

/**
 * Get default meta values for backward compatibility
 */
export function getDefaultMeta(contentType: ContentType = 'VIDEO'): TimelineMeta {
    return {
        content_type: contentType,
        navigation: CONTENT_TYPE_NAVIGATION[contentType],
        entry_label: CONTENT_TYPE_ENTRY_LABELS[contentType],
        audio_start_at: 0,
        total_duration: null,
    };
}

// =====================================================
// CAPTION / SUBTITLE TYPES
// =====================================================

/**
 * Word timestamp from narration.words.json
 */
export interface WordTimestamp {
    word: string;
    start: number;
    end: number;
}

/**
 * Caption position options
 */
export type CaptionPosition = 'bottom' | 'top';

/**
 * Caption font size options
 */
export type CaptionFontSize = 'small' | 'medium' | 'large';

/**
 * Caption display style
 */
export type CaptionStyle = 'phrase' | 'karaoke';

/**
 * Caption font family. Mirrors `CaptionFontFamily` in the editor's
 * caption-rendering.ts and the render dialog's `RenderSettings.captionFontFamily`.
 * Limited to the set already loaded by the render harness.
 */
export type CaptionFontFamily = 'system' | 'inter' | 'montserrat' | 'noto-sans' | 'fira-code';

/**
 * Quick named style packs. `custom` is implicit when the user has tweaked past
 * a preset — UI derives it via structural compare, it isn't persisted long-term.
 */
export type CaptionPreset = 'youtube' | 'tiktok' | 'karaoke' | 'cinema' | 'branded' | 'custom';

/**
 * User-customizable caption settings
 */
export interface CaptionSettings {
    enabled: boolean;
    position: CaptionPosition;
    fontSize: CaptionFontSize;
    style: CaptionStyle;
    backgroundOpacity: number; // 0 to 1
    textColor: string;
    highlightColor: string; // For karaoke style
    /** 'system' (default) or one of the four harness-loaded Google Fonts. */
    fontFamily: CaptionFontFamily;
    /** 400 / 500 / 600 / 700 / 800 / 900. Default 400. */
    fontWeight: number;
    /** Outline width in CSS px (player-display pixels, NOT canvas px). 0 = no stroke. */
    textStrokeWidth: number;
    /** Hex color for the outline. */
    textStrokeColor: string;
    /** Informational — UI shows which preset is currently selected. */
    preset?: CaptionPreset;
}

/**
 * Default caption settings
 */
export const DEFAULT_CAPTION_SETTINGS: CaptionSettings = {
    enabled: false,
    position: 'bottom',
    fontSize: 'medium',
    style: 'phrase',
    backgroundOpacity: 0.6,
    textColor: '#ffffff',
    highlightColor: '#fbbf24', // Amber/yellow for current word
    fontFamily: 'system',
    fontWeight: 400,
    textStrokeWidth: 0,
    textStrokeColor: '#000000',
    preset: 'youtube',
};

/**
 * Font size mapping in pixels
 */
export const CAPTION_FONT_SIZES: Record<CaptionFontSize, number> = {
    small: 16,
    medium: 20,
    large: 28,
};
