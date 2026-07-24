/**
 * Reactive view over the local slide-draft store (unsaved edits kept in
 * localStorage). Re-reads when a draft is written/removed in this tab
 * (SLIDE_DRAFTS_CHANGED_EVENT) or another tab (native `storage` event).
 *
 * The continuous editor stash rewrites the active draft every ~500ms, so the
 * hook fingerprints what consumers actually render (membership + labels) and
 * keeps the previous state reference when nothing visible changed — badge
 * consumers don't re-render on every keystroke.
 */
import { useCallback, useEffect, useState } from 'react';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import {
    SLIDE_DRAFTS_CHANGED_EVENT,
    SlideDraft,
    listCourseDrafts,
    listDrafts,
} from '../-utils/slide-draft-store';

/** The userId key the draft store is partitioned by (JWT sub). */
export function getDraftUserId(): string {
    try {
        const token = getTokenFromCookie(TokenKey.accessToken);
        return (token ? getTokenDecodedData(token)?.sub : null) || 'anonymous';
    } catch {
        return 'anonymous';
    }
}

interface SlideDraftsView {
    /** Drafts in scope (course-scoped when courseId is given, else all). */
    drafts: SlideDraft[];
    /** slideIds of those drafts, for O(1) badge lookups. */
    dirtySlideIds: Set<string>;
}

function fingerprintOf(drafts: SlideDraft[]): string {
    return drafts
        .map((d) => `${d.slideId}|${d.context?.slideTitle ?? ''}|${d.context?.chapterId ?? ''}`)
        .sort()
        .join('~');
}

export function useSlideDrafts(userId: string, courseId?: string): SlideDraftsView {
    const read = useCallback(
        (): SlideDraft[] => (courseId ? listCourseDrafts(userId, courseId) : listDrafts(userId)),
        [userId, courseId]
    );

    const [view, setView] = useState<SlideDraftsView>(() => {
        const drafts = read();
        return { drafts, dirtySlideIds: new Set(drafts.map((d) => d.slideId)) };
    });

    useEffect(() => {
        const refresh = () => {
            setView((prev) => {
                const drafts = read();
                if (fingerprintOf(drafts) === fingerprintOf(prev.drafts)) return prev;
                return { drafts, dirtySlideIds: new Set(drafts.map((d) => d.slideId)) };
            });
        };
        refresh(); // scope (userId/courseId) may have changed since initial state
        window.addEventListener(SLIDE_DRAFTS_CHANGED_EVENT, refresh);
        window.addEventListener('storage', refresh);
        return () => {
            window.removeEventListener(SLIDE_DRAFTS_CHANGED_EVENT, refresh);
            window.removeEventListener('storage', refresh);
        };
    }, [read]);

    return view;
}
