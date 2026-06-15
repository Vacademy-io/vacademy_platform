import { Entry } from '@/components/ai-video-player/types';

export interface TrackEntry {
    entry: Entry;
    track: number;
}

// ── Channel definitions ────────────────────────────────────────────────────

export type ChannelId = 'base' | 'overlay' | 'ui';

export interface Channel {
    id: ChannelId;
    label: string;
    /** Foreground / text colour */
    color: string;
    /** Subtle tinted background for the channel section */
    bgColor: string;
}

// Channel labels are intentionally non-technical: "Main / On top /
// Watermarks" instead of "Base / Overlay / UI". The friendly-labels
// registry mirrors these so any panel that maps channel ids back to
// display strings stays in sync.
export const CHANNELS: readonly Channel[] = [
    { id: 'base', label: 'Main', color: '#1d4ed8', bgColor: '#eff6ff' },
    { id: 'overlay', label: 'On top', color: '#6d28d9', bgColor: '#f5f3ff' },
    { id: 'ui', label: 'Watermarks', color: '#52525b', bgColor: '#f4f4f5' },
] as const;

// ── Audio-track lane colours ────────────────────────────────────────────────
// Shared palette for audio tracks, used by both the AudioTracksPanel and the
// timeline audio lanes so a given track is the same colour in both surfaces.
export const TRACK_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#14b8a6'];

/** Deterministic colour for the audio track at list index `idx`. */
export function trackColor(idx: number): string {
    return TRACK_COLORS[idx % TRACK_COLORS.length]!;
}

/** Map an entry to its channel based on z-index and id convention. */
export function getChannelId(entry: Entry): ChannelId {
    if (entry.id.startsWith('branding-')) return 'ui';
    const z = entry.z ?? 0;
    if (z >= 9000) return 'ui';
    if (z >= 500) return 'overlay';
    return 'base';
}

export interface ChannelTrackEntry {
    entry: Entry;
    channelId: ChannelId;
    /** Row within this channel only (0-based). */
    channelTrack: number;
}

export interface ChannelGroup {
    channel: Channel;
    /** Number of track rows used inside this channel. */
    trackCount: number;
    entries: ChannelTrackEntry[];
}

/**
 * Groups entries by channel (z-index range) and runs the greedy
 * interval-scheduling algorithm within each channel.
 * Only returns channels that contain at least one entry.
 *
 * `navigationMode` should be the timeline's `meta.navigation`. It decides the
 * layout branch the same way TimelineScrubber decides block positions:
 * time_driven schedules by [inTime, exitTime) intervals; every other mode
 * renders blocks at their global entry index (width 1), where horizontal
 * overlap is impossible and a single row per channel is correct. When the
 * mode isn't supplied, fall back to sniffing timing fields — including
 * exitTime/end-only entries, which the old sniff missed (B8): an entry with
 * only an exitTime used to drop the whole timeline into the single-row
 * branch while the scrubber still drew real time spans, stacking
 * overlapping clips on top of each other.
 */
export function assignChannelGroups(entries: Entry[], navigationMode?: string): ChannelGroup[] {
    const timeDriven =
        navigationMode != null
            ? navigationMode === 'time_driven'
            : entries.some(
                  (e) =>
                      e.inTime !== undefined ||
                      e.start !== undefined ||
                      e.exitTime !== undefined ||
                      e.end !== undefined
              );

    // Bucket entries per channel
    const buckets = new Map<ChannelId, Entry[]>();
    for (const ch of CHANNELS) buckets.set(ch.id, []);
    for (const entry of entries) buckets.get(getChannelId(entry))!.push(entry);

    const groups: ChannelGroup[] = [];

    for (const channel of CHANNELS) {
        const bucket = buckets.get(channel.id)!;
        if (bucket.length === 0) continue;

        let assignments: Array<{ entry: Entry; track: number }>;

        if (!timeDriven) {
            assignments = bucket.map((entry) => ({ entry, track: 0 }));
        } else {
            const sorted = [...bucket].sort((a, b) => {
                return (a.inTime ?? a.start ?? 0) - (b.inTime ?? b.start ?? 0);
            });
            const trackEnds: number[] = [];
            assignments = [];
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
                assignments.push({ entry, track: assigned });
            }
        }

        const trackCount = Math.max(1, ...assignments.map((a) => a.track + 1));
        groups.push({
            channel,
            trackCount,
            entries: assignments.map(({ entry, track }) => ({
                entry,
                channelId: channel.id,
                channelTrack: track,
            })),
        });
    }

    return groups;
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
