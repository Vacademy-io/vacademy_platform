import { useState } from "react";
import { startChildViewSession } from "../-services/parent-portal-api";
import { startChildView } from "./child-view";

/**
 * Shared "view as my child" action: mints the delegated child session and swaps
 * into the learner dashboard (hard reload on success). Used by both the header
 * one-tap button and the profile menu, so the flow stays identical.
 */
export function useViewAsChild(childId: string, childName: string) {
  const [switching, setSwitching] = useState(false);

  const viewAsChild = async () => {
    if (switching) return;
    setSwitching(true);
    try {
      const s = await startChildViewSession(childId);
      await startChildView({
        childUserId: s.childUserId,
        childName: s.childName || childName,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
      });
      // startChildView hard-reloads into the learner dashboard on success.
    } catch (e) {
      console.error("[parent] view-as-child failed", e);
      setSwitching(false);
    }
  };

  return { viewAsChild, switching };
}
