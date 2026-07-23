import { useQuery } from "@tanstack/react-query";
import { getAccessToken, getTokenDecodedData } from "@/lib/auth/sessionUtility";
import { isParentToken, isStudentToken } from "@/lib/auth/detect-user-role";
import { isChildViewActive } from "@/routes/parent/child/-lib/child-view";
import { fetchParentSettings } from "@/routes/parent/child/-services/parent-portal-api";

/**
 * Whether the signed-in learner may switch to the parent portal: a DUAL-ROLE
 * user (STUDENT + PARENT) in an institute whose Guardian Settings keep
 * parentPortal.enabled AND allowSwitchToParentView on. Never true while in
 * child-view — the delegated token is the child's identity, not the guardian's.
 */
export function useParentPortalSwitch(): boolean {
  const { data } = useQuery({
    queryKey: ["parent-portal-switch"],
    queryFn: async () => {
      if (isChildViewActive()) return false;
      const token = await getAccessToken();
      const decoded = getTokenDecodedData(token);
      // Dual-role only: PARENT-only guardians are routed to /parent at login
      // and never see the learner shell.
      if (!isParentToken(decoded) || !isStudentToken(decoded)) return false;
      const settings = await fetchParentSettings();
      return !!(settings?.enabled && settings?.allowSwitchToParentView);
    },
    staleTime: 5 * 60 * 1000,
  });
  return data === true;
}
