import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { Helmet } from "react-helmet";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { useEffect } from "react";
import { useSessionDetails } from "../-hooks/useSessionDetails";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { LinkType } from "@/routes/register/live-class/-types/enum";
import YouTubePlayerWrapper from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/youtube-player";
import ZoomEmbedPlayer from "./-components/ZoomEmbedPlayer";
import { convertSessionTimeToUserTimezone } from "@/utils/timezone";
import { useServerTime, getServerTime } from "@/hooks/use-server-time";
import { toast } from "sonner";

export const Route = createFileRoute("/study-library/live-class/embed/")({
  validateSearch: z.object({
    sessionId: z.string(),
  }),
  component: EmbedComponent,
});

function EmbedComponent() {
  const { sessionId } = Route.useSearch();
  const { setNavHeading } = useNavHeadingStore();
  const navigate = useNavigate();
  const {
    data: sessionDetails,
    isLoading,
    error,
  } = useSessionDetails(sessionId);
  const { data: serverTimeData } = useServerTime();

  useEffect(() => {
    if (sessionDetails?.title) {
      setNavHeading(`Live Session - ${sessionDetails.title}`);
    } else {
      setNavHeading("Live Session");
    }
  }, [sessionDetails, setNavHeading]);

  // Check if class has ended
  useEffect(() => {
    if (!sessionDetails || !serverTimeData) return;

    const serverTimestamp = getServerTime(serverTimeData);
    const now = new Date(serverTimestamp);

    // Convert session end time to user timezone
    const sessionEndInUserTimezone = convertSessionTimeToUserTimezone(
      sessionDetails.meetingDate,
      sessionDetails.scheduleLastEntryTime,
      sessionDetails.timezone
    );

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
  }, [sessionDetails, serverTimeData, navigate]);

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
    if (!sessionDetails?.linkType) return null;

    // --- YouTube & recorded YouTube links ---
    if (
      sessionDetails.linkType === LinkType.YOUTUBE ||
      sessionDetails.linkType === LinkType.YOUTUBE_RECORDED
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
      const isLive = sessionDetails.linkType === LinkType.YOUTUBE;
      const sessionStartTime = convertSessionTimeToUserTimezone(
        sessionDetails.meetingDate,
        sessionDetails.scheduleStartTime,
        sessionDetails.timezone
      );
      return (
        <div className="w-full h-full">
          <YouTubePlayerWrapper
            videoId={videoId}
            allowPlayPause={allowPlayPause}
            allowRewind={allowRewind}
            isLiveStream={isLive}
            liveClassStartTime={
              isLive ? sessionStartTime.toISOString() : undefined
            }
          />
        </div>
      );
    }

    // --- Zoom recorded links ---
    if (
      sessionDetails.linkType === LinkType.ZOOM_RECORDED ||
      sessionDetails.linkType === LinkType.ZOOM
    ) {
      return <ZoomEmbedPlayer recordingUrl={sessionDetails.defaultMeetLink} />;
    }

    // Handle unsupported link types
    return (
      <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50 text-yellow-700">
        Unsupported session type: {sessionDetails.linkType}
      </div>
    );
  };

  if (isLoading) return <DashboardLoader />;

  if (error) {
    return (
      <LayoutContainer>
        <div className="p-4 border border-red-200 rounded-lg bg-red-50 text-red-700">
          Error loading session details: {(error as Error).message}
        </div>
      </LayoutContainer>
    );
  }

  if (!sessionDetails?.defaultMeetLink) {
    return (
      <LayoutContainer>
        <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50 text-yellow-700">
          No meeting link available for this session.
        </div>
      </LayoutContainer>
    );
  }

  return (
    <LayoutContainer>
      <Helmet>
        <title>
          {document?.title || sessionDetails.title || "Live Session"}
        </title>
        <meta
          name="description"
          content={`Live session: ${sessionDetails.title}`}
        />
      </Helmet>

      <div className="flex flex-col h-[calc(100vh-64px)]">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-center mb-6">
            {sessionDetails?.title || "Session"}
          </h1>
          <span className="rounded bg-red-600 px-3 py-1 text-sm font-semibold uppercase text-white shadow">
            Live
          </span>
        </div>
        <div className="flex-grow relative flex items-center justify-center p-2">
          {renderEmbeddedSession()}
        </div>
      </div>
    </LayoutContainer>
  );
}
