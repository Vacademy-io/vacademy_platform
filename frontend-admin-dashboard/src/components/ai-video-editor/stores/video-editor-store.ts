import { create } from 'zustand';
import {
    Entry,
    TimelineMeta,
    AudioTrack,
    getDefaultMeta,
} from '@/components/ai-video-player/types';
import { AI_SERVICE_BASE_URL } from '@/constants/urls';
import { clamp } from '../utils/coord-convert';
import { buildTransitionCss, TransitionPair, Transition } from '../utils/transitions';

/**
 * Which backend table this timeline lives in. `'reel'` routes `/frame/*`
 * saves to `/external/reels/v1/frame/*` (which updates
 * `ai_reels.s3_urls.time_based_frame`) instead of the AI-gen-video table.
 * Defaults to `'video'` for compatibility with every existing caller.
 */
export type EditorKind = 'video' | 'reel';

export interface InitParams {
    videoId: string;
    htmlUrl: string;
    audioUrl?: string;
    wordsUrl?: string;
    avatarUrl?: string;
    apiKey?: string;
    orientation?: string;
    kind?: EditorKind;
}

export interface EntryTransform {
    x: number; // canvas-space pixel offset from center
    y: number;
    scale: number; // 1.0 = 100%
    rotation: number; // degrees
}

export const DEFAULT_TRANSFORM: EntryTransform = { x: 0, y: 0, scale: 1, rotation: 0 };

/** Minimum shot duration (seconds) — edges clamp against this so we can't crush a shot to zero. */
export const MIN_SHOT_DURATION = 0.2;

/** Timeline snap granularity (seconds). All edge/body moves quantize against this. */
export const SNAP_S = 0.1;
export function snapTime(t: number): number {
    return Math.round(t / SNAP_S) * SNAP_S;
}

// ── viewMode (simple vs developer) ──────────────────────────────────────────
//
// Global UI mode toggle. 'simple' (default) shows friendly labels and tucks
// raw-CSS / class / id inputs and the Code tab behind `Advanced ▾`
// disclosures. 'developer' pre-expands the same disclosures and reveals
// tag-name badges in the Layers tree. Both modes have access to every
// underlying control — the difference is presentation, not capability.
//
// Persisted to localStorage so the choice survives reloads but stays
// per-device.

export type ViewMode = 'simple' | 'developer';

const VIEW_MODE_LS_KEY = 'vx-view-mode';

function loadViewMode(): ViewMode {
    if (typeof window === 'undefined') return 'simple';
    try {
        const raw = window.localStorage.getItem(VIEW_MODE_LS_KEY);
        return raw === 'developer' ? 'developer' : 'simple';
    } catch {
        return 'simple';
    }
}

function persistViewMode(m: ViewMode): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(VIEW_MODE_LS_KEY, m);
    } catch {
        /* private mode — fine, just won't persist */
    }
}

// ── Display-name overrides (per-shot rename) ────────────────────────────────
//
// Friendly per-entry names a user has set via inline rename in the
// EntryListPanel. The server is the source of truth: each saved name lives
// in the entry's `entry_meta.display_name` and is hydrated back into
// `displayNames` on the next loadTimeline.
//
// localStorage is the *offline* buffer keyed by videoId — it lets a pending
// rename survive a reload before the user clicks Save. It's cleared on save
// success and only contains non-empty values (see persistDisplayNames for
// why empty-string sentinels are in-memory only).

const DISPLAY_NAMES_LS_PREFIX = 'vx-display-names-';

function loadDisplayNames(videoId: string): Record<string, string> {
    if (typeof window === 'undefined' || !videoId) return {};
    try {
        const raw = window.localStorage.getItem(DISPLAY_NAMES_LS_PREFIX + videoId);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, string>;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function persistDisplayNames(videoId: string, names: Record<string, string>): void {
    if (typeof window === 'undefined' || !videoId) return;
    try {
        // Strip empty-string sentinels before writing to disk. They're an
        // in-session signal to saveChanges ("this entry's override has been
        // cleared, send entry_meta with display_name='' to the server").
        // Persisting them would let a pending clear survive a reload — but
        // the dirty bit is reset on reload, so the save loop would never
        // actually push the clear, leaving the timeline silently desynced.
        // Treat clears like every other unsaved edit: they're in-memory until
        // save, lost on reload otherwise. Saved overrides (non-empty values)
        // get hydrated back from the server's entry_meta on the next load.
        const onDisk: Record<string, string> = {};
        for (const [k, v] of Object.entries(names)) {
            if (v) onDisk[k] = v;
        }
        if (Object.keys(onDisk).length === 0) {
            window.localStorage.removeItem(DISPLAY_NAMES_LS_PREFIX + videoId);
        } else {
            window.localStorage.setItem(DISPLAY_NAMES_LS_PREFIX + videoId, JSON.stringify(onDisk));
        }
    } catch {
        /* private mode — fine */
    }
}

/** A span on the timeline where audio plays but no base-channel visual exists.
 *  These are the user-actionable gaps the "+ Add shot here" affordance fills. */
export interface TimelineGap {
    start: number;
    end: number;
    /** Stable key derived from rounded start/end seconds. Used as a React key
     *  and as the in-flight lock key so the popover knows which gap is busy. */
    key: string;
}

/**
 * Find ranges on the timeline where the base z-channel (z < 500) has no entry.
 * Overlay/UI channels are ignored — those layer on top and aren't what gives
 * a "no visual" feeling to the viewer. Gaps shorter than `minGapSeconds` are
 * dropped so we don't litter the UI with sub-second slivers that aren't worth
 * filling.
 *
 * Emits a head-gap (0 → first base entry) and tail-gap (last base entry →
 * totalDuration) when either is at least `minGapSeconds` long.
 */
export function computeTimelineGaps(
    entries: Entry[],
    totalDuration: number,
    minGapSeconds = 1.0
): TimelineGap[] {
    if (totalDuration <= 0) return [];
    const baseEntries = entries
        .filter((e) => (e.z ?? 0) < 500)
        .map((e) => ({
            start: e.inTime ?? e.start ?? 0,
            end: e.exitTime ?? e.end ?? 0,
        }))
        .filter((s) => s.end > s.start)
        .sort((a, b) => a.start - b.start);

    const gaps: TimelineGap[] = [];
    let cursor = 0;
    for (const span of baseEntries) {
        if (span.start - cursor >= minGapSeconds) {
            gaps.push(makeGap(cursor, span.start));
        }
        cursor = Math.max(cursor, span.end);
    }
    if (totalDuration - cursor >= minGapSeconds) {
        gaps.push(makeGap(cursor, totalDuration));
    }
    return gaps;
}

function makeGap(start: number, end: number): TimelineGap {
    // Two-decimal rounding keeps the key stable across repeated computations
    // (totalDuration can drift by float-epsilon during scrubbing).
    return { start, end, key: `${start.toFixed(2)}-${end.toFixed(2)}` };
}

/**
 * Find the adjacent entry that shares `edge` with `entry` within the same
 * z-channel (base 0–499, overlay 500–8999, ui ≥9000). Returns `null` when no
 * neighbour shares the boundary within `tolerance` seconds — in that case a
 * roll-mode drag should gracefully fall back to slip.
 */
export function findRollNeighbour(
    entries: Entry[],
    entry: Entry,
    edge: 'in' | 'out',
    tolerance = 0.05
): Entry | null {
    const entryZ = entry.z ?? 0;
    const channelBucket = (z: number): 'base' | 'overlay' | 'ui' =>
        z >= 9000 ? 'ui' : z >= 500 ? 'overlay' : 'base';
    const myBucket = channelBucket(entryZ);
    const myEdgeTime = edge === 'in' ? entry.inTime : entry.exitTime;
    if (myEdgeTime == null) return null;

    let best: Entry | null = null;
    let bestDelta = tolerance;
    for (const other of entries) {
        if (other.id === entry.id) continue;
        if (channelBucket(other.z ?? 0) !== myBucket) continue;
        const otherEdgeTime = edge === 'in' ? other.exitTime : other.inTime;
        if (otherEdgeTime == null) continue;
        const delta = Math.abs(otherEdgeTime - myEdgeTime);
        if (delta <= bestDelta) {
            best = other;
            bestDelta = delta;
        }
    }
    return best;
}

function isIdentity(t: EntryTransform): boolean {
    return t.x === 0 && t.y === 0 && t.scale === 1 && t.rotation === 0;
}

/**
 * Shot wrapper: a single outer <div> that carries per-shot visual state
 * (transform, background) baked into the saved HTML. Marked with
 * data-vx-shot="1" so we can recognize and rewrite it idempotently.
 */
const SHOT_WRAPPER_OPEN_RE = /^<div\s+data-vx-shot="1"\s+style="[^"]*">/;

// ── Animation timescale injection ────────────────────────────────────────────
const TIMESCALE_SCRIPT_RE = /<script\s[^>]*data-vx-timescale="[^"]*"[^>]*>[\s\S]*?<\/script>/;

