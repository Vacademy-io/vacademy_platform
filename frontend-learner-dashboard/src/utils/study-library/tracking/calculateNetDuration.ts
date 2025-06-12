import { convertTimeToSeconds } from "./convertTimeToSeconds";

export const calculateNetDuration = (timestamps: Array<{id: string, start_time: string, end_time: string, start: number, end: number}>): number => {
    
    if (timestamps.length === 0) return 0;

    // Convert timestamps to seconds for easier calculation
    const ranges = timestamps.map(t => ({
        id: t.id,
        start: convertTimeToSeconds(t.start_time),
        end: convertTimeToSeconds(t.end_time)
    }));

    // Sort ranges by start time
    ranges.sort((a, b) => a.start - b.start);

    // Merge overlapping ranges
    const mergedRanges = ranges.reduce((merged, current) => {
        if (merged.length === 0) {
            return [current];
        }

        const lastRange = merged[merged.length - 1];
        if (current.start <= lastRange.end) {
            // Overlapping range - merge them
            lastRange.end = Math.max(lastRange.end, current.end);
            return merged;
        } else {
            // Non-overlapping range - add to list
            return [...merged, current];
        }
    }, [] as Array<{start: number, end: number}>);

    // Calculate total duration from merged ranges
    const totalDuration = mergedRanges.reduce((sum, range) => {
        return sum + (range.end - range.start);
    }, 0);

    return totalDuration;
};