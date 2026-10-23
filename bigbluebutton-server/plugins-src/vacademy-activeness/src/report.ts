/**
 * Sends the session summary to admin_core. The body is text/plain so the
 * browser makes a "simple" cross-origin request (no CORS preflight) — the class
 * runs on meet.vacademy.io or an institute's own domain, the API elsewhere.
 * Authentication is the signed token the backend put in this learner's join URL.
 */

export interface ReportPayload {
  token: string;
  avg: number;
  on_screen: number | null;
  attention: number | null;
  seconds: number;
  away_count: number;
  away_seconds: number;
  final: boolean;
}

export const sendReport = (url: string, payload: ReportPayload, beacon: boolean) => {
  const body = JSON.stringify(payload);
  try {
    // sendBeacon survives the tab closing; fetch+keepalive is the fallback.
    if (beacon && typeof navigator.sendBeacon === "function") {
      if (navigator.sendBeacon(url, new Blob([body], { type: "text/plain;charset=UTF-8" }))) return;
    }
    void fetch(url, {
      method: "POST",
      body,
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      keepalive: true,
      mode: "cors",
      credentials: "omit",
    }).catch(() => undefined); // the next minute's report carries the same totals
  } catch {
    // Never let reporting break the class.
  }
};

/**
 * Storage key for this learner in this class, from the token payload
 * ("v1.<b64url(scheduleId:userId:exp)>.<sig>"). The expiry differs on every
 * join, so it is left out: a rejoin after a dropped connection resumes the totals.
 */
export const persistKey = (token: string): string | null => {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const [scheduleId, userId] = atob(b64 + "===".slice((b64.length + 3) % 4)).split(":");
    return scheduleId && userId ? `vacademy.activeness.${scheduleId}:${userId}` : null;
  } catch {
    return null;
  }
};