function stripTimescaleScript(html: string): string {
    return html.replace(TIMESCALE_SCRIPT_RE, '');
}

/** Inject (or replace) a gsap.globalTimeline.timeScale call at the end of the HTML.
 *  `baseDur` is the shot's "natural" animation duration — stored as an attribute
 *  so the script can be reconstructed correctly after a page reload. */
function injectTimescaleScript(html: string, speed: number, baseDur: number): string {
    const s = speed.toFixed(4);
    const d = baseDur.toFixed(3);
    const script = `<script data-vx-timescale="${s}" data-vx-base-dur="${d}">gsap.globalTimeline.timeScale(${s});</script>`;
    return stripTimescaleScript(html) + script;
}

/** Read the stored base duration from a previously injected timescale script. */
function readTimescaleBaseDur(html: string): number | null {
    const m = html.match(/data-vx-base-dur="([^"]+)"/);
    return m?.[1] != null ? parseFloat(m[1]) : null;
}
const LEGACY_TRANSFORM_WRAPPER_RE =
    /^<div style="position:absolute;inset:0;transform:[^"]*;transform-origin:center center;overflow:visible;">([\s\S]*)<\/div>$/;

/** Strip any previously baked wrapper so we never double-wrap on re-save. */
function stripShotWrapper(html: string): string {
    if (SHOT_WRAPPER_OPEN_RE.test(html) && html.endsWith('</div>')) {
        return html.replace(SHOT_WRAPPER_OPEN_RE, '').slice(0, -'</div>'.length);
    }
    const legacy = html.match(LEGACY_TRANSFORM_WRAPPER_RE);
    return legacy ? legacy[1] ?? html : html;
}

function injectShotWrapper(
    html: string,
    t: EntryTransform | undefined,
    background: string | undefined,
    transitions: TransitionPair | undefined,
    shotDuration: number | undefined
): string {
    const inner = stripShotWrapper(html);
    const hasTransform = t && !isIdentity(t);
    const hasBackground = !!background && background.trim() !== '';
    const tcss =
        transitions && shotDuration != null ? buildTransitionCss(transitions, shotDuration) : null;
    if (!hasTransform && !hasBackground && !tcss) return inner;

    const styles: string[] = [
        'position:absolute',
        'inset:0',
        'transform-origin:center center',
        'overflow:visible',
    ];
    if (hasTransform) {
        styles.push(
            `transform:translate(${t!.x}px, ${t!.y}px) scale(${t!.scale}) rotate(${t!.rotation}deg)`
        );
    }
    if (hasBackground) styles.push(`background:${background}`);
    if (tcss) styles.push(`animation:${tcss.animation}`);

    const keyframeBlock = tcss ? `<style>${tcss.keyframes}</style>` : '';
    return `<div data-vx-shot="1" style="${styles.join(';')}">${keyframeBlock}${inner}</div>`;
}

interface HistorySnapshot {
    entries: Entry[];
    entryTransforms: Record<string, EntryTransform>;
    entryBackgrounds: Record<string, string>;
    entryTransitions: Record<string, TransitionPair>;
    dirtyEntryIds: string[];
    newEntryIds: string[];
    deletedEntryIds: string[];
    pendingReorders: ReorderOp[];
}

/** One queued frame reorder, applied to the server-side timeline on save. */
export interface ReorderOp {
    entry_id: string;
    /** Target index in the post-move local entries array. */
    to_index: number;
}

export interface VideoEditorState {
    // Video identity
    videoId: string;
    htmlUrl: string;
    audioUrl?: string;
    wordsUrl?: string;
    avatarUrl?: string;
    apiKey?: string;
    orientation: string;
    /** Backend kind — drives which `/frame/*` base URL `saveChanges` hits.
     *  `'video'` (default) → `/external/video/v1/frame/*`,
     *  `'reel'`             → `/external/reels/v1/frame/*`. */
    kind: EditorKind;

    // Timeline data
    entries: Entry[];
    meta: TimelineMeta;
    isLoading: boolean;
    error: string | null;

    // Scrub state (seconds for time_driven; index for user_driven)
    currentTime: number;

    // Selection
    selectedEntryId: string | null;
    /** DOM path within the selected entry's HTML — drives the Layers tab and
     *  (eventually) the on-canvas selection handles. Cleared when a different
     *  entry is selected. */
    selectedLayerPath: number[] | null;

    // Mode
    isPreviewMode: boolean;

    /** UI presentation mode. 'simple' (default) hides raw-CSS / tag-name /
     *  class inputs behind `Advanced ▾` disclosures. 'developer' pre-expands
     *  them. Both modes expose every underlying control. */
    viewMode: ViewMode;

    /** Per-entry user-set display names ({entryId: name}). Persisted to
     *  localStorage keyed by videoId; not yet sent to the backend. Empty
     *  string / missing key falls back to the derived friendly name. */
    displayNames: Record<string, string>;

    // Dirty tracking (HTML edits)
    dirtyEntryIds: string[];
    /** IDs of entries that are brand-new and have never been saved to the backend. */
    newEntryIds: string[];
    /** IDs of previously-persisted entries the user has deleted in this session
     *  but has not yet saved. saveChanges() calls /frame/delete for each one
     *  before processing adds/updates so frame indices don't shift mid-save. */
    deletedEntryIds: string[];
    /** Queued reorder operations (drag-to-reorder in EntryListPanel). Sent to
     *  /frame/reorder before adds/updates so subsequent /frame/update calls
     *  hit the right server-side positional indices. Routing through this
     *  endpoint avoids the partial-failure destruction that sequential
     *  /frame/update calls would cause (positional writes overwrite the entry
     *  currently at that index). */
    pendingReorders: ReorderOp[];

    // Extra audio tracks (background music, SFX, etc.)
    audioTracks: AudioTrack[];

    // Per-entry CSS transforms (client-side; baked into HTML on save)
    entryTransforms: Record<string, EntryTransform>;

    // Per-entry background color / CSS value (client-side; baked into HTML on save)
    entryBackgrounds: Record<string, string>;

    // Per-entry transition pair (in/out); baked into the shot wrapper on save.
    entryTransitions: Record<string, TransitionPair>;

