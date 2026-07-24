import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { Helmet } from "react-helmet";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { useEffect, useState, useCallback } from "react";
import { useSessionDetails } from "../-hooks/useSessionDetails";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { CountdownTimer } from "./-components/CountdownTimer";
import { getPublicUrl } from "@/services/upload_file";
import { BackgroundMusic } from "./-components/BackgroundMusic";
import { SessionStreamingServiceType, LinkType } from "@/routes/register/live-class/-types/enum";
import { useMarkAttendance } from "../-hooks/useMarkAttendance";
import { openBbbJoinForLearner } from "@/lib/live-class/bbb-join";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useServerTime, getServerTime } from "@/hooks/use-server-time";
import { convertSessionTimeToUserTimezone } from "@/utils/timezone";
import {
  getTerminology,
  getTerminologyPlural,
} from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";

export const Route = createFileRoute("/study-library/live-class/waiting-room/")(
  {
    validateSearch: z.object({
      sessionId: z.string(),
    }),
    component: WaitingRoomComponent,
  }
);

function WaitingRoomComponent() {
  const { t } = useTranslation("studyContent");
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const { sessionId } = Route.useSearch();
  const { setNavHeading } = useNavHeadingStore();
  const navigate = useNavigate();
  const { mutateAsync: markAttendance } = useMarkAttendance();
  const {
    data: sessionDetails,
    isLoading,
    error,
  } = useSessionDetails(sessionId);
  const { data: serverTimeData } = useServerTime();

  const fetchThumbnail = useCallback(async () => {
    if (sessionDetails?.thumbnailFileId) {
      const thumbnailUrl = await getPublicUrl(sessionDetails.thumbnailFileId);
      setThumbnail(thumbnailUrl);
    }
  }, [sessionDetails?.thumbnailFileId]);

  useEffect(() => {
    setNavHeading(t("liveClass.waitingRoom"));
    if (sessionDetails?.thumbnailFileId) {
      fetchThumbnail();
    }
  }, [sessionDetails?.thumbnailFileId, setNavHeading, fetchThumbnail, t]);

  const checkSessionStart = useCallback(async () => {
    if (!sessionDetails || !serverTimeData) return;

    // Get current time from server converted to user timezone
    const serverTimestamp = getServerTime(serverTimeData);
    const now = new Date(serverTimestamp);

    // Convert session start and end times to user timezone
    const sessionStartInUserTimezone = convertSessionTimeToUserTimezone(
      sessionDetails.meetingDate,
      sessionDetails.scheduleStartTime,
      sessionDetails.timezone
    );

    const sessionEndInUserTimezone = convertSessionTimeToUserTimezone(
      sessionDetails.meetingDate,
      sessionDetails.scheduleLastEntryTime,
      sessionDetails.timezone
    );

    // Check if class has ended
    if (now > sessionEndInUserTimezone) {
      toast.error(t("liveClass.classHasEnded"));
      navigate({ to: "/study-library/live-class" });
      return;
    }

    // Check if current time is >= session start time
    // BBB sessions may not have a defaultMeetLink (room is auto-created on join)
    const isBbb = sessionDetails.linkType === LinkType.BBB_MEETING || sessionDetails.linkType === "bbb";
    if (now >= sessionStartInUserTimezone && (sessionDetails.defaultMeetLink || isBbb)) {
      try {
        await markAttendance({
          sessionId: sessionDetails.sessionId,
          scheduleId: sessionId,
          userSourceType: "USER",
          userSourceId: "",
          details: "Joined live class from waiting room",
        });
        if (isBbb) {
          // BBB: open the personalized join URL (real name + userId) directly.
          // Do NOT route to the embed page — its session data can resolve linkType
          // to "other" and fail with "Unsupported session type". The backend
          // /meeting/join is authoritative. Then leave the waiting room.
          await openBbbJoinForLearner(sessionId);
          navigate({ to: "/study-library/live-class" });
        } else if (
          sessionDetails.sessionStreamingServiceType ===
          SessionStreamingServiceType.EMBED
        ) {
          navigate({
            to: "/study-library/live-class/embed",
            search: { sessionId },
          });
        } else {
          const joinLink = sessionDetails.customMeetingLink || sessionDetails.defaultMeetLink;
          window.open(joinLink, "_blank", "noopener,noreferrer");
        }
      } catch (error) {
        console.error("Failed to mark attendance:", error);
        toast.error(t("liveClass.failedToMarkAttendance"));
        if (isBbb) {
          // BBB: open the personalized join URL (real name + userId) directly.
          // Do NOT route to the embed page — its session data can resolve linkType
          // to "other" and fail with "Unsupported session type". The backend
          // /meeting/join is authoritative. Then leave the waiting room.
          await openBbbJoinForLearner(sessionId);
          navigate({ to: "/study-library/live-class" });
        } else if (
          sessionDetails.sessionStreamingServiceType ===
          SessionStreamingServiceType.EMBED
        ) {
          navigate({
            to: "/study-library/live-class/embed",
            search: { sessionId },
          });
        } else {
          const joinLink = sessionDetails.customMeetingLink || sessionDetails.defaultMeetLink;
          window.open(joinLink, "_blank", "noopener,noreferrer");
        }
      }
    }
  }, [sessionDetails, serverTimeData, markAttendance, navigate, sessionId]);

  useEffect(() => {
    if (sessionDetails) {
      // Check immediately
      checkSessionStart();
      // Check every 30 seconds
      const timer = setInterval(checkSessionStart, 30000);
      return () => clearInterval(timer);
    }
  }, [sessionDetails, checkSessionStart]);

  if (isLoading) {
    return <DashboardLoader />;
  }

  if (error) {
    return (
      <LayoutContainer>
        <div className="p-4 border border-red-200 rounded-lg bg-red-50 text-red-700">
          {t("liveClass.errorLoadingSession", { message: (error as Error).message })}
        </div>
      </LayoutContainer>
    );
  }

  if (!sessionDetails) {
    return (
      <LayoutContainer>
        <div className="p-4 border border-red-200 rounded-lg bg-red-50 text-red-700">
          {t("liveClass.sessionNotFound")}
        </div>
      </LayoutContainer>
    );
  }

  return (
    <LayoutContainer>
      <Helmet>
        <title>{document?.title || getTerminologyPlural(ContentTerms.LiveSession, SystemTerms.LiveSession)}</title>
        <meta name="description" content={t("liveClass.metaDescription")} />
      </Helmet>

      <div className="flex flex-col items-center w-full justify-center p-1 gap-4">
        <h1 className="text-2xl font-bold text-center mb-6">
          {sessionDetails?.title || getTerminology(ContentTerms.LiveSession, SystemTerms.LiveSession)}
        </h1>
        <div>{t("liveClass.getReady")}</div>
        <div className="space-y-6">
          {sessionDetails && (
            <CountdownTimer
              sessionDetails={sessionDetails}
              waitingRoomTime={sessionDetails.waitingRoomTime}
              onExpire={checkSessionStart}
            />
          )}
        </div>
        {thumbnail && (
          <img
            src={thumbnail}
            alt={t("liveClass.sessionThumbnailAlt")}
            className="w-full max-h-72 rounded-lg object-contain bg-gray-50"
          />
        )}
        {sessionDetails && (
          <BackgroundMusic
            backgroundScoreFileId={sessionDetails.backgroundScoreFileId}
          />
        )}
      </div>
    </LayoutContainer>
  );
}
