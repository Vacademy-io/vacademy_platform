import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastError = vi.fn();
const captureException = vi.fn();
const addBreadcrumb = vi.fn();
let sentryClient: object | undefined = {};

vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));
vi.mock("@sentry/react", () => ({
    getClient: () => sentryClient,
    captureException: (...a: unknown[]) => captureException(...a),
    addBreadcrumb: (...a: unknown[]) => addBreadcrumb(...a),
}));

import { extractBackendMessage, reportApiError } from "./report-api-error";

/** Build a real AxiosError, since that is what axios throws and what the helper reads. */
const axiosError = (status: number | undefined, data: unknown): AxiosError =>
    new AxiosError(
        "Request failed",
        "ERR_BAD_REQUEST",
        { headers: new AxiosHeaders(), url: "/mentorship/v1/my-requests", method: "post" } as never,
        undefined,
        status === undefined
            ? undefined
            : ({ status, data, statusText: "", headers: {}, config: { headers: new AxiosHeaders() } } as never),
    );

beforeEach(() => {
    vi.clearAllMocks();
    sentryClient = {};
});

describe("extractBackendMessage", () => {
    it("prefers the human-phrased message", () => {
        expect(extractBackendMessage(axiosError(400, { message: "This mentor is fully booked" })))
            .toBe("This mentor is fully booked");
    });

    it("appends the hint, which is the actionable half", () => {
        expect(
            extractBackendMessage(
                axiosError(400, { message: "This mentor is fully booked.", hint: "Try another mentor." }),
            ),
        ).toBe("This mentor is fully booked. Try another mentor.");
    });

    it("does not repeat a hint already contained in the message", () => {
        const msg = extractBackendMessage(
            axiosError(400, { message: "Full. Try another mentor.", hint: "Try another mentor." }),
        );
        expect(msg).toBe("Full. Try another mentor.");
    });

    it("falls back to the legacy ErrorInfo keys", () => {
        expect(extractBackendMessage(axiosError(500, { ex: "boom" }))).toBe("boom");
        expect(extractBackendMessage(axiosError(500, { responseCode: "kaput" }))).toBe("kaput");
    });

    it("returns nothing for a non-axios error or an unusable body", () => {
        expect(extractBackendMessage(new Error("plain"))).toBeUndefined();
        expect(extractBackendMessage(axiosError(500, "just a string"))).toBeUndefined();
        expect(extractBackendMessage(axiosError(500, {}))).toBeUndefined();
    });
});

describe("reportApiError", () => {
    it("shows the backend's reason rather than a generic message", () => {
        reportApiError(axiosError(400, { message: "You already have a pending request" }), {
            feature: "mentorship",
            fallbackMessage: "Couldn't send your request.",
        });
        expect(toastError).toHaveBeenCalledWith("You already have a pending request");
    });

    it("uses the fallback when the backend says nothing useful", () => {
        reportApiError(axiosError(500, {}), {
            feature: "mentorship",
            fallbackMessage: "Couldn't send your request.",
        });
        expect(toastError).toHaveBeenCalledWith("Couldn't send your request.");
    });

    it("breadcrumbs an expected 4xx instead of burning Sentry quota", () => {
        // A refusal the user caused is not a bug worth a captured event.
        reportApiError(axiosError(400, { message: "Already your mentor" }), { feature: "mentorship" });
        expect(addBreadcrumb).toHaveBeenCalled();
        expect(captureException).not.toHaveBeenCalled();
    });

    it("captures a 5xx, which is a real server fault", () => {
        reportApiError(axiosError(500, { message: "boom" }), {
            feature: "mentorship",
            tags: { "mentorship.action": "request-mentor" },
        });
        expect(captureException).toHaveBeenCalled();
        const [, options] = captureException.mock.calls[0] as [unknown, { tags: Record<string, string> }];
        expect(options.tags.feature).toBe("mentorship");
        expect(options.tags["mentorship.action"]).toBe("request-mentor");
        expect(options.tags["http.status"]).toBe("500");
    });

    it("captures a network error, where there is no status at all", () => {
        reportApiError(axiosError(undefined, undefined), { feature: "mentorship" });
        expect(captureException).toHaveBeenCalled();
    });

    it("can report without a toast, for background work", () => {
        reportApiError(axiosError(500, { message: "boom" }), {
            feature: "mentorship",
            showToast: false,
        });
        expect(toastError).not.toHaveBeenCalled();
        expect(captureException).toHaveBeenCalled();
    });

    it("still shows the toast when Sentry is not initialised", () => {
        sentryClient = undefined;
        reportApiError(axiosError(500, { message: "boom" }), { feature: "mentorship" });
        expect(toastError).toHaveBeenCalledWith("boom");
        expect(captureException).not.toHaveBeenCalled();
    });

    it("never lets a Sentry SDK failure break the caller", () => {
        captureException.mockImplementationOnce(() => {
            throw new Error("sentry exploded");
        });
        expect(() =>
            reportApiError(axiosError(500, { message: "boom" }), { feature: "mentorship" }),
        ).not.toThrow();
        expect(toastError).toHaveBeenCalledWith("boom");
    });

    it("returns the message it displayed, so callers can reuse it", () => {
        const returned = reportApiError(axiosError(400, { message: "Fully booked" }), {
            feature: "mentorship",
        });
        expect(returned).toBe("Fully booked");
    });

    it("drops empty tag values instead of sending blanks to Sentry", () => {
        reportApiError(axiosError(500, { message: "boom" }), {
            feature: "mentorship",
            tags: { keep: "yes", drop: "", alsoDrop: undefined },
        });
        const [, options] = captureException.mock.calls[0] as [unknown, { tags: Record<string, string> }];
        expect(options.tags.keep).toBe("yes");
        expect(options.tags).not.toHaveProperty("drop");
        expect(options.tags).not.toHaveProperty("alsoDrop");
    });
});
