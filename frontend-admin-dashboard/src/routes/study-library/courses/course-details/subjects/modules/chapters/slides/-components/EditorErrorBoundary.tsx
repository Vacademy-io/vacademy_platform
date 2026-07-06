import { Component, type ErrorInfo, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { MyButton } from '@/components/design-system/button';

interface EditorErrorBoundaryProps {
    children: ReactNode;
    // Change this (e.g. the active slide id) to clear a caught error when the
    // user navigates to a different slide, so one bad slide doesn't leave every
    // subsequent slide showing the fallback.
    resetKey?: unknown;
}

interface EditorErrorBoundaryState {
    hasError: boolean;
}

/**
 * Scoped error boundary around the study-library document (Yoopta/Slate) editor.
 * If a slide's content throws during render — e.g. a future corrupted node we
 * haven't sanitized yet — this degrades to a graceful message + a Sentry report
 * instead of letting the whole app hit the global "Something went wrong" page.
 *
 * Defense-in-depth ONLY. The real fixes live at the three content layers:
 * import (stripEmptyAnchors), save (stripEmptyAnchors) and load
 * (repairSlateChildren). This boundary is the safety net for the unknown.
 */
export class EditorErrorBoundary extends Component<
    EditorErrorBoundaryProps,
    EditorErrorBoundaryState
> {
    state: EditorErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(): EditorErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error('[SlideEditor] render crash caught by boundary:', error, info);
        Sentry.captureException(error, {
            tags: { boundary: 'SlideEditorErrorBoundary' },
            extra: { componentStack: info.componentStack },
        });
    }

    componentDidUpdate(prevProps: EditorErrorBoundaryProps): void {
        if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
            this.setState({ hasError: false });
        }
    }

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div className="flex w-full flex-col items-center justify-center gap-3 p-12 text-center">
                    <p className="text-base font-semibold text-neutral-700">
                        This slide couldn&apos;t be displayed
                    </p>
                    <p className="max-w-md text-sm text-neutral-500">
                        Something in this slide&apos;s content couldn&apos;t be loaded. Please reload
                        the page. If it keeps happening, let support know which slide it was.
                    </p>
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => window.location.reload()}
                    >
                        Reload page
                    </MyButton>
                </div>
            );
        }
        return this.props.children;
    }
}
