import { useEffect } from "react";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { PRESENCE_HEARTBEAT } from "@/constants/urls";

const HEARTBEAT_INTERVAL_MS = 60_000;

/**
 * Course Pulse presence heartbeat. While a slide is open AND the tab is visible, ping the
 * backend every ~60s so the learner counts as "present" even when no tracking write is
 * happening -- e.g. a paused video/audio, or just reading a static page. It only bumps
 * last_seen_at (server clock); it does NOT touch watch time / breadcrumbs.
 *
 * It intentionally stops when the tab is hidden or the slide unmounts, so a learner who
 * closes the slide or backgrounds the tab goes OFFLINE on their own after the window.
 */
export function usePresenceHeartbeat(slideId: string | undefined) {
    useEffect(() => {
        if (!slideId) return;

        const beat = () => {
            if (document.visibilityState !== "visible") return;
            authenticatedAxiosInstance
                .post(PRESENCE_HEARTBEAT, null, { params: { slideId } })
                .catch(() => {
                    /* presence is best-effort; never surface heartbeat errors to the learner */
                });
        };

        beat(); // fire immediately so a freshly-opened slide registers without waiting a minute
        const id = window.setInterval(beat, HEARTBEAT_INTERVAL_MS);

        // Re-beat the moment the tab becomes visible again (returning from another app/tab).
        const onVisible = () => {
            if (document.visibilityState === "visible") beat();
        };
        document.addEventListener("visibilitychange", onVisible);

        return () => {
            window.clearInterval(id);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [slideId]);
}
