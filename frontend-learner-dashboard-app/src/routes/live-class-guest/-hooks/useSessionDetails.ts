import { useQuery } from "@tanstack/react-query";
import { SessionDetailsResponse } from "@/routes/study-library/live-class/-types/types";
import { LIVE_SESSION_GET_SESSION_BY_SCHEDULE_ID_FOR_GUEST } from "@/constants/urls";
import { guestAxiosInstance } from "@/lib/auth/axiosInstance";
import { Preferences } from "@capacitor/preferences";

/**
 * Paid live sessions: the guest endpoints require the registration id (the
 * guestId stored at registration time) to prove the fee was paid. Free
 * sessions ignore it, so attaching it is always safe.
 */
export const getStoredGuestRegistrationId = async (): Promise<
  string | undefined
> => {
  try {
    const stored = await Preferences.get({ key: "live-session-guestId" });
    return stored?.value || undefined;
  } catch {
    return undefined;
  }
};

export const fetchSessionDetails = async (
  scheduleId: string
): Promise<SessionDetailsResponse> => {
  try {
    const registrationId = await getStoredGuestRegistrationId();
    const response = await guestAxiosInstance.get(
      LIVE_SESSION_GET_SESSION_BY_SCHEDULE_ID_FOR_GUEST,
      {
        params: {
          scheduleId,
          ...(registrationId ? { registrationId } : {}),
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Error fetching session details:", error);
    throw error;
  }
};

export const useSessionDetails = (scheduleId: string | null) => {
  return useQuery({
    queryKey: ["sessionDetails", scheduleId],
    queryFn: () => fetchSessionDetails(scheduleId!),
    enabled: !!scheduleId,
  });
};
