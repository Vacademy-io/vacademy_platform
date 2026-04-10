import { Entry } from '@/components/ai-video-player/types';

export interface TrackEntry {
    entry: Entry;
    track: number;
}

/**
 * Greedy interval-scheduling algorithm: assigns each entry to the lowest
 * track where no current occupant overlaps with it.
 *
 * Entries without timing (user_driven) all go to track 0 in order.
 */
export function assignTracks(entries: Entry[]): TrackEntry[] {
    const hasTimings = entries.some((e) => e.inTime !== undefined || e.start !== undefined);

    if (!hasTimings) {
        return entries.map((entry) => ({ entry, track: 0 }));
    }

    const sorted = [...entries].sort((a, b) => {
        const aStart = a.inTime ?? a.start ?? 0;
        const bStart = b.inTime ?? b.start ?? 0;
        return aStart - bStart;
    });

    // trackEnds[i] = exitTime of the last entry placed on track i
    const trackEnds: number[] = [];
    const result: TrackEntry[] = [];

    for (const entry of sorted) {
        const start = entry.inTime ?? entry.start ?? 0;
        const end = entry.exitTime ?? entry.end ?? Infinity;

        let assigned = -1;
        for (let t = 0; t < trackEnds.length; t++) {
            if ((trackEnds[t] ?? 0) <= start) {
                assigned = t;
                break;
            }
        }

        if (assigned === -1) {
            assigned = trackEnds.length;
            trackEnds.push(end);
        } else {
            trackEnds[assigned] = end;
        }

        result.push({ entry, track: assigned });
    }

    return result;
}

/** Visual color per entry category */
export function getEntryColor(entryId: string, z?: number): string {
    if (entryId.startsWith('branding-intro') || entryId.startsWith('branding-outro')) {
        return '#52525b'; // zinc-600
    }
    if (entryId.startsWith('branding-watermark') || entryId.startsWith('branding')) {
        return '#3f3f46'; // zinc-700
    }
    if (entryId.startsWith('user-overlay')) {
        return '#b45309'; // amber-700
    }
    if ((z ?? 0) >= 9000) return '#52525b';
    if ((z ?? 0) >= 500) return '#6d28d9'; // violet-700
    return '#1d4ed8'; // blue-700 — main content
}

/**
 * Derive total video duration.
 * Falls back to scanning entries' exitTime if meta doesn't have it.
 */
export function computeTotalDuration(entries: Entry[], metaDuration?: number | null): number {
    if (metaDuration && metaDuration > 0) return metaDuration;

    const hasTimings = entries.some((e) => e.inTime !== undefined || e.start !== undefined);
    if (!hasTimings) return entries.length;

    return Math.max(1, ...entries.map((e) => e.exitTime ?? e.end ?? e.inTime ?? e.start ?? 0));
}
