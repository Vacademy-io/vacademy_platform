import { create } from 'zustand';
import {
    Entry,
    TimelineMeta,
    AudioTrack,
    getDefaultMeta,
} from '@/components/ai-video-player/types';
import { AI_SERVICE_BASE_URL } from '@/constants/urls';

export interface InitParams {
    videoId: string;
    htmlUrl: string;
    audioUrl?: string;
    wordsUrl?: string;
    avatarUrl?: string;
    apiKey?: string;
    orientation?: string;
}

export interface EntryTransform {
    x: number; // canvas-space pixel offset from center
    y: number;
    scale: number; // 1.0 = 100%
    rotation: number; // degrees
}

export const DEFAULT_TRANSFORM: EntryTransform = { x: 0, y: 0, scale: 1, rotation: 0 };

function isIdentity(t: EntryTransform): boolean {
    return t.x === 0 && t.y === 0 && t.scale === 1 && t.rotation === 0;
}

/**
 * Shot wrapper: a single outer <div> that carries per-shot visual state
 * (transform, background) baked into the saved HTML. Marked with
 * data-vx-shot="1" so we can recognize and rewrite it idempotently.
 */
const SHOT_WRAPPER_OPEN_RE = /^<div\s+data-vx-shot="1"\s+style="[^"]*">/;
const LEGACY_TRANSFORM_WRAPPER_RE =
    /^<div style="position:absolute;inset:0;transform:[^"]*;transform-origin:center center;overflow:visible;">([\s\S]*)<\/div>$/;

/** Strip any previously baked wrapper so we never double-wrap on re-save. */
function stripShotWrapper(html: string): string {
    if (SHOT_WRAPPER_OPEN_RE.test(html) && html.endsWith('</div>')) {
        return html.replace(SHOT_WRAPPER_OPEN_RE, '').slice(0, -'</div>'.length);
    }
    const legacy = html.match(LEGACY_TRANSFORM_WRAPPER_RE);
    return legacy ? (legacy[1] ?? html) : html;
}

function injectShotWrapper(
    html: string,
    t: EntryTransform | undefined,
    background: string | undefined
): string {
    const inner = stripShotWrapper(html);
    const hasTransform = t && !isIdentity(t);
    const hasBackground = !!background && background.trim() !== '';
    if (!hasTransform && !hasBackground) return inner;

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
    return `<div data-vx-shot="1" style="${styles.join(';')}">${inner}</div>`;
}

interface HistorySnapshot {
    entries: Entry[];
    entryTransforms: Record<string, EntryTransform>;
    entryBackgrounds: Record<string, string>;
    dirtyEntryIds: string[];
    newEntryIds: string[];
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

    // Timeline data
    entries: Entry[];
    meta: TimelineMeta;
    isLoading: boolean;
    error: string | null;

    // Scrub state (seconds for time_driven; index for user_driven)
    currentTime: number;

    // Selection
    selectedEntryId: string | null;

    // Mode
    isPreviewMode: boolean;

    // Dirty tracking (HTML edits)
    dirtyEntryIds: string[];
    /** IDs of entries that are brand-new and have never been saved to the backend. */
    newEntryIds: string[];

    // Extra audio tracks (background music, SFX, etc.)
    audioTracks: AudioTrack[];

    // Per-entry CSS transforms (client-side; baked into HTML on save)
    entryTransforms: Record<string, EntryTransform>;

    // Per-entry background color / CSS value (client-side; baked into HTML on save)
    entryBackgrounds: Record<string, string>;

    // Undo/Redo history
    past: HistorySnapshot[];
    future: HistorySnapshot[];

    // Save state
    isSaving: boolean;

    // Actions
    init: (params: InitParams) => void;
    loadTimeline: () => Promise<void>;
    seek: (time: number) => void;
    selectEntry: (id: string | null) => void;
    togglePreviewMode: () => void;
    updateEntryHtml: (entryId: string, newHtml: string) => void;
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
    undo: () => void;
    redo: () => void;
    saveChanges: () => Promise<void>;
}

