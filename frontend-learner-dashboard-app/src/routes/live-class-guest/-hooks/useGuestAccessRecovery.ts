import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { type AxiosError } from "axios";
import { guestAxiosInstance } from "@/lib/auth/axiosInstance";
import { LIVE_SESSION_GET_SESSION_ID_BY_SCHEDULE_ID } from "@/constants/urls";

/**
 * Recovery for guest deep links opened without a local registration (new
 * browser / cleared storage): a paid session's details fetch returns 403
 * because no registrationId can be presented. Instead of dead-ending on an
 * error screen, resolve the schedule's parent session and send the visitor to
 * the public registration page — the one place that can recover their
 * identity (email/phone, plus OTP when the session requires verification)
 * and route them back in.
 */
export const useGuestAccessRecovery = (
  scheduleId: string | null | undefined,
  error: unknown
) => {
  const navigate = useNavigate();

  useEffect(() => {
    const status = (error as AxiosError | undefined)?.response?.status;
    if (!scheduleId || status !== 403) return;

    let cancelled = false;
    (async () => {
      try {
        const response = await guestAxiosInstance.get(
          LIVE_SESSION_GET_SESSION_ID_BY_SCHEDULE_ID,
          { params: { scheduleId } }
        );
        const sessionId = response.data?.sessionId;
        if (!cancelled && sessionId) {
          navigate({
            to: "/register/live-class",
            search: { sessionId },
          });
        }
      } catch (resolveError) {
        console.error(
          "Failed to resolve session for guest access recovery:",
          resolveError
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scheduleId, error, navigate]);
};
