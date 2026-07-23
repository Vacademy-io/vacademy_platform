import { useQuery } from "@tanstack/react-query";
import { getAccessToken, getTokenDecodedData } from "@/lib/auth/sessionUtility";
import { isParentToken, isStudentToken } from "@/lib/auth/detect-user-role";
import { isChildViewActive } from "@/routes/parent/child/-lib/child-view";
import { fetchParentSettings } from "@/routes/parent/child/-services/parent-portal-api";

/**
 * Where the signed-in learner may hop for the "parent" perspective, or null.
 *
 * Gated on Guardian Settings (parentPortal.enabled AND allowSwitchToParentView):
 * - A dual-role STUDENT+PARENT user goes to their real portal (/parent).
 * - A plain student opens the parent-style monitoring view of THEMSELVES —
 *   allowed server-side by the GuardianAccessGuard's self leg, so no PARENT
 *   role is needed.
 * Never available in child-view — the delegated token is the child's identity.
 */
export function useParentPortalSwitch(): string | null {
  const { data } = useQuery({
    queryKey: ["parent-portal-switch"],
    queryFn: async (): Promise<string | null> => {
      if (isChildViewActive()) return null;
      const token = await getAccessToken();
      const decoded = getTokenDecodedData(token);
      if (!isStudentToken(decoded)) return null;
      const settings = await fetchParentSettings();
      if (!settings?.enabled || !settings?.allowSwitchToParentView) return null;
      if (isParentToken(decoded)) return "/parent";
      const ownUserId = (decoded as { user?: string } | null)?.user;
      return ownUserId ? `/parent/child/${ownUserId}` : null;
    },
    staleTime: 5 * 60 * 1000,
  });
  return data ?? null;
}
