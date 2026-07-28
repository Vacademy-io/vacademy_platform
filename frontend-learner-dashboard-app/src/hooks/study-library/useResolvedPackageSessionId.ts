import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { getPackageSessionId } from "@/utils/study-library/get-list-from-stores/getPackageSessionId";
import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

/**
 * Resolves the package_session_id (a.k.a. "batch") of the course the learner is
 * *currently studying*.
 *
 * Why this exists: the tracking hooks used to read the batch straight from
 * `getPackageSessionId()`, which returns the single `package_session_id` cached
 * in device Preferences at login. A learner enrolled in more than one batch has
 * exactly one value cached, so studying any *other* course sent the wrong batch
 * to the activity endpoints. The backend's rollup cascade then updated the
 * chapter/module/subject percentages correctly (those ids come from the route)
 * but computed the package-session percentage against a batch the learner
 * wasn't studying — finding no rows, yielding null, and silently leaving the
 * old course percentage in place. That is the "my chapter is done but my
 * course progress won't move" report.
 *
 * Resolution order, most authoritative first:
 *  1. `sessionId` route search param — the URL's name for this value, and the
 *     only source guaranteed to describe the page the learner is on right now.
 *     Checked before the store because the store is written by a route effect
 *     and can still hold the previous course for a render after a switch.
 *  2. `currentPackageSessionId` — set by the slides route; covers routes whose
 *     URL doesn't carry sessionId.
 *  3. the cached Preferences value — correct for single-batch learners, and the
 *     only thing available outside the course-details routes.
 */
export const useResolvedPackageSessionId = () => {
    const { currentPackageSessionId } = useContentStore();
    const router = useRouter();
    const { sessionId } = router.state.location.search as {
        sessionId?: string;
    };

    return useCallback(async (): Promise<string> => {
        if (sessionId) return sessionId;
        if (currentPackageSessionId) return currentPackageSessionId;
        return (await getPackageSessionId()) || "";
    }, [currentPackageSessionId, sessionId]);
};
