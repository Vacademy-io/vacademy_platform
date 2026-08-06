import { useEffect, useState } from "react";
import { Preferences } from "@capacitor/preferences";
import { getTokenFromStorage } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import type { CourseDetailsLoadingKey } from "./use-loading-states";

// Loads the identity bits the page needs from Capacitor Preferences:
// institute id, invite code and the access token.
export function useUserContext(
  updateLoadingState: (key: CourseDetailsLoadingKey, value: boolean) => void,
) {
  const [instituteId, setInstituteId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string>("default");
  const [authToken, setAuthToken] = useState<string>("");

  useEffect(() => {
    const fetchInstituteAndUserId = async () => {
      updateLoadingState("userData", true);
      const instituteResult = await Preferences.get({
        key: "InstituteId",
      });
      setInstituteId(instituteResult.value || null);

      // Note: Enrolled sessions and donation status are handled by the
      // useEnrollmentStatus hook.

      const inviteCodeResult = await Preferences.get({
        key: "inviteCode",
      });
      if (inviteCodeResult.value) {
        setInviteCode(inviteCodeResult.value);
      }

      const token = await getTokenFromStorage(TokenKey.accessToken);
      if (token) {
        setAuthToken(token);
      }
      updateLoadingState("userData", false);
    };

    fetchInstituteAndUserId();
  }, [updateLoadingState]);

  return { instituteId, inviteCode, authToken };
}
