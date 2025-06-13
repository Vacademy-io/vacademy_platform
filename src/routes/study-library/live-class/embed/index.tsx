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
import ZoomEmbedPlayer from "./-components/ZoomEnbedPlayer";
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

  const renderEmbededSession = () => {
    if (!sessionDetails?.linkType) return null;

    if (sessionDetails.linkType === LinkType.YOUTUBE) {
      // Extract video ID from URL if it's a full YouTube URL
      const videoId =
        sessionDetails.defaultMeetLink?.split("v=")[1] ||
        sessionDetails.defaultMeetLink;

      return (
        <div className="w-full h-full">
          <YouTubePlayerWrapper videoId={videoId} />
        </div>
      );
    }

    if (sessionDetails.linkType === LinkType.ZOOM_RECORDED) {
      return <ZoomEmbedPlayer recordingUrl={sessionDetails.defaultMeetLink} />;
    }

    return null;
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
          <h1 className="text-2xl font-bold text-center mb-6 ">
            {sessionDetails?.title || "Session"}
          </h1>
          <div>Live</div>
        </div>
        <div className="flex-grow relative flex items-center justify-center p-2">
          <div className="absolute top-10 right-10 p-2 px-4 bg-red-500 text-white z-[1] rounded">
            Live
          </div>
          {renderEmbededSession()}
        </div>
      </div>
    </LayoutContainer>
  );
}
