import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useSessionDetails } from "../-hooks/useSessionDetails";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { LinkType } from "@/routes/register/live-class/-types/enum";
import YouTubePlayerWrapper from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/youtube-player";
import ZoomEmbedPlayer from "@/routes/study-library/live-class/embed/-components/ZoomEnbedPlayer";

export const Route = createFileRoute("/live-class-guest/embed/")({
  validateSearch: z.object({
    sessionId: z.string(),
  }),
  component: GuestEmbedComponent,
});

// Helper to extract YouTube video ID from various URL formats
const extractYouTubeVideoId = (url: string | undefined): string | undefined => {
  if (!url) return undefined;

  const regexList = [
    /(?:youtube\.com\/.*[?&]v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const regex of regexList) {
    const match = url.match(regex);
    if (match && match[1]) return match[1];
  }

  return url.length === 11 ? url : undefined;
};

function GuestEmbedComponent() {
  const { sessionId } = Route.useSearch();
  const {
    data: sessionDetails,
    isLoading,
    error,
  } = useSessionDetails(sessionId);

  const renderEmbededSession = () => {
    if (!sessionDetails?.linkType) return null;

    if (
      sessionDetails.linkType === LinkType.YOUTUBE ||
      sessionDetails.linkType === LinkType.YOUTUBE_RECORDED
    ) {
      const videoId = extractYouTubeVideoId(sessionDetails.defaultMeetLink);

      if (!videoId) {
        return (
          <div className="text-center text-red-500">
            Invalid YouTube link provided.
          </div>
        );
      }

      return (
        <div className="w-full h-full">
          <YouTubePlayerWrapper videoId={videoId} />
        </div>
      );
    }

    if (
      sessionDetails.linkType === LinkType.ZOOM ||
      sessionDetails.linkType === LinkType.ZOOM_RECORDED
    ) {
      return <ZoomEmbedPlayer recordingUrl={sessionDetails.defaultMeetLink} />;
    }

    /* Legacy handling
    if (sessionDetails.linkType === LinkType.ZOOM_RECORDED) {
      return <ZoomEmbedPlayer recordingUrl={sessionDetails.defaultMeetLink} />;
    }
    */

    return null;
  };

  if (isLoading) return <DashboardLoader />;

  if (error) {
    return (
      <div className="p-4 border border-red-200 rounded-lg bg-red-50 text-red-700">
        Error loading session details: {(error as Error).message}
      </div>
    );
  }

  if (!sessionDetails?.defaultMeetLink) {
    return (
      <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50 text-yellow-700">
        No meeting link available for this session.
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-primary-50">
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center p-4">
          <h1 className="text-2xl font-bold">
            {sessionDetails?.title || "Session"}
          </h1>
          <div className="bg-red-600 text-white px-2 py-1 rounded text-sm animate-pulse">
            Live
          </div>
        </div>
        <div className="flex-grow relative flex items-center justify-center p-2">
          <div className="absolute top-10 right-10 p-2 px-4 bg-red-500 text-white z-[1] rounded">
            Live
          </div>
          {renderEmbededSession()}
        </div>
      </div>
    </div>
  );
}