    // Undo/Redo history
    past: HistorySnapshot[];
    future: HistorySnapshot[];

    // Save state
    isSaving: boolean;

    /** ID of the sentence currently being re-narrated (or null when idle).
     *  Drives loading UI in the SentenceEditPopover so the user can't fire
     *  a second regenerate while the first is in flight. */
    regeneratingSentenceId: string | null;

    /** Per-entry "natural" animation duration (seconds) — the duration the HTML
     *  animations were originally designed for. Snapshotted at load time and used
     *  by `fitAnimationsToDuration` to compute the correct timeScale ratio.
     *  Session-only; survives reload via the `data-vx-base-dur` attribute baked
     *  into the injected timescale script. */
    naturalDurations: Record<string, number>;

    /** `key` of the gap currently being filled by an /shot/insert request.
     *  Drives loading UI in the AddShotPopover. Only one gap-insert can be
     *  in flight at a time — the request is fast enough (single LLM call)
     *  that this is fine in practice. */
    insertingGapKey: string | null;

    // Actions
    init: (params: InitParams) => void;
    loadTimeline: () => Promise<void>;
    seek: (time: number) => void;
    selectEntry: (id: string | null) => void;
    selectLayer: (path: number[] | null) => void;
    togglePreviewMode: () => void;

    /** Switch between simple (friendly labels, advanced hidden) and developer
     *  (advanced pre-expanded, tag-name badges visible) presentation. */
    setViewMode: (m: ViewMode) => void;
    toggleViewMode: () => void;

    /** Set a user-chosen display name for an entry. Empty string clears the
     *  override and falls back to the auto-derived friendly name. Persists to
     *  localStorage per video — no backend round-trip required. */
    setEntryDisplayName: (entryId: string, name: string) => void;
    updateEntryHtml: (entryId: string, newHtml: string) => void;
    /** Remove one scheduled sound effect from an entry. The entry is
     *  marked dirty so the deletion is persisted on the next saveChanges. */
    removeSoundCue: (entryId: string, cueId: string) => void;
    /** Append a new entry to the local timeline (marks it as new for frame/add on save). */
    addEntry: (entry: Entry) => void;
    /** Delete an entry from the timeline */
    deleteEntry: (entryId: string) => void;
    // Audio track actions (update local state; callers must also call API)
    setAudioTracks: (tracks: AudioTrack[]) => void;
    addAudioTrack: (track: AudioTrack) => void;
    updateAudioTrack: (trackId: string, patch: Partial<AudioTrack>) => void;
    removeAudioTrack: (trackId: string) => void;
    updateEntryTransform: (entryId: string, patch: Partial<EntryTransform>) => void;
    resetEntryTransform: (entryId: string) => void;
    /** Set or clear an entry's background CSS value (empty string / undefined clears it). */
    updateEntryBackground: (entryId: string, background: string | undefined) => void;
    /**
     * Set or clear the in/out transition for an entry. Pass `null` to remove
     * that side of the pair. Transitions are session state and get baked into
     * the shot wrapper's `animation` property + `<style>` keyframes on save.
     */
    updateEntryTransition: (
        entryId: string,
        which: 'in' | 'out',
        transition: Transition | null
    ) => void;
    /**
     * Resize one edge of a time_driven entry.
     *
     *  - `slip`   : move just this edge; may open gaps / create overlaps with neighbours.
     *  - `roll`   : move this edge AND the matching edge of the adjacent entry in the
     *               same channel, keeping them glued together (no downstream shift).
     *  - `ripple` : move this edge AND shift every later entry by the same delta
     *               (changes total_duration; breaks audio sync — power-user only).
     *
     * Clamps to a minimum shot duration of MIN_SHOT_DURATION so edges never
     * cross. For roll, the adjacent entry is also clamped.
     */
    resizeEntryEdge: (
        entryId: string,
        edge: 'in' | 'out',
        newTime: number,
        mode: 'slip' | 'roll' | 'ripple'
    ) => void;

    /**
     * Move one or more time_driven entries by `deltaTime` seconds.
     *
     *  - `move`   : shift only the listed entries; downstream entries untouched.
     *               Clamps so no inTime < 0 and no exitTime > total_duration.
     *  - `ripple` : shift the listed entries AND every non-branding entry whose
     *               inTime >= max(originalExitTime of listed entries) by the
     *               same delta. total_duration grows/shrinks accordingly. Audio
     *               narration is NOT shifted — caller surfaces a warning.
     *
     * Branding entries (`id.startsWith('branding-')`) are silently skipped in
     * the listed set and in the downstream-ripple sweep, so branding-outro
     * stays anchored at the end of the timeline.
     *
     * IMPORTANT: never call from a pointer-move handler. Commit only on
     * pointer-up so undo records one history entry per drag.
     */
    moveEntries: (ids: string[], deltaTime: number, mode: 'move' | 'ripple') => void;

    /**
     * Reorder the entries array by moving entries[fromIndex] to position
     * toIndex. Queues a `/frame/reorder` op (atomic on the server) instead of
     * marking entries dirty — sequential `/frame/update` calls would be
     * destructive because they overwrite by positional index.
     *
     * Branding entries cannot be moved (they must stay at the ends).
     * Does NOT modify inTime/exitTime — visual timeline order in the
     * scrubber stays driven by inTime.
     */
    reorderEntries: (fromIndex: number, toIndex: number) => void;

    undo: () => void;
    redo: () => void;
    saveChanges: () => Promise<void>;

    /**
     * Re-narrate one sentence in the same voice the video was originally
     * generated with. Calls the ai_service /sentence/regenerate endpoint;
     * on success, applies the same ripple to in-memory state that the
     * server already persisted to the timeline JSON in S3:
     *   - meta.sentences[i] replaced with the new clip
     *   - all later sentences shifted by duration_delta
     *   - all entries whose time range starts at/after the splice
     *     boundary shifted by duration_delta
     *   - meta.total_duration bumped
     *   - audioUrl pointed at the new spliced MP3
     *
     * Returns ok/error rather than throwing so the popover can render
     * inline error feedback without try/catch boilerplate.
     */
    regenerateSentence: (
        sentenceId: string,
        newText: string
    ) => Promise<{ ok: boolean; error?: string }>;

    /**
     * Mute one sentence: server replaces its audio range with silence of
     * the same length and clears the sentence's text/words. Total
     * duration is preserved, so no entry/sentence ripple is needed —
     * only `audioUrl` and the target sentence are updated locally.
     *
     * The sentence stays in meta.sentences[] (with empty text + audio_url),
     * so a later regenerateSentence call on the same id puts new
     * narration back in the same slot.
     */
    silenceSentence: (sentenceId: string) => Promise<{ ok: boolean; error?: string }>;

    /**
     * Generate a new HTML shot to fill `[gapStart, gapEnd]` on the
     * timeline. Server uses the narration in that range as the LLM's
     * primary script and combines it with the optional `userHint` for
     * explicit visual intent. On success, the returned entry is inserted
     * into `entries[]` (sorted by inTime) and tracked as new+dirty so the
     * next `saveChanges` persists it via `frame/add`.
     *
     * Duration-neutral: gap-filling doesn't shift any timestamps, so no
     * ripple is applied locally either.
     */
    /**
     * Inject (or update) a `gsap.globalTimeline.timeScale()` call into the
     * entry's HTML so its animations fill the current shot duration.
     * The natural duration (what the animations were designed for) is read from
     * a `data-vx-base-dur` attribute baked into any previous injection, or
     * falls back to the session snapshot in `naturalDurations`.
     */
    fitAnimationsToDuration: (entryId: string) => void;

