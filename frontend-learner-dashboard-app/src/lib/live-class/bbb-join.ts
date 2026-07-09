import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { toast } from "sonner";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { BASE_URL } from "@/constants/urls";

/**
 * True if a live session is a BigBlueButton meeting.
 *
 * BBB is the ONLY provider whose stored `meeting_link` is a generic, SHARED
 * "Attendee"/"attendee-id" URL. Every other provider (Zoom, Google Meet, Zoho)
 * stores a correct per-meeting link, so those must keep using `meeting_link`
 * directly. BBB joins MUST instead go through the personalized /meeting/join
 * endpoint, which resolves the learner's real name + unique userId. Opening the
 * stored BBB `meeting_link` makes every learner join as "Attendee" sharing the
 * single userId "attendee-id", which trips maxUserConcurrentAccesses and ejects
 * them ("You have been removed from the session").
 */
export function isBbbSession(linkType?: string | null): boolean {
  return linkType === "bbb" || linkType === "BBB_MEETING";
}

/**
 * Fetch a per-user BBB join URL (personalized with the learner's real name +
 * userId) from the backend and open it — Capacitor-aware, matching the canonical
 * live-class list flow. Handles its own errors/toasts. Does NOT mark attendance;
 * callers already do that before invoking this.
 *
 * @param scheduleId the session schedule id
 * @param role BBB role, defaults to VIEWER (learner)
 */
export async function openBbbJoinForLearner(
  scheduleId: string,
  role: string = "VIEWER"
): Promise<void> {
  try {
    const response = await authenticatedAxiosInstance.get(
      `${BASE_URL}/admin-core-service/live-sessions/provider/meeting/join`,
      { params: { scheduleId, role } }
    );

    // Backend returns { error: "Meeting has ended" } if the meeting was force-ended
    if (response.data?.error) {
      toast.error("This class has ended.");
      return;
    }

    const joinUrl = response.data?.joinUrl;
    if (!joinUrl) {
      toast.error("Failed to get video class URL");
      return;
    }

    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url: joinUrl, presentationStyle: "fullscreen" });
    } else {
      window.open(joinUrl, "_blank", "noopener,noreferrer");
    }
  } catch (err: any) {
    console.error("Failed to get BBB join URL:", err);
    const errMsg =
      err?.response?.data?.message || err?.response?.data?.error || "";
    if (
      errMsg.toLowerCase().includes("ended") ||
      errMsg.toLowerCase().includes("not found")
    ) {
      toast.error("This class has ended.");
    } else {
      toast.error("Failed to join video class. Please try again.");
    }
  }
}
