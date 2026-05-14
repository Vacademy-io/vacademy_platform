import { useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/amplitude';

// Fires "dashboard_widget_viewed" once per (widgetId, mountInstance). Keeps a
// ref guard so React 18 strict-mode double-effects don't double-count.
export const useWidgetView = (widgetId: string, extra?: Record<string, unknown>): void => {
    const seenRef = useRef(false);
    useEffect(() => {
        if (seenRef.current) return;
        seenRef.current = true;
        try {
            trackEvent('dashboard_widget_viewed', {
                widget_id: widgetId,
                viewed_at: new Date().toISOString(),
                ...extra,
            });
        } catch {
            // Telemetry failures must never break the UI.
        }
    }, [widgetId, extra]);
};

export const trackWidgetClick = (
    widgetId: string,
    action: string,
    extra?: Record<string, unknown>
): void => {
    try {
        trackEvent('dashboard_widget_clicked', {
            widget_id: widgetId,
            action,
            clicked_at: new Date().toISOString(),
            ...extra,
        });
    } catch {
        // ignore
    }
};