    insertShot: (
        gap: TimelineGap,
        userHint: string | null
    ) => Promise<{ ok: boolean; error?: string }>;
}

function snapshot(s: VideoEditorState): HistorySnapshot {
    return {
        entries: s.entries,
        entryTransforms: s.entryTransforms,
        entryBackgrounds: s.entryBackgrounds,
        entryTransitions: s.entryTransitions,
        dirtyEntryIds: s.dirtyEntryIds,
        newEntryIds: s.newEntryIds,
        deletedEntryIds: s.deletedEntryIds,
        pendingReorders: s.pendingReorders,
    };
}

function pushPast(s: VideoEditorState): Pick<VideoEditorState, 'past' | 'future'> {
    return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
    };
}

export const useVideoEditorStore = create<VideoEditorState>((set, get) => ({
    videoId: '',
    htmlUrl: '',
    audioUrl: undefined,
    wordsUrl: undefined,
    avatarUrl: undefined,
    apiKey: undefined,
    orientation: 'landscape',
    kind: 'video',
    entries: [],
    meta: getDefaultMeta('VIDEO'),
    isLoading: false,
    error: null,
    currentTime: 0,
    selectedEntryId: null,
    selectedLayerPath: null,
    isPreviewMode: false,
    viewMode: loadViewMode(),
    displayNames: {},
    dirtyEntryIds: [],
    newEntryIds: [],
    deletedEntryIds: [],
    pendingReorders: [],
    audioTracks: [],
    entryTransforms: {},
    entryBackgrounds: {},
    entryTransitions: {},
    past: [],
    future: [],
    isSaving: false,
    regeneratingSentenceId: null,
    insertingGapKey: null,
    naturalDurations: {},

    init: (params) => {
        set({
            videoId: params.videoId,
            htmlUrl: params.htmlUrl,
            audioUrl: params.audioUrl,
            wordsUrl: params.wordsUrl,
            avatarUrl: params.avatarUrl,
            apiKey: params.apiKey,
            orientation: params.orientation ?? 'landscape',
            kind: params.kind ?? 'video',
            entries: [],
            meta: getDefaultMeta('VIDEO'),
            isLoading: false,
            error: null,
            currentTime: 0,
            selectedEntryId: null,
            selectedLayerPath: null,
            isPreviewMode: false,
            // Don't overwrite viewMode on re-init — it's a global preference.
            // Display names are per-video though, so reload them now.
            displayNames: loadDisplayNames(params.videoId),
            dirtyEntryIds: [],
            newEntryIds: [],
            deletedEntryIds: [],
            pendingReorders: [],
            audioTracks: [],
            entryTransforms: {},
            entryBackgrounds: {},
            entryTransitions: {},
            past: [],
            future: [],
            isSaving: false,
        });
    },

    loadTimeline: async () => {
        const { htmlUrl } = get();
        if (!htmlUrl) return;

        set({ isLoading: true, error: null });
        try {
            const res = await fetch(htmlUrl);
            if (!res.ok) throw new Error(`Failed to load timeline: ${res.status}`);
            const raw: unknown = await res.json();

            let entries: Entry[];
            let meta: TimelineMeta;

            if (Array.isArray(raw)) {
                entries = raw as Entry[];
                meta = getDefaultMeta('VIDEO');
            } else if (
                raw &&
                typeof raw === 'object' &&
                'entries' in raw &&
                Array.isArray((raw as Record<string, unknown>).entries)
            ) {
                const r = raw as Record<string, unknown>;
                entries = r.entries as Entry[];
                const rawMeta = (r.meta ?? {}) as Partial<TimelineMeta>;
                meta = {
                    ...getDefaultMeta(rawMeta.content_type ?? 'VIDEO'),
                    ...rawMeta,
                };
            } else {
                throw new Error('Unrecognized timeline format');
            }

            // Snapshot each entry's natural animation duration. If the HTML already
            // has a timescale script (from a prior fit), read back the stored base
            // duration so the ratio stays stable across page reloads.
            const naturalDurations: Record<string, number> = {};
            for (const e of entries) {
                const dur = (e.exitTime ?? e.end ?? 0) - (e.inTime ?? e.start ?? 0);
                const baseDur = readTimescaleBaseDur(e.html ?? '');
                if (baseDur != null && baseDur > 0) {
                    naturalDurations[e.id] = baseDur;
                } else if (dur > 0) {
                    naturalDurations[e.id] = dur;
                }
            }
            // Hydrate display-name overrides. Server values (stored in
            // entry_meta.display_name) form the base. localStorage overlays on
            // top so an unsaved rename made on this device survives a
            // reload. After a successful save the localStorage buffer is
            // cleared, so the only entries it contains are pending overrides.
            const serverNames: Record<string, string> = {};
            for (const e of entries) {
                const m = e.entry_meta;
                if (m && typeof m === 'object') {
                    const dn = (m as { display_name?: unknown }).display_name;
                    if (typeof dn === 'string' && dn.trim()) {
                        serverNames[e.id] = dn.trim();
                    }
                }
            }
            const localNames = loadDisplayNames(get().videoId);
            const mergedNames = { ...serverNames, ...localNames };

            set({
                entries,
                meta,
                audioTracks: meta.audio_tracks ?? [],
                isLoading: false,
                naturalDurations,
                displayNames: mergedNames,
            });
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : 'Failed to load timeline',
                isLoading: false,
            });
        }
    },

    seek: (time) => set({ currentTime: time }),

    selectEntry: (id) =>
        set((s) => ({
            selectedEntryId: id,
            // Clear the layer selection whenever the entry context changes —
            // a path is only meaningful within one entry's HTML.
            selectedLayerPath: id === s.selectedEntryId ? s.selectedLayerPath : null,
        })),

    selectLayer: (path) => set({ selectedLayerPath: path }),

    togglePreviewMode: () =>
        set((s) => ({
            isPreviewMode: !s.isPreviewMode,
            selectedEntryId: null,
            selectedLayerPath: null,
        })),

    setViewMode: (m) => {
        persistViewMode(m);
        set({ viewMode: m });
    },
    toggleViewMode: () => {
        const next: ViewMode = get().viewMode === 'simple' ? 'developer' : 'simple';
        persistViewMode(next);
        set({ viewMode: next });
    },

    setEntryDisplayName: (entryId, name) => {
        set((s) => {
            const trimmed = name.trim();
            // We always store the value, even when empty. The empty string
            // is the "explicit clear" sentinel — saveChanges uses it to send
            // entry_meta: { display_name: '' } so the server drops the
            // override on its side too. Deleting the key here would leak the
            // clear: saveChanges would see undefined and skip entry_meta,
            // leaving the stale name on the server (and on other devices).
            //
            // friendlyEntryName treats empty strings as "no override" (falsy)
            // and falls back to the auto-derived name, so the UI stays
            // friendly regardless of whether the key is absent or "".
            const next = { ...s.displayNames, [entryId]: trimmed };

            // localStorage is the offline buffer: it stores pending renames
            // so they survive a reload even before the user clicks Save.
            // After a successful save the entry's localStorage key is cleared
            // (the value lives on the server now via entry_meta.display_name).
            persistDisplayNames(s.videoId, next);

            // Mark the entry dirty so saveChanges picks it up. Renames go
            // through the existing /frame/update flow with the new
            // entry_meta field — no new endpoint needed.
            const dirtyEntryIds = s.dirtyEntryIds.includes(entryId)
                ? s.dirtyEntryIds
                : [...s.dirtyEntryIds, entryId];

            return { displayNames: next, dirtyEntryIds };
        });
    },

    updateEntryHtml: (entryId, newHtml) => {
        set((s) => ({
            ...pushPast(s),
            entries: s.entries.map((e) => (e.id === entryId ? { ...e, html: newHtml } : e)),
            dirtyEntryIds: s.dirtyEntryIds.includes(entryId)
                ? s.dirtyEntryIds
                : [...s.dirtyEntryIds, entryId],
        }));
    },

    removeSoundCue: (entryId, cueId) => {
        set((s) => {
            const target = s.entries.find((e) => e.id === entryId);
            if (!target || !target.sound_cues?.some((c) => c.id === cueId)) {
                // Nothing to remove — no-op (don't pollute undo history).
                return s;
            }
            return {
                ...pushPast(s),
                entries: s.entries.map((e) =>
                    e.id === entryId
                        ? {
                              ...e,
                              sound_cues: (e.sound_cues ?? []).filter((c) => c.id !== cueId),
                          }
                        : e
                ),
                dirtyEntryIds: s.dirtyEntryIds.includes(entryId)
                    ? s.dirtyEntryIds
                    : [...s.dirtyEntryIds, entryId],
            };
        });
    },

    addEntry: (entry) => {
        set((s) => ({
            ...pushPast(s),
            entries: [...s.entries, entry],
            dirtyEntryIds: s.dirtyEntryIds.includes(entry.id)
                ? s.dirtyEntryIds
                : [...s.dirtyEntryIds, entry.id],
            // Track as new so saveChanges calls frame/add instead of frame/update
            newEntryIds: s.newEntryIds.includes(entry.id)
                ? s.newEntryIds
                : [...s.newEntryIds, entry.id],
            selectedEntryId: entry.id,
            // Extend total_duration if the new entry goes beyond it
            meta:
                entry.exitTime != null &&
                s.meta.total_duration != null &&
                entry.exitTime > s.meta.total_duration
                    ? { ...s.meta, total_duration: entry.exitTime }
                    : s.meta,
        }));
    },

    deleteEntry: (entryId) => {
        set((s) => {
            const nextT = { ...s.entryTransforms };
            delete nextT[entryId];
            const nextB = { ...s.entryBackgrounds };
            delete nextB[entryId];
            const nextX = { ...s.entryTransitions };
            delete nextX[entryId];
            // If the entry is brand-new (never saved), removing it is purely
            // local — no server-side counterpart to delete. Otherwise it was
            // previously persisted, so we have to send a /frame/delete on save.
            const isNew = s.newEntryIds.includes(entryId);
            return {
                ...pushPast(s),
                entries: s.entries.filter((e) => e.id !== entryId),
                selectedEntryId: s.selectedEntryId === entryId ? null : s.selectedEntryId,
                dirtyEntryIds: s.dirtyEntryIds.filter((id) => id !== entryId),
                newEntryIds: s.newEntryIds.filter((id) => id !== entryId),
                deletedEntryIds:
                    isNew || s.deletedEntryIds.includes(entryId)
                        ? s.deletedEntryIds
                        : [...s.deletedEntryIds, entryId],
                // Drop any queued reorder for an entry that's about to be
                // gone from the server — the /frame/delete will happen first
                // on save and a follow-up /frame/reorder for the same id
                // would 404.
                pendingReorders: s.pendingReorders.filter((op) => op.entry_id !== entryId),
                entryTransforms: nextT,
                entryBackgrounds: nextB,
                entryTransitions: nextX,
            };
        });
    },

    updateEntryTransform: (entryId, patch) => {
        set((s) => {
            const current = s.entryTransforms[entryId] ?? DEFAULT_TRANSFORM;
            const updated = { ...current, ...patch };
            return {
                ...pushPast(s),
                entryTransforms: { ...s.entryTransforms, [entryId]: updated },
                // Mark dirty so Save button lights up
                dirtyEntryIds: s.dirtyEntryIds.includes(entryId)
                    ? s.dirtyEntryIds
                    : [...s.dirtyEntryIds, entryId],
            };
        });
    },

    resetEntryTransform: (entryId) => {
        set((s) => {
            const next = { ...s.entryTransforms };
            delete next[entryId];
            // If HTML is also not dirty, remove from dirtyEntryIds
            const htmlAlsoDirty = s.entries.some(
                (e) => e.id === entryId && s.dirtyEntryIds.includes(entryId)
            );
            return {
                ...pushPast(s),
                entryTransforms: next,
                dirtyEntryIds: htmlAlsoDirty
                    ? s.dirtyEntryIds
                    : s.dirtyEntryIds.filter((id) => id !== entryId),
            };
        });
    },

    resizeEntryEdge: (entryId, edge, newTime, mode) => {
        set((s) => {
            if (s.meta.navigation !== 'time_driven') return {};
            const idx = s.entries.findIndex((e) => e.id === entryId);
            if (idx < 0) return {};
            const entry = s.entries[idx]!;
            const inT = entry.inTime ?? entry.start ?? 0;
            const outT = entry.exitTime ?? entry.end ?? inT + 1;

            // Normalize: quantize to 0.1s, clamp to non-negative
            const snap = (t: number) => Math.max(0, snapTime(t));

            const dirty = new Set(s.dirtyEntryIds);
            let newEntries = [...s.entries];
            let newTotal = s.meta.total_duration;

            if (mode === 'slip') {
                const proposed = snap(newTime);
                const finalTime =
                    edge === 'in'
                        ? Math.min(proposed, outT - MIN_SHOT_DURATION)
                        : Math.max(proposed, inT + MIN_SHOT_DURATION);
                newEntries[idx] = {
                    ...entry,
                    ...(edge === 'in' ? { inTime: finalTime } : { exitTime: finalTime }),
                };
                dirty.add(entryId);
            } else if (mode === 'roll') {
                const neighbour = findRollNeighbour(s.entries, entry, edge);
                if (!neighbour) {
                    // Fall back to slip — caller's UI should have detected this already.
                    const proposed = snap(newTime);
                    const finalTime =
                        edge === 'in'
                            ? Math.min(proposed, outT - MIN_SHOT_DURATION)
                            : Math.max(proposed, inT + MIN_SHOT_DURATION);
                    newEntries[idx] = {
                        ...entry,
                        ...(edge === 'in' ? { inTime: finalTime } : { exitTime: finalTime }),
                    };
                    dirty.add(entryId);
                } else {
                    const nInT = neighbour.inTime ?? neighbour.start ?? 0;
                    const nOutT = neighbour.exitTime ?? neighbour.end ?? nInT + 1;
                    // For roll, newTime becomes the shared boundary. Clamp so neither
                    // side shrinks below MIN_SHOT_DURATION.
                    let t = snap(newTime);
                    if (edge === 'out') {
                        // this.exitTime = neighbour.inTime = t
                        t = clamp(t, inT + MIN_SHOT_DURATION, nOutT - MIN_SHOT_DURATION);
                    } else {
                        // this.inTime = neighbour.exitTime = t
                        t = clamp(t, nInT + MIN_SHOT_DURATION, outT - MIN_SHOT_DURATION);
                    }
                    const nIdx = newEntries.findIndex((e) => e.id === neighbour.id);
                    newEntries[idx] = {
                        ...entry,
                        ...(edge === 'in' ? { inTime: t } : { exitTime: t }),
                    };
                    newEntries[nIdx] = {
                        ...neighbour,
                        ...(edge === 'in' ? { exitTime: t } : { inTime: t }),
                    };
                    dirty.add(entryId);
                    dirty.add(neighbour.id);
                }
            } else {
                // ripple
                const original = edge === 'in' ? inT : outT;
                const proposed = snap(newTime);
                // Clamp so this shot keeps MIN_SHOT_DURATION
                const finalTime =
                    edge === 'in'
                        ? Math.min(proposed, outT - MIN_SHOT_DURATION)
                        : Math.max(proposed, inT + MIN_SHOT_DURATION);
                const delta = finalTime - original;
                if (delta === 0) return {};

                newEntries = s.entries.map((e) => {
                    if (e.id === entryId) {
                        return {
                            ...e,
                            ...(edge === 'in' ? { inTime: finalTime } : { exitTime: finalTime }),
                        };
                    }
                    const eStart = e.inTime ?? e.start;
                    // Shift any entry whose start is >= the original boundary
                    if (eStart != null && eStart >= original) {
                        return {
                            ...e,
                            inTime: (e.inTime ?? 0) + delta,
                            exitTime: (e.exitTime ?? 0) + delta,
                        };
                    }
                    return e;
                });
                newEntries.forEach((e) => dirty.add(e.id));
                if (newTotal != null) newTotal = Math.max(0, newTotal + delta);
            }

            return {
                ...pushPast(s),
                entries: newEntries,
                dirtyEntryIds: Array.from(dirty),
                meta:
                    newTotal !== s.meta.total_duration
                        ? { ...s.meta, total_duration: newTotal }
                        : s.meta,
            };
        });
    },

    moveEntries: (ids, deltaTime, mode) => {
        set((s) => {
            if (s.meta.navigation !== 'time_driven') return {};
            const movingIds = ids.filter((id) => !id.startsWith('branding-'));
            if (movingIds.length === 0) return {};

            let delta = snapTime(deltaTime);
            if (delta === 0) return {};

            const moving = s.entries.filter((e) => movingIds.includes(e.id));
            if (moving.length === 0) return {};

            const minStart = Math.min(...moving.map((e) => e.inTime ?? e.start ?? 0));
            const totalDuration = s.meta.total_duration;

            if (minStart + delta < 0) delta = -minStart;
            if (mode === 'move' && totalDuration != null) {
                const maxEnd = Math.max(...moving.map((e) => e.exitTime ?? e.end ?? 0));
                if (maxEnd + delta > totalDuration) {
                    delta = totalDuration - maxEnd;
                }
            }
            delta = snapTime(delta);
            if (delta === 0) return {};

            // Capture the ripple boundary BEFORE mutating any entry — the
            // boundary is the latest original exitTime among the moving set.
            const rippleBoundary =
                mode === 'ripple'
                    ? Math.max(...moving.map((e) => e.exitTime ?? e.end ?? 0))
                    : Infinity;

            const movingSet = new Set(movingIds);
            const dirty = new Set(s.dirtyEntryIds);

            const newEntries = s.entries.map((e) => {
                if (movingSet.has(e.id)) {
                    dirty.add(e.id);
                    return {
                        ...e,
                        inTime: (e.inTime ?? 0) + delta,
                        exitTime: (e.exitTime ?? 0) + delta,
                    };
                }
                if (
                    mode === 'ripple' &&
                    !e.id.startsWith('branding-') &&
                    (e.inTime ?? Infinity) >= rippleBoundary
                ) {
                    dirty.add(e.id);
                    return {
                        ...e,
                        inTime: (e.inTime ?? 0) + delta,
                        exitTime: (e.exitTime ?? 0) + delta,
                    };
                }
                return e;
            });

            const nextTotal =
                mode === 'ripple' && totalDuration != null
                    ? Math.max(0, totalDuration + delta)
                    : totalDuration;

            return {
                ...pushPast(s),
                entries: newEntries,
                dirtyEntryIds: Array.from(dirty),
                meta:
                    nextTotal !== s.meta.total_duration
                        ? { ...s.meta, total_duration: nextTotal }
                        : s.meta,
            };
        });
    },

    reorderEntries: (fromIndex, toIndex) => {
        set((s) => {
            if (fromIndex === toIndex) return {};
            if (fromIndex < 0 || fromIndex >= s.entries.length) return {};
            if (toIndex < 0 || toIndex >= s.entries.length) return {};
            const moved = s.entries[fromIndex]!;
            if (moved.id.startsWith('branding-')) return {};

            const nextEntries = [...s.entries];
            nextEntries.splice(fromIndex, 1);
            nextEntries.splice(toIndex, 0, moved);

            // Queue a /frame/reorder call instead of marking entries dirty.
            // Sequential /frame/update calls would be destructive here — the
            // backend addresses frames positionally, so updating index N with
            // entry X's content overwrites whatever was at N. /frame/reorder
            // is atomic on the server (one S3 PUT of the rewritten timeline).
            //
            // If the same entry has been reordered earlier this session,
            // collapse the prior op into the latest target index.
            const filtered = s.pendingReorders.filter((op) => op.entry_id !== moved.id);
            const nextReorders: ReorderOp[] = [
                ...filtered,
                { entry_id: moved.id, to_index: toIndex },
            ];

            return {
                ...pushPast(s),
                entries: nextEntries,
                pendingReorders: nextReorders,
            };
        });
    },

    updateEntryTransition: (entryId, which, transition) => {
        set((s) => {
            const next = { ...s.entryTransitions };
            const current = next[entryId] ?? {};
            const updated: TransitionPair = { ...current };
            if (transition == null) delete updated[which];
            else updated[which] = transition;
            if (!updated.in && !updated.out) delete next[entryId];
            else next[entryId] = updated;
            return {
                ...pushPast(s),
                entryTransitions: next,
                dirtyEntryIds: s.dirtyEntryIds.includes(entryId)
                    ? s.dirtyEntryIds
                    : [...s.dirtyEntryIds, entryId],
            };
        });
    },

    updateEntryBackground: (entryId, background) => {
        set((s) => {
            const next = { ...s.entryBackgrounds };
            const normalized = background?.trim();
            if (normalized) {
                next[entryId] = normalized;
            } else {
                delete next[entryId];
            }
            return {
                ...pushPast(s),
                entryBackgrounds: next,
                dirtyEntryIds: s.dirtyEntryIds.includes(entryId)
                    ? s.dirtyEntryIds
                    : [...s.dirtyEntryIds, entryId],
            };
        });
    },

    fitAnimationsToDuration: (entryId) => {
        set((s) => {
            const entry = s.entries.find((e) => e.id === entryId);
            if (!entry) return {};
            const currentDur =
                (entry.exitTime ?? entry.end ?? 0) - (entry.inTime ?? entry.start ?? 0);
            if (currentDur <= 0) return {};
            // Natural duration: read from previously baked attribute, or session snapshot.
            const baseDur = readTimescaleBaseDur(entry.html ?? '') ?? s.naturalDurations[entryId];
            if (!baseDur || baseDur <= 0) return {};
            const speed = baseDur / currentDur;
            const newHtml = injectTimescaleScript(entry.html, speed, baseDur);
            return {
                ...pushPast(s),
                entries: s.entries.map((e) => (e.id === entryId ? { ...e, html: newHtml } : e)),
                dirtyEntryIds: s.dirtyEntryIds.includes(entryId)
                    ? s.dirtyEntryIds
                    : [...s.dirtyEntryIds, entryId],
            };
        });
    },

    undo: () => {
        set((s) => {
            if (s.past.length === 0) return {};
            const prev = s.past[s.past.length - 1]!;
            return {
                past: s.past.slice(0, -1),
                future: [snapshot(s), ...s.future.slice(0, 49)],
                entries: prev.entries,
                entryTransforms: prev.entryTransforms,
                entryBackgrounds: prev.entryBackgrounds,
                entryTransitions: prev.entryTransitions,
                dirtyEntryIds: prev.dirtyEntryIds,
                newEntryIds: prev.newEntryIds,
                deletedEntryIds: prev.deletedEntryIds,
                pendingReorders: prev.pendingReorders,
            };
        });
    },

    redo: () => {
        set((s) => {
            if (s.future.length === 0) return {};
            const next = s.future[0]!;
            return {
                past: [...s.past.slice(-49), snapshot(s)],
                future: s.future.slice(1),
                entries: next.entries,
                entryTransforms: next.entryTransforms,
                entryBackgrounds: next.entryBackgrounds,
                entryTransitions: next.entryTransitions,
                dirtyEntryIds: next.dirtyEntryIds,
                newEntryIds: next.newEntryIds,
                deletedEntryIds: next.deletedEntryIds,
                pendingReorders: next.pendingReorders,
            };
        });
    },

    setAudioTracks: (tracks) => set({ audioTracks: tracks }),
    addAudioTrack: (track) => set((s) => ({ audioTracks: [...s.audioTracks, track] })),
    updateAudioTrack: (trackId, patch) =>
        set((s) => ({
            audioTracks: s.audioTracks.map((t) => (t.id === trackId ? { ...t, ...patch } : t)),
        })),
    removeAudioTrack: (trackId) =>
        set((s) => ({ audioTracks: s.audioTracks.filter((t) => t.id !== trackId) })),

    saveChanges: async () => {
        const {
            videoId,
            apiKey,
            kind,
            entries,
            dirtyEntryIds,
            newEntryIds,
            deletedEntryIds,
            pendingReorders,
            entryTransforms,
            entryBackgrounds,
            entryTransitions,
        } = get();

        // Reels and AI-gen videos live in different DB tables, so frame
        // saves go to different endpoints. The payload shape diverges in
        // exactly one place: reels expect `reel_id` instead of `video_id`.
        const isReel = kind === 'reel';
        const frameBase = isReel
            ? `${AI_SERVICE_BASE_URL}/external/reels/v1/frame`
            : `${AI_SERVICE_BASE_URL}/external/video/v1/frame`;
        const idField = isReel ? 'reel_id' : 'video_id';

        // Collect entries that need saving
        const toSave = entries.filter(
            (e) =>
                dirtyEntryIds.includes(e.id) ||
                (entryTransforms[e.id] != null && !isIdentity(entryTransforms[e.id]!)) ||
                !!entryBackgrounds[e.id] ||
                !!entryTransitions[e.id]
        );

        if (toSave.length === 0 && deletedEntryIds.length === 0 && pendingReorders.length === 0)
            return;

        set({ isSaving: true });

        try {
            if (!apiKey) {
                set({ isSaving: false });
                throw new Error('No API key configured — changes were not saved to the server.');
            }

            // Process deletions first so frame indices used by later updates
            // refer to the post-deletion timeline. Delete by entry_id (order-
            // independent), so the order within deletedEntryIds doesn't matter.
            for (const entryId of deletedEntryIds) {
                const res = await fetch(`${frameBase}/delete`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Institute-Key': apiKey,
                    },
                    body: JSON.stringify({
                        [idField]: videoId,
                        entry_id: entryId,
                    }),
                });
                if (!res.ok) {
                    const text = await res.text().catch(() => res.statusText);
                    throw new Error(`Delete frame failed (${entryId}): ${text}`);
                }
            }

            // Process reorders after deletes (deleted entries are already
            // gone from pendingReorders via deleteEntry's filter) and before
            // adds/updates (so subsequent /frame/update frame_index values
            // line up with the post-reorder server-side positions).
            // /frame/reorder is atomic on the server; sequential single-frame
            // updates would destroy entries at the target positions, which is
            // why we route through this dedicated endpoint.
            for (const op of pendingReorders) {
                const res = await fetch(`${frameBase}/reorder`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Institute-Key': apiKey,
                    },
                    body: JSON.stringify({
                        [idField]: videoId,
                        entry_id: op.entry_id,
                        to_index: op.to_index,
                    }),
                });
                if (!res.ok) {
                    const text = await res.text().catch(() => res.statusText);
                    throw new Error(`Reorder frame failed (${op.entry_id}): ${text}`);
                }
            }

            // Send to backend sequentially to avoid S3 concurrent-write race (C26).
            // New entries (never persisted) use frame/add; existing use frame/update.
            for (const entry of toSave) {
                const t = entryTransforms[entry.id];
                const bg = entryBackgrounds[entry.id];
                const tr = entryTransitions[entry.id];
                const dur =
                    entry.inTime != null && entry.exitTime != null
                        ? entry.exitTime - entry.inTime
                        : undefined;
                const newHtml = injectShotWrapper(entry.html, t, bg, tr, dur);
                const isNew = newEntryIds.includes(entry.id);

                if (isNew) {
                    // Same entry_meta logic as the /frame/update branch: send
                    // the display name (including empty string for "clear")
                    // when the user has touched it. Skipped entirely when
                    // there's no rename so we don't bloat the timeline JSON
                    // with empty entry_meta objects for plain new shots.
                    const pendingNameAdd = useVideoEditorStore.getState().displayNames[entry.id];
                    const addEntryMetaPayload: Record<string, unknown> | undefined =
                        pendingNameAdd !== undefined ? { display_name: pendingNameAdd } : undefined;

                    const res = await fetch(`${frameBase}/add`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Institute-Key': apiKey,
                        },
                        body: JSON.stringify({
                            [idField]: videoId,
                            html: newHtml,
                            in_time: entry.inTime ?? entry.start ?? null,
                            exit_time: entry.exitTime ?? entry.end ?? null,
                            z: entry.z ?? 0,
                            entry_id: entry.id,
                            ...(addEntryMetaPayload ? { entry_meta: addEntryMetaPayload } : {}),
                        }),
                    });
                    if (!res.ok) {
                        const text = await res.text().catch(() => res.statusText);
                        throw new Error(`Add frame failed: ${text}`);
                    }
                } else {
                    const frameIndex = entries.indexOf(entry);
                    // Build entry_meta payload for the server. Includes any
                    // pending display-name override; empty string explicitly
                    // clears the override (server treats empty as "drop the
                    // key"). When there's nothing rename-related to send, omit
                    // the field entirely so we don't trigger an unnecessary
                    // entry_meta merge round-trip on every HTML edit.
                    const pendingName = useVideoEditorStore.getState().displayNames[entry.id];
                    const entryMetaPayload: Record<string, unknown> | undefined =
                        pendingName !== undefined ? { display_name: pendingName ?? '' } : undefined;

                    const res = await fetch(`${frameBase}/update`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Institute-Key': apiKey,
                        },
                        body: JSON.stringify({
                            [idField]: videoId,
                            frame_index: frameIndex,
                            new_html: newHtml,
                            in_time: entry.inTime ?? entry.start ?? null,
                            exit_time: entry.exitTime ?? entry.end ?? null,
                            z: entry.z ?? 0,
                            entry_id: entry.id,
                            ...(entryMetaPayload ? { entry_meta: entryMetaPayload } : {}),
                        }),
                    });
                    if (!res.ok) {
                        const text = await res.text().catch(() => res.statusText);
                        throw new Error(`Frame ${frameIndex}: ${text}`);
                    }
                }
            }

            // Bake transforms + backgrounds + transitions into local entry HTML
            set((s) => ({
                entries: s.entries.map((e) => {
                    const t = s.entryTransforms[e.id];
                    const bg = s.entryBackgrounds[e.id];
                    const tr = s.entryTransitions[e.id];
                    const hasT = t && !isIdentity(t);
                    if (!hasT && !bg && !tr) return e;
                    const dur =
                        e.inTime != null && e.exitTime != null ? e.exitTime - e.inTime : undefined;
                    return { ...e, html: injectShotWrapper(e.html, t, bg, tr, dur) };
                }),
                entryTransforms: {},
                entryBackgrounds: {},
                entryTransitions: {},
                dirtyEntryIds: [],
                newEntryIds: [], // all new entries are now persisted
                deletedEntryIds: [], // server-side deletions completed above
                pendingReorders: [], // server-side reorders completed above
                past: [],
                future: [],
                isSaving: false,
            }));
            // Display-name overrides are now reflected server-side in
            // entry_meta. Clear the localStorage offline buffer so the next
            // reload pulls names from the server. The in-memory
            // `displayNames` map stays intact — it matches the server and
            // continues to drive the UI without a reload.
            try {
                window.localStorage.removeItem(DISPLAY_NAMES_LS_PREFIX + videoId);
            } catch {
                /* private mode — fine */
            }
        } catch (err) {
            set({ isSaving: false });
            throw err;
        }
    },

    regenerateSentence: async (sentenceId, newText) => {
        const { videoId, apiKey, regeneratingSentenceId, meta } = get();
        if (regeneratingSentenceId) {
            return { ok: false, error: 'Another sentence is already regenerating' };
        }
        if (!videoId || !apiKey) {
            return { ok: false, error: 'Video not initialized' };
        }
        const sentences = meta.sentences ?? [];
        const targetIdx = sentences.findIndex((s) => s.id === sentenceId);
        if (targetIdx === -1) {
            return { ok: false, error: `Sentence ${sentenceId} not found` };
        }
        const trimmed = newText.trim();
        if (!trimmed) {
            return { ok: false, error: 'Text cannot be empty' };
        }
        if (trimmed === sentences[targetIdx]?.text.trim()) {
            return { ok: false, error: 'Text unchanged — nothing to re-narrate' };
        }

        set({ regeneratingSentenceId: sentenceId });
        // Lazy import: keeps the API module out of any cold-start path that
        // doesn't actually use sentence editing.
        const { apiRegenerateSentence } = await import('../utils/sentence-api');
        const result = await apiRegenerateSentence(videoId, apiKey, sentenceId, trimmed);

        if (!result.ok) {
            set({ regeneratingSentenceId: null });
            return { ok: false, error: result.error };
        }

        const { sentence: updatedSentence, duration_delta, new_global_audio_url } = result.data;
        set((s) => {
            // Splice boundary == old sentence's start_time. Anything starting
            // at or after that point ripples by `duration_delta`. Server has
            // already applied this same ripple to the persisted timeline JSON.
            const oldStart = sentences[targetIdx]?.start_time ?? updatedSentence.start_time;
            const epsilon = 1e-3;
            const updatedSentences = (s.meta.sentences ?? []).map((sent, i) => {
                if (i === targetIdx) return updatedSentence;
                if (i > targetIdx) {
                    return { ...sent, start_time: sent.start_time + duration_delta };
                }
                return sent;
            });
            const updatedEntries = s.entries.map((e) => {
                const next = { ...e };
                let mutated = false;
                if (e.inTime != null && e.inTime >= oldStart - epsilon) {
                    next.inTime = e.inTime + duration_delta;
                    mutated = true;
                }
                if (e.exitTime != null && e.exitTime >= oldStart - epsilon) {
                    next.exitTime = e.exitTime + duration_delta;
                    mutated = true;
                }
                return mutated ? next : e;
            });
            const newTotal =
                s.meta.total_duration != null
                    ? Math.max(0, s.meta.total_duration + duration_delta)
                    : s.meta.total_duration;
            return {
                regeneratingSentenceId: null,
                audioUrl: new_global_audio_url || s.audioUrl,
                meta: {
                    ...s.meta,
                    sentences: updatedSentences,
                    total_duration: newTotal,
                },
                entries: updatedEntries,
            };
        });
        return { ok: true };
    },

    silenceSentence: async (sentenceId) => {
        const { videoId, apiKey, regeneratingSentenceId, meta } = get();
        if (regeneratingSentenceId) {
            return { ok: false, error: 'Another sentence is already being modified' };
        }
        if (!videoId || !apiKey) {
            return { ok: false, error: 'Video not initialized' };
        }
        const sentences = meta.sentences ?? [];
        const targetIdx = sentences.findIndex((s) => s.id === sentenceId);
        if (targetIdx === -1) {
            return { ok: false, error: `Sentence ${sentenceId} not found` };
        }

        // Reuse the same in-flight flag as regenerateSentence — both are
        // exclusive operations on the same audio file and shouldn't run
        // concurrently. The popover treats `regeneratingSentenceId` as
        // "this sentence is busy" regardless of which mutation it is.
        set({ regeneratingSentenceId: sentenceId });
        const { apiSilenceSentence } = await import('../utils/sentence-api');
        const result = await apiSilenceSentence(videoId, apiKey, sentenceId);

        if (!result.ok) {
            set({ regeneratingSentenceId: null });
            return { ok: false, error: result.error };
        }

        const { sentence: silencedSentence, new_global_audio_url } = result.data;
        // Silence preserves total length, so no entry/sentence ripple —
        // only the target sentence and the global audio URL change.
        set((s) => ({
            regeneratingSentenceId: null,
            audioUrl: new_global_audio_url || s.audioUrl,
            meta: {
                ...s.meta,
                sentences: (s.meta.sentences ?? []).map((sent, i) =>
                    i === targetIdx ? silencedSentence : sent
                ),
            },
        }));
        return { ok: true };
    },

    insertShot: async (gap, userHint) => {
        const { videoId, apiKey, insertingGapKey } = get();
        if (insertingGapKey) {
            return { ok: false, error: 'Another shot is already being generated' };
        }
        if (!videoId || !apiKey) {
            return { ok: false, error: 'Video not initialized' };
        }
        if (!(gap.end > gap.start)) {
            return { ok: false, error: 'Invalid gap range' };
        }

        set({ insertingGapKey: gap.key });
        const { apiInsertShot } = await import('../utils/sentence-api');
        const result = await apiInsertShot(
            videoId,
            apiKey,
            gap.start,
            gap.end,
            userHint?.trim() || null
        );

        if (!result.ok) {
            set({ insertingGapKey: null });
            return { ok: false, error: result.error };
        }

        const { entry } = result.data;
        set((s) => {
            // Insert sorted by inTime so the entries list stays ordered —
            // matches how the server persisted it.
            const inserted = entry.inTime ?? entry.start ?? gap.start;
            const next: Entry[] = [];
            let placed = false;
            for (const e of s.entries) {
                const eStart = e.inTime ?? e.start ?? 0;
                if (!placed && inserted < eStart) {
                    next.push(entry);
                    placed = true;
                }
                next.push(e);
            }
            if (!placed) next.push(entry);
            return {
                ...pushPast(s),
                insertingGapKey: null,
                entries: next,
                // Track as new + dirty so saveChanges calls frame/add.
                newEntryIds: s.newEntryIds.includes(entry.id)
                    ? s.newEntryIds
                    : [...s.newEntryIds, entry.id],
                dirtyEntryIds: s.dirtyEntryIds.includes(entry.id)
                    ? s.dirtyEntryIds
                    : [...s.dirtyEntryIds, entry.id],
                selectedEntryId: entry.id,
            };
        });
        return { ok: true };
    },
}));
