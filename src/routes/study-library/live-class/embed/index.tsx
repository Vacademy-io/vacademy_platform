import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { Helmet } from "react-helmet";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { useEffect, useState } from "react";
import { useSessionDetails } from "../-hooks/useSessionDetails";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { LinkType } from "@/routes/register/live-class/-types/enum";
import YouTubePlayerWrapper from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/youtube-player";
import ZoomEmbedPlayer from "./-components/ZoomEmbedPlayer";
import { convertSessionTimeToUserTimezone } from "@/utils/timezone";
import { useServerTime, getServerTime } from "@/hooks/use-server-time";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { SessionDetailsResponse } from "../-types/types";
import { useLiveSessions } from "../-hooks/useLiveSessions";
import { getAllPackageSessionIds } from "@/utils/study-library/get-list-from-stores/getPackageSessionId";
import { DefaultClassCard } from "../-components/DefaultClassCard";

const LearnerButtonConfigSchema = z.object({
  text: z.string(),
  url: z.string(),
  background_color: z.string(),
  text_color: z.string(),
  visible: z.boolean(),
});

export const Route = createFileRoute("/study-library/live-class/embed/")({
  validateSearch: z.object({
    sessionId: z.string().optional(),
    videoUrl: z.string().optional(),
    title: z.string().optional(),
    learnerButtonConfig: LearnerButtonConfigSchema.optional(),
  }),
  component: EmbedComponent,
});

import { SafetyWarningModal } from "@/components/common/safety/safety-warning-modal";

import { ENABLE_LIVE_CLASS_SAFETY_MODAL } from "@/constants/feature-flags";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";

