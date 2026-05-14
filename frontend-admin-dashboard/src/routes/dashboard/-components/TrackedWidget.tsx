import { type ReactNode } from 'react';
import { useWidgetView } from '../-hooks/useWidgetTelemetry';

interface TrackedWidgetProps {
    widgetId: string;
    children: ReactNode;
}

// Thin wrapper that fires "dashboard_widget_viewed" once for any widget it
// wraps. Use it at the call site in the dashboard rather than instrumenting
// every individual widget — this keeps the per-widget files clean and gives
// us one place to evolve telemetry.
export default function TrackedWidget({ widgetId, children }: TrackedWidgetProps) {
    useWidgetView(widgetId);
    return <>{children}</>;
}
