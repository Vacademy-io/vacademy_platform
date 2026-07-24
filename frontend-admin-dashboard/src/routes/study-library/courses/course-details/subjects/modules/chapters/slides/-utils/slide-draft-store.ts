/**
 * Local (browser) persistence of UNSAVED slide edits.
 *
 * Autosave-to-the-DB is gone; edits live in React state and are explicitly
 * committed via Save draft / Publish. To make sure nothing is silently lost when
 * the author switches slides, refreshes, or the tab crashes, we mirror the
 * in-progress edit into this store, keyed per user + slide. The entry is removed
 * the moment the edit is Saved/Published to the DB or explicitly Discarded.
 *
 * Backed by localStorage today (slide bodies are ~10–60 KB of HTML — well under
 * the ~5 MB budget for dozens of dirty slides). Everything goes through the tiny
 * `backend` object below so we can swap to IndexedDB later without touching callers.
 */

/**
 * Where the drafted slide lives in the course hierarchy, captured at stash time.
 * Powers the course-scoped "unsaved changes" dialog (names + grouping) and the
 * deep link back to the slide — without it a draft is an opaque slideId that
 * can't be named, grouped, or jumped to from another chapter.
 */
export interface SlideDraftContext {
    slideTitle?: string | null;
    chapterId?: string | null;
    chapterName?: string | null;
    moduleId?: string | null;
    moduleName?: string | null;
    subjectId?: string | null;
    subjectName?: string | null;
    courseId?: string | null;
    courseName?: string | null;
    /** Extra route params needed to deep-link to the slide. */
    levelId?: string | null;
    sessionId?: string | null;
}

export interface SlideDraft<T = unknown> {
    slideId: string;
    /** The editor payload — HTML string, Excalidraw JSON, code data, etc. */
    content: T;
    /** Cheap hash of `content`, used for dirty comparison without deep-equals. */
    contentHash: string;
    /**
     * The server `updated_at` (or equivalent) the draft was derived from. On load
     * we compare it against the current server value to detect that the slide was
     * changed elsewhere (another tab / another user) while this draft sat unsaved.
     */
    baselineUpdatedAt?: string | null;
    /** epoch ms when this draft was last written locally. */
    savedAt: number;
    /** Hierarchy metadata for scoping/labelling. Absent on legacy drafts. */
    context?: SlideDraftContext;
}

/**
 * Fired on window whenever a draft is written or removed, so badge/dialog
 * consumers re-read without polling. Same-tab only — cross-tab updates ride the
 * browser's native `storage` event; listen to both.
 */
export const SLIDE_DRAFTS_CHANGED_EVENT = 'slide-drafts-changed';

function emitDraftsChanged(): void {
    try {
        window.dispatchEvent(new CustomEvent(SLIDE_DRAFTS_CHANGED_EVENT));
    } catch {
        /* SSR / test envs without window — ignore */
    }
}

const PREFIX = 'slideDraft';
/** Drafts older than this are pruned on load — stale local work we never committed. */
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function keyFor(userId: string, slideId: string): string {
    return `${PREFIX}:${userId}:${slideId}`;
}

/** Stable, collision-cheap hash (djb2) as `${length}:${base36}` — enough for dirty checks. */
export function hashContent(content: unknown): string {
    const str = typeof content === 'string' ? content : JSON.stringify(content ?? '');
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    }
    return `${str.length}:${(h >>> 0).toString(36)}`;
}

// Thin storage adapter. Swap the body for IndexedDB (idb/localForage) if drafts
// ever outgrow localStorage; the exported API below stays identical.
const backend = {
    get(key: string): string | null {
        try {
            return window.localStorage.getItem(key);
        } catch {
            return null;
        }
    },
    set(key: string, value: string): boolean {
        try {
            window.localStorage.setItem(key, value);
            return true;
        } catch {
            // Quota exceeded / storage disabled — fail soft; the in-memory dirty
            // state still protects against silent loss within the session.
            return false;
        }
    },
    remove(key: string): void {
        try {
            window.localStorage.removeItem(key);
        } catch {
            /* ignore */
        }
    },
    keys(): string[] {
        try {
            return Object.keys(window.localStorage);
        } catch {
            return [];
        }
    },
};

export function saveDraft<T>(
    userId: string,
    slideId: string,
    content: T,
    baselineUpdatedAt?: string | null,
    context?: SlideDraftContext
): SlideDraft<T> {
    // Carry forward the previous stash's context when the caller doesn't pass
    // one, so a code path that can't cheaply rebuild it never strips metadata.
    const prior = context ? null : loadDraft<T>(userId, slideId);
    const draft: SlideDraft<T> = {
        slideId,
        content,
        contentHash: hashContent(content),
        baselineUpdatedAt: baselineUpdatedAt ?? null,
        savedAt: Date.now(),
        context: context ?? prior?.context,
    };
    backend.set(keyFor(userId, slideId), JSON.stringify(draft));
    emitDraftsChanged();
    return draft;
}

export function loadDraft<T = unknown>(userId: string, slideId: string): SlideDraft<T> | null {
    const raw = backend.get(keyFor(userId, slideId));
    if (!raw) return null;
    try {
        return JSON.parse(raw) as SlideDraft<T>;
    } catch {
        backend.remove(keyFor(userId, slideId));
        return null;
    }
}

export function removeDraft(userId: string, slideId: string): void {
    backend.remove(keyFor(userId, slideId));
    emitDraftsChanged();
}

export function hasDraft(userId: string, slideId: string): boolean {
    return backend.get(keyFor(userId, slideId)) != null;
}

/** All drafts for a user (used to render dirty badges + a global "N unsaved" count). */
export function listDrafts<T = unknown>(userId: string): SlideDraft<T>[] {
    const wanted = `${PREFIX}:${userId}:`;
    const out: SlideDraft<T>[] = [];
    for (const key of backend.keys()) {
        if (!key.startsWith(wanted)) continue;
        const raw = backend.get(key);
        if (!raw) continue;
        try {
            out.push(JSON.parse(raw) as SlideDraft<T>);
        } catch {
            backend.remove(key);
        }
    }
    return out;
}

/** The set of slideIds that currently have a locally-persisted unsaved draft. */
export function dirtySlideIds(userId: string): Set<string> {
    return new Set(listDrafts(userId).map((d) => d.slideId));
}

/**
 * Drafts belonging to one course. Legacy drafts without context metadata are
 * excluded — they can't be named or navigated to, and age out via pruning.
 */
export function listCourseDrafts<T = unknown>(userId: string, courseId: string): SlideDraft<T>[] {
    if (!courseId) return [];
    return listDrafts<T>(userId).filter((d) => d.context?.courseId === courseId);
}

/** Drop drafts older than MAX_AGE_MS. Call once on mount. */
export function pruneOldDrafts(userId: string): void {
    const wanted = `${PREFIX}:${userId}:`;
    const cutoff = Date.now() - MAX_AGE_MS;
    let removedAny = false;
    for (const key of backend.keys()) {
        if (!key.startsWith(wanted)) continue;
        const raw = backend.get(key);
        if (!raw) continue;
        try {
            const draft = JSON.parse(raw) as SlideDraft;
            if (typeof draft.savedAt !== 'number' || draft.savedAt < cutoff) {
                backend.remove(key);
                removedAny = true;
            }
        } catch {
            backend.remove(key);
            removedAny = true;
        }
    }
    if (removedAny) emitDraftsChanged();
}
