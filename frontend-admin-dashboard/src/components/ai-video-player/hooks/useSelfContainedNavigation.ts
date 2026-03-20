/**
 * Self-Contained Navigation Hook
 * For INTERACTIVE_GAME, SIMULATION, CODE_PLAYGROUND
 * Single entry with all interactivity within the HTML itself
 */

import { useMemo } from 'react';
import { Entry, TimelineMeta } from '../types';

interface UseSelfContainedNavigationProps {
    entries: Entry[];
    meta: TimelineMeta;
}

interface UseSelfContainedNavigationReturn {
    entry: Entry | null;
    hasContent: boolean;
}

export function useSelfContainedNavigation({
    entries,
}: UseSelfContainedNavigationProps): UseSelfContainedNavigationReturn {
    // Self-contained content uses only the first entry
    const entry = useMemo(() => entries[0] || null, [entries]);

    return {
        entry,
        hasContent: !!entry,
    };
}