function snapshot(s: VideoEditorState): HistorySnapshot {
    return {
        entries: s.entries,
        entryTransforms: s.entryTransforms,
        entryBackgrounds: s.entryBackgrounds,
        dirtyEntryIds: s.dirtyEntryIds,
        newEntryIds: s.newEntryIds,
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
    entries: [],
    meta: getDefaultMeta('VIDEO'),
    isLoading: false,
    error: null,
    currentTime: 0,
    selectedEntryId: null,
    isPreviewMode: false,
    dirtyEntryIds: [],
    newEntryIds: [],
    audioTracks: [],
    entryTransforms: {},
    entryBackgrounds: {},
    past: [],
    future: [],
    isSaving: false,

    init: (params) => {
        set({
            videoId: params.videoId,
            htmlUrl: params.htmlUrl,
            audioUrl: params.audioUrl,
            wordsUrl: params.wordsUrl,
            avatarUrl: params.avatarUrl,
            apiKey: params.apiKey,
            orientation: params.orientation ?? 'landscape',
            entries: [],
            meta: getDefaultMeta('VIDEO'),
            isLoading: false,
            error: null,
            currentTime: 0,
            selectedEntryId: null,
            isPreviewMode: false,
            dirtyEntryIds: [],
            newEntryIds: [],
            audioTracks: [],
            entryTransforms: {},
            entryBackgrounds: {},
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

            set({ entries, meta, audioTracks: meta.audio_tracks ?? [], isLoading: false });
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : 'Failed to load timeline',
                isLoading: false,
            });
        }
    },

    seek: (time) => set({ currentTime: time }),

    selectEntry: (id) => set({ selectedEntryId: id }),

    togglePreviewMode: () =>
        set((s) => ({ isPreviewMode: !s.isPreviewMode, selectedEntryId: null })),

    updateEntryHtml: (entryId, newHtml) => {
        set((s) => ({
            ...pushPast(s),
            entries: s.entries.map((e) => (e.id === entryId ? { ...e, html: newHtml } : e)),
            dirtyEntryIds: s.dirtyEntryIds.includes(entryId)
                ? s.dirtyEntryIds
                : [...s.dirtyEntryIds, entryId],
        }));
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
            return {
                ...pushPast(s),
                entries: s.entries.filter((e) => e.id !== entryId),
                selectedEntryId: s.selectedEntryId === entryId ? null : s.selectedEntryId,
                dirtyEntryIds: s.dirtyEntryIds.filter((id) => id !== entryId),
                newEntryIds: s.newEntryIds.filter((id) => id !== entryId),
                entryTransforms: nextT,
                entryBackgrounds: nextB,
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
                dirtyEntryIds: prev.dirtyEntryIds,
                newEntryIds: prev.newEntryIds,
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
                dirtyEntryIds: next.dirtyEntryIds,
                newEntryIds: next.newEntryIds,
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
            entries,
            dirtyEntryIds,
            newEntryIds,
            entryTransforms,
            entryBackgrounds,
        } = get();

        // Collect entries that need saving
        const toSave = entries.filter(
            (e) =>
                dirtyEntryIds.includes(e.id) ||
                (entryTransforms[e.id] != null && !isIdentity(entryTransforms[e.id]!)) ||
                !!entryBackgrounds[e.id]
        );

        if (toSave.length === 0) return;

        set({ isSaving: true });

        try {
            if (!apiKey) {
                set({ isSaving: false });
                throw new Error('No API key configured — changes were not saved to the server.');
            }

            // Send to backend sequentially to avoid S3 concurrent-write race (C26).
            // New entries (never persisted) use frame/add; existing use frame/update.
            for (const entry of toSave) {
                const t = entryTransforms[entry.id];
                const bg = entryBackgrounds[entry.id];
                const newHtml = injectShotWrapper(entry.html, t, bg);
                const isNew = newEntryIds.includes(entry.id);

                if (isNew) {
                    const res = await fetch(`${AI_SERVICE_BASE_URL}/external/video/v1/frame/add`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Institute-Key': apiKey,
                        },
                        body: JSON.stringify({
                            video_id: videoId,
                            html: newHtml,
                            in_time: entry.inTime ?? entry.start ?? null,
                            exit_time: entry.exitTime ?? entry.end ?? null,
                            z: entry.z ?? 0,
                            entry_id: entry.id,
                        }),
                    });
                    if (!res.ok) {
                        const text = await res.text().catch(() => res.statusText);
                        throw new Error(`Add frame failed: ${text}`);
                    }
                } else {
                    const frameIndex = entries.indexOf(entry);
                    const res = await fetch(
                        `${AI_SERVICE_BASE_URL}/external/video/v1/frame/update`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Institute-Key': apiKey,
                            },
                            body: JSON.stringify({
                                video_id: videoId,
                                frame_index: frameIndex,
                                new_html: newHtml,
                            }),
                        }
                    );
                    if (!res.ok) {
                        const text = await res.text().catch(() => res.statusText);
                        throw new Error(`Frame ${frameIndex}: ${text}`);
                    }
                }
            }

            // Bake transforms + backgrounds into local entry HTML so canvas re-renders correctly
            set((s) => ({
                entries: s.entries.map((e) => {
                    const t = s.entryTransforms[e.id];
                    const bg = s.entryBackgrounds[e.id];
                    const hasT = t && !isIdentity(t);
                    if (!hasT && !bg) return e;
                    return { ...e, html: injectShotWrapper(e.html, t, bg) };
                }),
                entryTransforms: {},
                entryBackgrounds: {},
                dirtyEntryIds: [],
                newEntryIds: [], // all new entries are now persisted
                past: [],
                future: [],
                isSaving: false,
            }));
        } catch (err) {
            set({ isSaving: false });
            throw err;
        }
    },
}));
