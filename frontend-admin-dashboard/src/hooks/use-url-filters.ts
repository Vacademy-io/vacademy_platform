import { useCallback } from 'react';
import { useSearch } from '@tanstack/react-router';

/**
 * Generic hook that syncs typed filter state with URL search params.
 * Uses window.history.replaceState for URL updates (same pattern as useContactFilters).
 * Arrays are serialized as comma-separated strings in the URL.
 * Booleans are serialized as 'true'/'false' strings.
 *
 * Usage:
 *   const { filters, setFilter, setFilters, resetFilters } = useUrlFilters(defaults);
 */
export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const searchParams = useSearch({ strict: false }) as Record<string, any>;

    // Merge URL params with defaults (URL takes precedence)
    const filters: T = { ...defaults, ...searchParams } as T;

    const setFilter = useCallback((key: keyof T, value: string) => {
        const currentParams = new URLSearchParams(window.location.search);
        if (value === '' || value === null || value === undefined) {
            currentParams.delete(key as string);
        } else {
            currentParams.set(key as string, value);
        }
        window.history.replaceState(
            {},
            '',
            `${window.location.pathname}?${currentParams.toString()}`
        );
    }, []);

    const setFilters = useCallback((updates: Partial<T>) => {
        const currentParams = new URLSearchParams(window.location.search);
        for (const [key, value] of Object.entries(updates)) {
            if (value === '' || value === null || value === undefined) {
                currentParams.delete(key);
            } else {
                currentParams.set(key, String(value));
            }
        }
        window.history.replaceState(
            {},
            '',
            `${window.location.pathname}?${currentParams.toString()}`
        );
    }, []);

    const resetFilters = useCallback(() => {
        window.history.replaceState({}, '', window.location.pathname);
    }, []);

    return { filters, setFilter, setFilters, resetFilters };
}
