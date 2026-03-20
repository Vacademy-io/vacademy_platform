/**
 * User-Driven Navigation Hook
 * For QUIZ, STORYBOOK, WORKSHEET, TIMELINE, CONVERSATION, etc.
 * User manually navigates between entries with prev/next buttons
 */

import { useState, useCallback, useMemo } from 'react';
import { Entry, TimelineMeta, formatEntryLabel } from '../types';

interface UseUserDrivenNavigationProps {
    entries: Entry[];
    meta: TimelineMeta;
    onEntryChange?: (index: number, entry: Entry) => void;
    onComplete?: () => void;
}

interface UseUserDrivenNavigationReturn {
    currentIndex: number;
    currentEntry: Entry | null;
    totalEntries: number;
    progressLabel: string;
    canGoNext: boolean;
    canGoPrev: boolean;
    next: () => void;
    prev: () => void;
    goTo: (index: number) => void;
    reset: () => void;
}

export function useUserDrivenNavigation({
    entries,
    meta,
    onEntryChange,
    onComplete,
}: UseUserDrivenNavigationProps): UseUserDrivenNavigationReturn {
    const [currentIndex, setCurrentIndex] = useState(0);

    const totalEntries = entries.length;
    const currentEntry = entries[currentIndex] || null;

    // Format progress label
    const progressLabel = useMemo(() => {
        return formatEntryLabel(meta.entry_label, currentIndex, totalEntries);
    }, [meta.entry_label, currentIndex, totalEntries]);

    // Navigation state
    const canGoNext = currentIndex < totalEntries - 1;
    const canGoPrev = currentIndex > 0;

    const goTo = useCallback(
        (index: number) => {
            if (index >= 0 && index < totalEntries) {
                setCurrentIndex(index);
                const entry = entries[index];
                if (entry) {
                    onEntryChange?.(index, entry);
                }
            }
        },
        [entries, totalEntries, onEntryChange]
    );

    const next = useCallback(() => {
        if (canGoNext) {
            goTo(currentIndex + 1);
        } else {
            onComplete?.();
        }
    }, [currentIndex, canGoNext, goTo, onComplete]);

    const prev = useCallback(() => {
        if (canGoPrev) {
            goTo(currentIndex - 1);
        }
    }, [currentIndex, canGoPrev, goTo]);

    const reset = useCallback(() => {
        setCurrentIndex(0);
        const entry = entries[0];
        if (entry) {
            onEntryChange?.(0, entry);
        }
    }, [entries, onEntryChange]);

    return {
        currentIndex,
        currentEntry,
        totalEntries,
        progressLabel,
        canGoNext,
        canGoPrev,
        next,
        prev,
        goTo,
        reset,
    };
}
