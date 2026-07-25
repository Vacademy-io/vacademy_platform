import React, { Suspense, useEffect } from 'react';
import { useSearch } from '@tanstack/react-router';
import { useQuickSettingsStore } from '@/stores/settings/useQuickSettingsStore';

const QuickSettingsDialogInner = React.lazy(() => import('./QuickSettingsDialogInner'));

interface QuickSettingsErrorBoundaryState {
    hasError: boolean;
}

/**
 * A crash resolving a bad/stale quick-access key (or inside an embedded
 * settings component) must not blank the whole app — this file is mounted
 * once at the app root, outside any route-level error boundary. Resets the
 * store instead of propagating.
 */
class QuickSettingsErrorBoundary extends React.Component<
    { onError: () => void; children: React.ReactNode },
    QuickSettingsErrorBoundaryState
> {
    state: QuickSettingsErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: unknown) {
        console.error('QuickSettingsDialog failed to render:', error);
        this.props.onError();
    }

    render() {
        if (this.state.hasError) return null;
        return this.props.children;
    }
}

/**
 * Globally-mounted host for the "quick settings access" popup (see
 * SettingsQuickAccessButton). Deliberately lightweight — it only reads the
 * open-state store and the `?quickSettings=` URL param, never importing the
 * full settings-component registry directly. The registry (and every
 * settings component it references) only loads once something is actually
 * open, via the lazy QuickSettingsDialogInner.
 */
export function QuickSettingsDialog() {
    const openKey = useQuickSettingsStore((s) => s.openKey);
    const openQuickSettings = useQuickSettingsStore((s) => s.openQuickSettings);
    const closeQuickSettings = useQuickSettingsStore((s) => s.closeQuickSettings);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const urlKey = (useSearch({ strict: false }) as Record<string, any>)?.quickSettings as
        | string
        | undefined;

    // URL -> store: deep-linking and hard refresh on a ?quickSettings= URL.
    useEffect(() => {
        if (urlKey && urlKey !== openKey) openQuickSettings(urlKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [urlKey]);

    // Store -> URL: opening/closing (e.g. via a trigger button) stays
    // shareable. Raw URLSearchParams + replaceState — same pattern as
    // use-url-filters.ts — because this route's own validateSearch (if any)
    // doesn't know about `quickSettings`, and replaceState avoids spamming
    // browser history on every open/close.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (openKey) {
            if (params.get('quickSettings') === openKey) return;
            params.set('quickSettings', openKey);
        } else {
            if (!params.has('quickSettings')) return;
            params.delete('quickSettings');
        }
        window.history.replaceState(
            {},
            '',
            `${window.location.pathname}${params.toString() ? `?${params}` : ''}`
        );
    }, [openKey]);

    if (!openKey) return null;

    return (
        <QuickSettingsErrorBoundary onError={closeQuickSettings}>
            <Suspense fallback={null}>
                <QuickSettingsDialogInner />
            </Suspense>
        </QuickSettingsErrorBoundary>
    );
}
