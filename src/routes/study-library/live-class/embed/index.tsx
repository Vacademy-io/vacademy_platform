import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { Helmet } from "react-helmet";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { useEffect } from "react";
import { useSessionDetails } from "../-hooks/useSessionDetails";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { LinkType } from "@/routes/register/live-class/-types/enum";
import YouTubePlayerWrapper from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/youtube-player";
import ZoomEmbedPlayer from "./-components/ZoomEmbedPlayer";

export const Route = createFileRoute("/study-library/live-class/embed/")({
  validateSearch: z.object({
    sessionId: z.string(),
  }),
  component: EmbedComponent,
});

function EmbedComponent() {
  const { sessionId } = Route.useSearch();
  const { setNavHeading } = useNavHeadingStore();
  const {
    data: sessionDetails,
    isLoading,
    error,
  } = useSessionDetails(sessionId);

  useEffect(() => {
    if (sessionDetails?.title) {
      setNavHeading(`Live Session - ${sessionDetails.title}`);
    } else {
      setNavHeading("Live Session");
    }
  }, [sessionDetails, setNavHeading]);

  // Helper to safely extract a YouTube video ID from various URL formats
  const extractYouTubeVideoId = (url: string): string | null => {
    if (!url) return null;
    const regExp =
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  };

  const renderEmbeddedSession = () => { // Fixed typo: "Embeded" -> "Embedded"
    if (!sessionDetails?.linkType) return null;

    // --- YouTube & recorded YouTube links ---
    if (
      sessionDetails.linkType === LinkType.YOUTUBE ||
      sessionDetails.linkType === LinkType.YOUTUBE_RECORDED
    ) {
      const videoId = extractYouTubeVideoId(sessionDetails.defaultMeetLink);
      
      // Handle case where video ID extraction fails
      if (!videoId) {
        return (
          <div className="p-4 border border-red-200 rounded-lg bg-red-50 text-red-700">
            Invalid YouTube URL format
          </div>
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sessionData = sessionDetails as any; // Consider creating proper types
      const allowPlayPause = Boolean(
        sessionData?.allowPlayPause ??
        sessionData?.isPlayPauseEnabled ??
        sessionData?.playPauseEnabled ??
        sessionData?.enablePlayPause ??
        true
      );

      // Normalize allowRewind to boolean
      const rawAllowRewind = sessionData?.allowRewind ?? sessionData?.allow_rewind;
      const allowRewind = rawAllowRewind !== undefined
        ? (rawAllowRewind === true || rawAllowRewind === 'true')
        : true;

      return (
        <div className="w-full h-full">
          <YouTubePlayerWrapper
            videoId={videoId}
            allowPlayPause={allowPlayPause}
            allowRewind={allowRewind}
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
        <title>{sessionDetails.title || "Live Session"}</title>
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