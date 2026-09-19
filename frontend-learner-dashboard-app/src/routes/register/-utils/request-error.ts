import { AxiosError } from "axios";

/**
 * Coarse buckets the register page can pick a message for.
 *
 * - `network`  — no response at all (offline, DNS, timeout, server unreachable).
 * - `server`   — a real 5xx from the edge or the app (500/502/503/504).
 * - `business` — 510/511: the backend's own "readable rejection" codes. Every
 *                VacademyException lands here with the text in `ex`
 *                (e.g. "Assessment not found", "User not found!", "OTP has
 *                expired"). Not a transport problem — retrying won't help.
 * - `client`   — any other 4xx.
 * - `unknown`  — not an axios error (a plain throw / render bug).
 */
export type RequestErrorKind =
  | "network"
  | "server"
  | "business"
  | "client"
  | "unknown";

export interface ClassifiedRequestError {
  kind: RequestErrorKind;
  status?: number;
  /** Innermost human-readable message the backend attached, if any. */
  message?: string;
}

// auth-service relays notification-service failures verbatim, so `ex` can be
// `510 : "{"url":..., "ex":"OTP has expired...", ...}"`. Pull out the innermost
// `ex` so the toast shows the sentence, not the envelope.
const extractBackendMessage = (raw: unknown): string | undefined => {
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  const nested = [...raw.matchAll(/"ex"\s*:\s*"((?:[^"\\]|\\.)*)"/g)];
  if (nested.length > 0) {
    const last = nested[nested.length - 1]?.[1];
    if (last) return last.replace(/\\"/g, '"');
  }
  return raw;
};

export const classifyRequestError = (error: unknown): ClassifiedRequestError => {
  if (error instanceof AxiosError) {
    if (!error.response) {
      return { kind: "network", message: error.message };
    }
    const status = error.response.status;
    const message = extractBackendMessage(
      (error.response.data as { ex?: unknown } | undefined)?.ex,
    );
    if (status === 510 || status === 511) {
      return { kind: "business", status, message };
    }
    if (status >= 500) return { kind: "server", status, message };
    return { kind: "client", status, message };
  }
  return {
    kind: "unknown",
    message: error instanceof Error ? error.message : undefined,
  };
};

/** True when a retry has a realistic chance of succeeding. */
export const isTransientRequestError = (error: unknown): boolean => {
  const { kind } = classifyRequestError(error);
  return kind === "network" || kind === "server";
};

/** The assessment-page lookup's "no such share code" rejection. */
export const isAssessmentNotFoundError = (error: unknown): boolean => {
  const { kind, status, message } = classifyRequestError(error);
  return (
    status === 404 ||
    (kind === "business" && /not found/i.test(message ?? ""))
  );
};
