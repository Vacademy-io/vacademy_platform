import { useEffect } from 'react';
import { useTitleStore } from '@/stores/useTitleStore';

/**
 * Custom hook to ensure the global title and favicon are maintained across page navigations.
 * This hook should be used in the root layout or main components to override
 * individual page titles/favicons with the institute's branding.
 */
export function usePageTitle() {
    const { ensureCorrectTitle, ensureCorrectFavicon } = useTitleStore();

    useEffect(() => {
        // Ensure the correct title and favicon are set when component mounts
        ensureCorrectTitle();
        ensureCorrectFavicon();

        // Set up a periodic check to ensure title and favicon remain correct
        const interval = setInterval(() => {
            ensureCorrectTitle();
            ensureCorrectFavicon();
        }, 1000);

        return () => clearInterval(interval);
    }, [ensureCorrectTitle, ensureCorrectFavicon]);
}
