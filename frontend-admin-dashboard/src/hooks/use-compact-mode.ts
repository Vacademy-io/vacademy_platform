/**
 * Compact Mode Hook
 *
 * Provides unified detection and control of compact mode across the application.
 * Supports multiple methods:
 * 1. Route prefix: /cm/
 * 2. Query parameter: ?compact=true
 * 3. User preference: saved in localStorage or backend
 */

import { useRouter } from '@tanstack/react-router';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// COMPACT MODE ZUSTAND STORE
// ============================================================================

interface CompactModeStore {
    userPreference: boolean | null;
    setUserPreference: (preference: boolean) => void;
    clearPreference: () => void;
}

/**
 * Zustand store for persisting user's compact mode preference
 */
export const useCompactModeStore = create<CompactModeStore>()(
    persist(
        (set) => ({
            userPreference: null,
            setUserPreference: (preference: boolean) => set({ userPreference: preference }),
            clearPreference: () => set({ userPreference: null }),
        }),
        {
            name: 'compact-mode-preference',
        }
    )
);

// ============================================================================
// COMPACT MODE DETECTION HOOK
// ============================================================================

export interface CompactModeHook {
    /**
     * Whether compact mode is currently active
     */
    isCompact: boolean;

    /**
     * The method by which compact mode is activated
     */
    compactSource: 'route' | 'query' | 'preference' | null;

    /**
     * Toggle compact mode on/off
     */
    toggleCompactMode: () => void;

    /**
     * Set user's permanent preference
     */
    setCompactPreference: (enabled: boolean) => void;

    /**
     * Clear user's preference (fall back to other methods)
     */
    clearCompactPreference: () => void;

    /**
     * Navigate to the compact version of current route
     */
    navigateToCompact: () => void;

    /**
     * Navigate to the default version of current route
     */
    navigateToDefault: () => void;
}

/**
 * Main hook for compact mode detection and control
 *
 * Priority order:
 * 1. Route prefix (/cm/)
 * 2. Query parameter (?compact=true)
 * 3. User preference (localStorage/backend)
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isCompact, toggleCompactMode } = useCompactMode();
 *
 *   return (
 *     <div className={cn(isCompact ? 'p-2' : 'p-6')}>
 *       <button onClick={toggleCompactMode}>
 *         Toggle Compact Mode
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCompactMode(): CompactModeHook {
    const router = useRouter();
    const location = router.state.location;
    const { userPreference, setUserPreference, clearPreference } = useCompactModeStore();

    // Method 1: Check if route starts with /cm/
    const isCompactRoute = location.pathname.startsWith('/cm/');

    // Method 2: Check query parameter
    // Method 2: Check query parameter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const searchParams = location.search as any;
    const isCompactParam = searchParams?.compact === 'true' || searchParams?.compact === true;

    // Method 3: Check user preference
    const isCompactPreference = userPreference === true;

    // Determine if compact mode is active and why
    let isCompact = false;
    let compactSource: CompactModeHook['compactSource'] = null;

    if (isCompactRoute) {
        isCompact = true;
        compactSource = 'route';
    } else if (isCompactParam) {
        isCompact = true;
        compactSource = 'query';
    } else if (isCompactPreference) {
        isCompact = true;
        compactSource = 'preference';
    }

    /**
     * Toggle compact mode via query parameter
     */
    const toggleCompactMode = () => {
        const url = new URL(window.location.href);
        if (isCompactParam) {
            url.searchParams.delete('compact');
        } else {
            url.searchParams.set('compact', 'true');
        }
        window.history.pushState({}, '', url.toString());
        // Force a re-render by using router.invalidate or similar
        window.location.href = url.toString();
    };

    /**
     * Set permanent user preference
     */
    const setCompactPreference = (enabled: boolean) => {
        setUserPreference(enabled);

        // TODO: Also save to backend if user is authenticated
        // saveCompactPreferenceToBackend(enabled);
    };

    /**
     * Clear user preference
     */
    const clearCompactPreference = () => {
        clearPreference();

        // TODO: Also clear from backend
        // clearCompactPreferenceFromBackend();
    };

    /**
     * Navigate to compact version of current route
     */
    const navigateToCompact = () => {
        const currentPath = location.pathname;

        // If already on /cm/ route, do nothing
        if (currentPath.startsWith('/cm/')) {
            return;
        }

        // Convert route to compact version
        const compactPath = `/cm${currentPath}`;
        router.navigate({ to: compactPath });
    };

    /**
     * Navigate to default (non-compact) version of current route
     */
    const navigateToDefault = () => {
        const currentPath = location.pathname;

        // If not on /cm/ route, just remove query param
        if (!currentPath.startsWith('/cm/')) {
            const url = new URL(window.location.href);
            url.searchParams.delete('compact');
            window.location.href = url.toString();
            return;
        }

        // Convert /cm/ route to default route
        const defaultPath = currentPath.replace(/^\/cm/, '');
        router.navigate({ to: defaultPath || '/' });
    };

    return {
        isCompact,
        compactSource,
        toggleCompactMode,
        setCompactPreference,
        clearCompactPreference,
        navigateToCompact,
        navigateToDefault,
    };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get compact-aware class names for a component
 *
 * @example
 * ```tsx
 * const { isCompact } = useCompactMode();
 * const padding = getCompactClass(isCompact, 'p-6', 'p-3');
 * ```
 */
