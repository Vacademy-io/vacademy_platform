import * as Sentry from "@sentry/react";
import { AxiosError } from "axios";
import { toast } from "sonner";

/**
 * Learner-side counterpart of the admin dashboard's report-api-error helper.
 *
 * Two jobs in one call: show the user the reason the backend actually gave
 * (rather than a generic "something went wrong"), and forward genuine failures to
 * Sentry with enough context to debug them.
 *
 * Expected 4xx are deliberately NOT captured — a validation failure or a
 * permission denial is the user being told "no", not a bug. They still land as a
 * breadcrumb so they show up as context on any real error that follows. 5xx and
 * network errors (no status) are captured.
 */
interface BackendErrorBody {
    /** Services that phrase errors for humans use this. */
    message?: string;
    /** The actionable half, e.g. "Pick another mentor". */
    hint?: string;
    /** The platform-wide ErrorInfo(url, ex, responseCode, date) shape. */
    ex?: string;
    responseCode?: string;
}

export interface ReportApiErrorOptions {
    /** Feature tag, e.g. "mentorship". Groups events in Sentry. */
    feature: string;
    tags?: Record<string, string | undefined>;
    extra?: Record<string, unknown>;
    /** Shown when the backend gave nothing usable. */
    fallbackMessage?: string;
    /** Set false to report without showing a toast (e.g. background refreshes). */
    showToast?: boolean;
}

const backendBody = (error: unknown): BackendErrorBody | undefined =>
    error instanceof AxiosError
        ? (error.response?.data as BackendErrorBody | undefined)
        : undefined;

/** The sentence to show the user, or undefined when the backend gave nothing usable. */
export const extractBackendMessage = (error: unknown): string | undefined => {
    const data = backendBody(error);
    if (!data || typeof data !== "object") return undefined;
    // `message` first (human-phrased), then the legacy ErrorInfo keys.
    const base = data.message || data.ex || data.responseCode;
    if (!base || typeof base !== "string") return undefined;
    return data.hint && !base.includes(data.hint) ? `${base} ${data.hint}` : base;
};

// Whether the SDK is actually initialised in this runtime — more reliable than
// reading env vars, and it tells us if captureException will do anything at all.
const isSentryReady = (): boolean => {
    try {
        return Sentry.getClient() !== undefined;
    } catch {
        return false;
    }
};

export const reportApiError = (error: unknown, options: ReportApiErrorOptions): string => {
    const isAxios = error instanceof AxiosError;
    const backendMessage = extractBackendMessage(error);
    const httpStatus = isAxios ? error.response?.status : undefined;
    const requestUrl = isAxios ? error.config?.url : undefined;
    const requestMethod = isAxios ? error.config?.method?.toUpperCase() : undefined;

    const message =
        backendMessage ||
        options.fallbackMessage ||
        "Something went wrong. Please try again.";

    if (options.showToast !== false) toast.error(message);

    // Always log, so the failure is visible in dev and in production consoles.
    console.error(`[${options.feature}] API error:`, {
        message,
        httpStatus,
        requestMethod,
        requestUrl,
        error,
    });

    if (!isSentryReady()) return message;

    const isExpectedClientError =
        httpStatus !== undefined && httpStatus >= 400 && httpStatus < 500;

    try {
        if (isExpectedClientError) {
            Sentry.addBreadcrumb({
                category: "api-error",
                level: "warning",
                message: `[${options.feature}] ${httpStatus} ${message}`,
                data: { httpStatus, requestMethod, requestUrl },
            });
            return message;
        }

        const tags: Record<string, string> = { feature: options.feature };
        if (httpStatus !== undefined) tags["http.status"] = String(httpStatus);
        if (requestMethod) tags["http.method"] = requestMethod;
        for (const [k, v] of Object.entries(options.tags ?? {})) {
            if (v !== undefined && v !== "") tags[k] = v;
        }

        Sentry.captureException(error, {
            level: "error",
            tags,
            extra: {
                ...(options.extra ?? {}),
                httpStatus,
                requestUrl,
                requestMethod,
                backendErrorMessage: backendMessage,
                displayedMessage: message,
            },
        });
    } catch {
        // A Sentry SDK failure must never break the caller's handler.
    }

    return message;
};
