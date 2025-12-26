import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useSessionDetails } from "../-hooks/useSessionDetails";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { LinkType } from "@/routes/register/live-class/-types/enum";
import YouTubePlayerWrapper from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/youtube-player";
import ZoomEmbedPlayer from "@/routes/study-library/live-class/embed/-components/ZoomEmbedPlayer";
import { convertSessionTimeToUserTimezone } from "@/utils/timezone";

import { useState } from "react";
import { SafetyWarningModal } from "@/components/common/safety/safety-warning-modal";

export const Route = createFileRoute("/live-class-guest/embed/")({
  validateSearch: z.object({
    sessionId: z.string(),
  }),
  component: GuestEmbedComponent,
});


function GuestEmbedComponent() {
  const { sessionId } = Route.useSearch();
  const {
    data: sessionDetails,
    isLoading,
    error,
  } = useSessionDetails(sessionId);
  const [isSafetyVerified, setIsSafetyVerified] = useState(false);

  // Utility: extract the 11-character YouTube ID from any common URL form
  const extractYouTubeVideoId = (url: string): string | null => {
    if (!url) return null;
    const regExp =
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|live\/))([a-zA-Z0-9_-]{11})/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  };

  const renderEmbededSession = () => {
    if (!sessionDetails?.linkType) return null;

    // ----- YouTube (live or recorded) -----
    if (
      sessionDetails.linkType === LinkType.YOUTUBE ||
      sessionDetails.linkType === LinkType.YOUTUBE_RECORDED
    ) {
      const videoId = extractYouTubeVideoId(
        sessionDetails.customMeetingLink ?? sessionDetails.defaultMeetLink
      );
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
            enableConcentrationScore={false}
            liveClassStartTime={
              isLive ? sessionStartTime.toISOString() : undefined
            }
          />
        </div>
      );
    }

    // ----- Zoom (live or recorded) -----
    if (
      sessionDetails.linkType === LinkType.ZOOM_RECORDED ||
      sessionDetails.linkType === LinkType.ZOOM
    ) {
      return <ZoomEmbedPlayer recordingUrl={sessionDetails.defaultMeetLink} />;
    }

    // TODO: handle Google Meet etc.
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

  if (!isSafetyVerified) {
    return (
      <div className="w-screen h-screen bg-primary-50 flex items-center justify-center">
        <SafetyWarningModal
          open={true}
          onAccept={() => setIsSafetyVerified(true)}
          onReject={() => window.history.back()}
        />
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