export function getCompactClass(
    isCompact: boolean,
    defaultClass: string,
    compactClass: string
): string {
    return isCompact ? compactClass : defaultClass;
}

/**
 * Get multiple compact-aware classes
 *
 * @example
 * ```tsx
 * const { isCompact } = useCompactMode();
 * const classes = getCompactClasses(isCompact, {
 *   padding: ['p-6', 'p-3'],
 *   gap: ['gap-4', 'gap-2'],
 *   text: ['text-base', 'text-sm']
 * });
 * // Returns: 'p-6 gap-4 text-base' or 'p-3 gap-2 text-sm'
 * ```
 */
export function getCompactClasses(
    isCompact: boolean,
    classMap: Record<string, [string, string]>
): string {
    return Object.values(classMap)
        .map(([defaultClass, compactClass]) =>
            isCompact ? compactClass : defaultClass
        )
        .join(' ');
}

/**
 * Check if a specific route should show compact mode toggle
 */
export function shouldShowCompactToggle(pathname: string): boolean {
    // Don't show on public routes
    const publicRoutes = ['/login', '/signup', '/landing', '/pricing'];
    if (publicRoutes.some(route => pathname.startsWith(route))) {
        return false;
    }

    // Don't show on full-screen routes
    const fullScreenRoutes = ['/evaluator-ai', '/slides'];
    if (fullScreenRoutes.some(route => pathname.includes(route))) {
        return false;
    }

    return true;
}

// ============================================================================
// COMPACT MODE CONSTANTS
// ============================================================================

export const COMPACT_MODE = {
    /**
     * Sidebar widths
     */
    SIDEBAR: {
        EXPANDED: {
            default: 307,
            compact: 220,
        },
        COLLAPSED: {
            default: 112,
            compact: 56,
        },
    },

    /**
     * Navbar heights
     */
    NAVBAR: {
        HEIGHT: {
            default: 72,
            compact: 48,
        },
    },

    /**
     * Spacing scales
     */
    SPACING: {
        CARD_PADDING: {
            default: 'p-6',
            compact: 'p-3',
        },
        CARD_GAP: {
            default: 'gap-6',
            compact: 'gap-3',
        },
        CONTENT_PADDING: {
            default: 'p-4 md:p-6 lg:m-7',
            compact: 'p-2 md:p-4 lg:m-4',
        },
        SECTION_SPACING: {
            default: 'mb-8',
            compact: 'mb-4',
        },
    },

    /**
     * Typography scales
     */
    TYPOGRAPHY: {
        H1: {
            default: 'text-3xl',
            compact: 'text-2xl',
        },
        H2: {
            default: 'text-2xl',
            compact: 'text-xl',
        },
        H3: {
            default: 'text-xl',
            compact: 'text-lg',
        },
        BODY: {
            default: 'text-base',
            compact: 'text-sm',
        },
        SMALL: {
            default: 'text-sm',
            compact: 'text-xs',
        },
    },

    /**
     * Component sizes
     */
    COMPONENTS: {
        BUTTON: {
            small: {
                default: 'px-4 py-2 text-sm',
                compact: 'px-3 py-1.5 text-xs',
            },
            medium: {
                default: 'px-6 py-3 text-base',
                compact: 'px-4 py-2 text-sm',
            },
            large: {
                default: 'px-8 py-4 text-lg',
                compact: 'px-5 py-2.5 text-base',
            },
        },
        INPUT: {
            height: {
                default: 'h-12',
                compact: 'h-9',
            },
            padding: {
                default: 'px-4 py-3',
                compact: 'px-3 py-2',
            },
            text: {
                default: 'text-base',
                compact: 'text-sm',
            },
        },
        AVATAR: {
            size: {
                default: 'size-10',
                compact: 'size-8',
            },
        },
        ICON: {
            size: {
                default: 'size-5',
                compact: 'size-4',
            },
        },
    },
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CompactModeConstants = typeof COMPACT_MODE;
