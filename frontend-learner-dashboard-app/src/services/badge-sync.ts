import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { BASE_URL } from "@/constants/urls";

/**
 * Persist the learner's client-computed auto-unlock badges to the server so they appear
 * on the in-app and public leaderboards (which read the server-side badge table). The
 * server takes the learner from the JWT and only inserts badges it hasn't seen, so this
 * is safe to call on every dashboard load. We additionally skip the network call when the
 * unlocked set hasn't changed since the last successful sync (keyed per institute).
 */
export interface SyncBadge {
  badgeId: string;
  badgeName: string;
  badgeIcon: string;
  badgeDescription: string;
}

const sigKey = (instituteId: string) => `BADGE_SYNC_SIG:${instituteId}`;

export async function syncBadgeUnlocks(
  instituteId: string,
  badges: SyncBadge[]
): Promise<void> {
  if (!instituteId || badges.length === 0) return;

  // Signature of the current unlocked set — skip if nothing changed since the last sync.
  const signature = badges
    .map((b) => b.badgeId)
    .sort()
    .join(",");
  try {
    if (localStorage.getItem(sigKey(instituteId)) === signature) return;
  } catch {
    /* storage unavailable — fall through and sync anyway */
  }

  try {
    await authenticatedAxiosInstance.post(
      `${BASE_URL}/admin-core-service/learner-badge/learner/v1/sync-unlocks`,
      { instituteId, badges }
    );
    try {
      localStorage.setItem(sigKey(instituteId), signature);
    } catch {
      /* ignore storage write failure */
    }
  } catch (error) {
    // Best-effort: never disrupt the dashboard if the sync fails (it retries next load).
    console.debug("[badge-sync] sync failed:", error);
  }
}
