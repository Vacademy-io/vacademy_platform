import * as Sentry from '@sentry/react';
import { AxiosError } from 'axios';
import { toast } from 'sonner';

interface BackendErrorBody {
    ex?: string;
    responseCode?: string;
    url?: string;
}

export interface ReportApiErrorOptions {
    feature: string;
    tags?: Record<string, string | undefined>;
    extra?: Record<string, unknown>;
    fallbackMessage?: string;
    showToast?: boolean;
    toastDuration?: number;
}

// Source of truth: is the Sentry SDK actually initialized in this runtime?
// Reading getClient() at call time is more reliable than reading env vars —
// it works regardless of how Sentry was bootstrapped and tells us whether
// captureException will actually do anything.
const isSentryReady = () => {
    try {
        return Sentry.getClient() !== undefined;
    } catch {
        return false;
    }
};

// One-time hint so developers running locally (where Sentry init was skipped)
// know events from this helper are not being sent. Fires on the first error
// captured per page load, never in production builds.
let sentryDisabledHintShown = false;
const warnIfSentryDisabled = () => {
    if (sentryDisabledHintShown) return;
    if (import.meta.env.PROD) return;
    sentryDisabledHintShown = true;
    // eslint-disable-next-line no-console
    console.warn(
        '[reportApiError] Sentry SDK is not initialized in this runtime. ' +
            'Errors are logged to the console only. Set VITE_ENABLE_SENTRY=true ' +
            'and VITE_SENTRY_DSN in .env.local to forward events to Sentry.'
    );
};

const extractBackendMessage = (error: unknown): string | undefined => {
    if (!(error instanceof AxiosError)) return undefined;
    const data = error.response?.data as BackendErrorBody | undefined;
    return data?.ex || data?.responseCode || undefined;
};

export const reportApiError = (error: unknown, options: ReportApiErrorOptions) => {
    const isAxios = error instanceof AxiosError;
    const backendMessage = extractBackendMessage(error);
    const httpStatus = isAxios ? error.response?.status : undefined;
    const backendErrorBody = isAxios ? error.response?.data : undefined;
    const requestUrl = isAxios ? error.config?.url : undefined;
    const requestMethod = isAxios ? error.config?.method?.toUpperCase() : undefined;

    const fallback =
        options.fallbackMessage ||
        (isAxios ? error.message : 'Something went wrong. Please try again.');
    const message = backendMessage || fallback;

    if (options.showToast !== false) {
        toast.error(message, {
            className: 'error-toast',
            duration: options.toastDuration ?? 4000,
        });
    }

    // Always log to console so developers see the failure when Sentry is off
    // (dev/local) and so we have a paper trail in production browser consoles.
    // eslint-disable-next-line no-console
    console.error(`[${options.feature}] API error:`, {
        message,
        httpStatus,
        requestMethod,
        requestUrl,
        backendErrorBody,
        error,
    });

    if (!isSentryReady()) {
        warnIfSentryDisabled();
        return message;
    }

    const cleanTags: Record<string, string> = { feature: options.feature };
    if (httpStatus !== undefined) cleanTags['http.status'] = String(httpStatus);
    if (requestMethod) cleanTags['http.method'] = requestMethod;
    if (options.tags) {
        for (const [k, v] of Object.entries(options.tags)) {
            if (v !== undefined && v !== '') cleanTags[k] = v;
        }
    }

    try {
        Sentry.addBreadcrumb({
            category: 'api-error',
            level: 'error',
            message: `[${options.feature}] ${message}`,
            data: {
                httpStatus,
                requestMethod,
                requestUrl,
            },
        });

        const eventId = Sentry.captureException(error, {
            level: 'error',
            tags: cleanTags,
            extra: {
                ...(options.extra || {}),
                httpStatus,
                requestUrl,
                requestMethod,
                backendErrorMessage: backendMessage,
                backendErrorBody,
                displayedMessage: message,
            },
        });

        if (!import.meta.env.PROD) {
            // eslint-disable-next-line no-console
            console.info(
                `[reportApiError] Sentry event captured: ${eventId} (feature=${options.feature})`
            );
        }
    } catch (sentryErr) {
        // Never let a Sentry SDK failure break the mutation handler.
        // eslint-disable-next-line no-console
        console.error('[reportApiError] Sentry.captureException threw:', sentryErr);
    }

    return message;
};