function EmbedComponent() {
  const { sessionId, videoUrl, title, learnerButtonConfig } = Route.useSearch();
  const { setNavHeading } = useNavHeadingStore();
  const navigate = useNavigate();
  const [batchIds, setBatchIds] = useState<string[]>([]);

  useEffect(() => {
    const fetchBatchIds = async () => {
      const ids = await getAllPackageSessionIds();
      setBatchIds(ids);
    };
    fetchBatchIds();
  }, []);

  const { data: sessions } = useLiveSessions(batchIds);

  useEffect(() => {
    // If we are watching a default class (no sessionId) and a live session starts, redirect
    if (!sessionId && sessions?.live_sessions && sessions.live_sessions.length > 0) {
      toast.info("A live session has started!");
      navigate({ to: "/study-library/live-class" });
    }
  }, [sessions?.live_sessions, sessionId, navigate]);

  const {
    data: fetchedSessionDetails,
    isLoading,
    error,
  } = useSessionDetails(sessionId || null);

  // If safety modal is disabled, we are "verified" by default.
  const [isSafetyVerified, setIsSafetyVerified] = useState(
    !ENABLE_LIVE_CLASS_SAFETY_MODAL
  );
  const { data: serverTimeData } = useServerTime();

  // Construct effective session details
  const sessionDetails: Partial<SessionDetailsResponse> | undefined =
    fetchedSessionDetails ||
    (videoUrl
      ? {
        title: title || (sessions as any)?.defaultDayConfig?.defaultClassName || "Default Session",
        defaultMeetLink: videoUrl,
        linkType: LinkType.YOUTUBE, // Assuming default links are YouTube for now, can be improved
        allowPlayPause: true,
        allowRewind: "true",
        meetingDate: new Date().toISOString().split("T")[0],
        scheduleStartTime: "00:00:00",
        scheduleLastEntryTime: "23:59:59",
        timezone: "UTC", // Default fallback
      }
      : undefined);

  useEffect(() => {
    const liveSessionTerm = getTerminology(ContentTerms.LiveSession, SystemTerms.LiveSession);
    const sessionTerm = getTerminology(ContentTerms.Session, SystemTerms.Session);
    const prefix = sessionId ? liveSessionTerm : sessionTerm;
    if (sessionDetails?.title) {
      setNavHeading(`${prefix} - ${sessionDetails.title}`);
    } else {
      setNavHeading(prefix);
    }
  }, [sessionDetails, setNavHeading, sessionId]);

  // Check if class has ended (Only for real sessions)
  useEffect(() => {
    if (!sessionId || !fetchedSessionDetails || !serverTimeData) return;

    const serverTimestamp = getServerTime(serverTimeData);
    const now = new Date(serverTimestamp);

    // Convert session times to user timezone
    const sessionStartInUserTimezone = convertSessionTimeToUserTimezone(
      fetchedSessionDetails.meetingDate,
      fetchedSessionDetails.scheduleStartTime,
      fetchedSessionDetails.timezone
    );

    let sessionEndInUserTimezone = convertSessionTimeToUserTimezone(
      fetchedSessionDetails.meetingDate,
      fetchedSessionDetails.scheduleLastEntryTime,
      fetchedSessionDetails.timezone
    );

    // If session spans midnight (end < start), add 1 day to end time
    if (sessionEndInUserTimezone < sessionStartInUserTimezone) {
      sessionEndInUserTimezone = new Date(
        sessionEndInUserTimezone.getTime() + 24 * 60 * 60 * 1000
      );
    }

    // Check if class has ended
    if (now > sessionEndInUserTimezone) {
      toast.error("This class has ended");
      navigate({ to: "/study-library/live-class" });
      return;
    }

    // Set up interval to check periodically (every 30 seconds)
    const checkInterval = setInterval(() => {
      const currentTime = new Date();
      if (currentTime > sessionEndInUserTimezone) {
        toast.error("This class has ended");
        navigate({ to: "/study-library/live-class" });
        clearInterval(checkInterval);
      }
    }, 30000);

    return () => clearInterval(checkInterval);
  }, [fetchedSessionDetails, serverTimeData, navigate, sessionId]);

  // Helper to safely extract a YouTube video ID from various URL formats
  const extractYouTubeVideoId = (url: string): string | null => {
    if (!url) return null;
    const regExp =
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|live\/))([a-zA-Z0-9_-]{11})/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  };

  const renderEmbeddedSession = () => {
    // Fixed typo: "Embeded" -> "Embedded"
    if (!sessionDetails?.defaultMeetLink) return null;

    // Check link type - default to YouTube if we have a videoUrl but no valid linkType
    const linkType =
      sessionDetails.linkType ||
      (videoUrl ? LinkType.YOUTUBE : LinkType.UNKNOWN);

    // --- YouTube & recorded YouTube links ---
    if (
      linkType === LinkType.YOUTUBE ||
      linkType === LinkType.YOUTUBE_RECORDED
    ) {
      const videoId = extractYouTubeVideoId(
        sessionDetails.customMeetingLink ?? sessionDetails.defaultMeetLink
      );

      // Handle case where video ID extraction fails
      if (!videoId) {
        return (
          <div className="p-4 border border-red-200 rounded-lg bg-red-50 text-red-700">
            Invalid YouTube URL format
            <a href={sessionDetails.defaultMeetLink} target="_blank">
              Click here to view the live
            </a>
          </div>
        );
      }

      const allowPlayPause =
        typeof sessionDetails.allowPlayPause === "string"
          ? sessionDetails.allowPlayPause === "true"
          : sessionDetails.allowPlayPause ?? true;
      const allowRewind = sessionDetails.allowRewind === "true";

      // Check if this is a live session (not recorded)
      const isLive = linkType === LinkType.YOUTUBE && !!sessionId; // Only consider it live if it's a real session

      let sessionStartTime;
      if (isLive && sessionDetails.meetingDate && sessionDetails.scheduleStartTime && sessionDetails.timezone) {
        sessionStartTime = convertSessionTimeToUserTimezone(
          sessionDetails.meetingDate,
          sessionDetails.scheduleStartTime,
          sessionDetails.timezone
        );
      }

      return (
        <div className="w-full h-full flex flex-col gap-4">
          <YouTubePlayerWrapper
            videoId={videoId}
            allowPlayPause={allowPlayPause}
            allowRewind={allowRewind}
            isLiveStream={isLive}
            liveClassStartTime={
              isLive && sessionStartTime ? sessionStartTime.toISOString() : undefined
            }
            enableConcentrationScore={false}
          />
          {learnerButtonConfig?.visible && (
            <div className="flex justify-center mt-4">
              <Button
                variant="default"
                size="lg"
                className="shadow-md hover:shadow-lg transition-all duration-200"
                style={{
                  backgroundColor: learnerButtonConfig.background_color,
                  color: learnerButtonConfig.text_color,
                }}
                onClick={() => window.open(learnerButtonConfig.url, "_blank")}
              >
                {learnerButtonConfig.text}
                <ArrowSquareOut size={20} className="ml-2" />
              </Button>
            </div>
          )}
        </div>
      );
    }

    // --- Zoom recorded links ---
    if (
      linkType === LinkType.ZOOM_RECORDED ||
      linkType === LinkType.ZOOM
    ) {
      return (
        <div className="w-full h-full flex flex-col gap-4">
          <ZoomEmbedPlayer recordingUrl={sessionDetails.defaultMeetLink} />
          {learnerButtonConfig?.visible && (
            <div className="flex justify-center mt-4">
              <Button
                variant="default"
                size="lg"
                className="shadow-md hover:shadow-lg transition-all duration-200"
                style={{
                  backgroundColor: learnerButtonConfig.background_color,
                  color: learnerButtonConfig.text_color,
                }}
                onClick={() => window.open(learnerButtonConfig.url, "_blank")}
              >
                {learnerButtonConfig.text}
                <ArrowSquareOut size={20} className="ml-2" />
              </Button>
            </div>
          )}
        </div>
      );
    }

    // Handle unsupported link types
    return (
      <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50 text-yellow-700">
        Unsupported session type: {linkType}
      </div>
    );
  };

  if (isLoading && sessionId) return <DashboardLoader />;

  if (error && sessionId) {
    return (
      <LayoutContainer>
        <div className="p-4 border border-red-200 rounded-lg bg-red-50 text-red-700">
          Error loading session details: {(error as Error).message}
        </div>
      </LayoutContainer>
    );
  }

  if (!sessionDetails?.defaultMeetLink) {
    if ((sessions as any)?.defaultDayConfig?.defaultClassLink) {
      return (
        <LayoutContainer>
          <div className="flex justify-center p-4">
            <DefaultClassCard
              defaultClassLink={(sessions as any)?.defaultDayConfig?.defaultClassLink}
              learnerButtonConfig={(sessions as any)?.defaultDayConfig?.learnerButtonConfig}
              defaultClassName={(sessions as any)?.defaultDayConfig?.defaultClassName}
            />
          </div>
        </LayoutContainer>
      );
    }

    return (
      <LayoutContainer>
        <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50 text-yellow-700">
          No meeting link available for this session.
        </div>
      </LayoutContainer>
    );
  }

  if (!isSafetyVerified) {
    return (
      <LayoutContainer>
        <div className="w-full h-[calc(100vh-64px)] flex items-center justify-center">
          <SafetyWarningModal
            open={true}
            onAccept={() => setIsSafetyVerified(true)}
            onReject={() => navigate({ to: "/study-library/live-class" })}
          />
        </div>
      </LayoutContainer>
    );
  }

  return (
    <LayoutContainer>
      <Helmet>
        <title>
          {document?.title || sessionDetails.title || (sessionId ? getTerminology(ContentTerms.LiveSession, SystemTerms.LiveSession) : getTerminology(ContentTerms.Session, SystemTerms.Session))}
        </title>
        <meta
          name="description"
          content={`${sessionId ? getTerminology(ContentTerms.LiveSession, SystemTerms.LiveSession) : getTerminology(ContentTerms.Session, SystemTerms.Session)}: ${sessionDetails.title}`}
        />
      </Helmet>

      <div className="flex flex-col h-[calc(100vh-64px)]">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-center mb-6">
            {sessionDetails?.title || getTerminology(ContentTerms.Session, SystemTerms.Session)}
          </h1>
          <span className={`rounded px-3 py-1 text-sm font-semibold uppercase text-white shadow ${sessionId ? "bg-red-600" : "bg-primary-300"}`}>
            {sessionId ? "Live" : "SESSION"}
          </span>
        </div>
        <div className="flex-grow relative flex items-center justify-center p-2">
          {renderEmbeddedSession()}
        </div>
      </div>
    </LayoutContainer>
  );
}
