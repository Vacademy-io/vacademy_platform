import { create } from 'zustand';
import { Entry, TimelineMeta, getDefaultMeta } from '@/components/ai-video-player/types';
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

function injectTransformWrapper(html: string, t: EntryTransform): string {
    const transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale}) rotate(${t.rotation}deg)`;
    return `<div style="position:absolute;inset:0;transform:${transform};transform-origin:center center;overflow:visible;">${html}</div>`;
}

interface HistorySnapshot {
    entries: Entry[];
    entryTransforms: Record<string, EntryTransform>;
    dirtyEntryIds: string[];
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

    // Per-entry CSS transforms (client-side; baked into HTML on save)
    entryTransforms: Record<string, EntryTransform>;

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
    /** Phase 4: append a new entry to the local timeline */
    addEntry: (entry: Entry) => void;
    /** Delete an entry from the timeline */
    deleteEntry: (entryId: string) => void;
    updateEntryTransform: (entryId: string, patch: Partial<EntryTransform>) => void;
    resetEntryTransform: (entryId: string) => void;
    undo: () => void;
    redo: () => void;
    saveChanges: () => Promise<void>;
}

function snapshot(s: VideoEditorState): HistorySnapshot {
    return {
        entries: s.entries,
        entryTransforms: s.entryTransforms,
        dirtyEntryIds: s.dirtyEntryIds,
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
    entryTransforms: {},
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
            entryTransforms: {},
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

            set({ entries, meta, isLoading: false });
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
            selectedEntryId: entry.id,
        }));
    },

    deleteEntry: (entryId) => {
        set((s) => {
            const next = { ...s.entryTransforms };
            delete next[entryId];
            return {
                ...pushPast(s),
                entries: s.entries.filter((e) => e.id !== entryId),
                selectedEntryId: s.selectedEntryId === entryId ? null : s.selectedEntryId,
                dirtyEntryIds: s.dirtyEntryIds.filter((id) => id !== entryId),
                entryTransforms: next,
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

    undo: () => {
        set((s) => {
            if (s.past.length === 0) return {};
            const prev = s.past[s.past.length - 1]!;
            return {
                past: s.past.slice(0, -1),
                future: [snapshot(s), ...s.future.slice(0, 49)],
                entries: prev.entries,
                entryTransforms: prev.entryTransforms,
                dirtyEntryIds: prev.dirtyEntryIds,
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
                dirtyEntryIds: next.dirtyEntryIds,
            };
        });
    },

    saveChanges: async () => {
        const { videoId, apiKey, entries, dirtyEntryIds, entryTransforms } = get();

        // Collect entries that need saving
        const toSave = entries.filter(
            (e) =>
                dirtyEntryIds.includes(e.id) ||
                (entryTransforms[e.id] != null && !isIdentity(entryTransforms[e.id]!))
        );

        if (toSave.length === 0) return;

        set({ isSaving: true });

        try {
            if (apiKey) {
                // Send to backend
                await Promise.all(
                    toSave.map(async (entry) => {
                        const frameIndex = entries.indexOf(entry);
                        const t = entryTransforms[entry.id];
                        const newHtml =
                            t && !isIdentity(t)
                                ? injectTransformWrapper(entry.html, t)
                                : entry.html;

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
                    })
                );
            }

            // Bake transforms into local entry HTML so canvas re-renders correctly
            set((s) => ({
                entries: s.entries.map((e) => {
                    const t = s.entryTransforms[e.id];
                    if (!t || isIdentity(t)) return e;
                    return { ...e, html: injectTransformWrapper(e.html, t) };
                }),
                entryTransforms: {},
                dirtyEntryIds: [],
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
