import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useSessionDetails } from "../-hooks/useSessionDetails";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { LinkType } from "@/routes/register/live-class/-types/enum";
import YouTubePlayerWrapper from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/youtube-player";
import ZoomEmbedPlayer from "@/routes/study-library/live-class/embed/-components/ZoomEmbedPlayer";
import ZohoEmbedPlayer from "@/routes/study-library/live-class/embed/-components/ZohoEmbedPlayer";
import { convertSessionTimeToUserTimezone } from "@/utils/timezone";
import { BASE_URL } from "@/constants/urls";
import axios from "axios";

import { useState } from "react";
import { SafetyWarningModal } from "@/components/common/safety/safety-warning-modal";

export const Route = createFileRoute("/live-class-guest/embed/")({
  validateSearch: z.object({
    sessionId: z.string(),
  }),
  component: GuestEmbedComponent,
});


import { ENABLE_LIVE_CLASS_SAFETY_MODAL } from "@/constants/feature-flags";

function GuestEmbedComponent() {
  const { sessionId } = Route.useSearch();
  const {
    data: sessionDetails,
    isLoading,
    error,
  } = useSessionDetails(sessionId);
  // If safety modal is disabled, we are "verified" by default.
  const [isSafetyVerified, setIsSafetyVerified] = useState(!ENABLE_LIVE_CLASS_SAFETY_MODAL);

  // Utility: extract the 11-character YouTube ID from any common URL form
  const extractYouTubeVideoId = (url: string): string | null => {
    if (!url) return null;
    const regExp =
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|live\/))([a-zA-Z0-9_-]{11})/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  };

  const [bbbJoining, setBbbJoining] = useState(false);
  const [bbbError, setBbbError] = useState<string | null>(null);

  const handleBbbGuestJoin = async () => {
    if (!sessionDetails) return;
    setBbbJoining(true);
    setBbbError(null);
    try {
      const response = await axios.get(
        `${BASE_URL}/admin-core-service/live-session/guest/bbb-join`,
        {
          params: {
            scheduleId: sessionDetails.scheduleId,
            guestName: "Guest",
          },
        }
      );
      if (response.data?.error) {
        setBbbError(response.data.error);
        return;
      }
      const joinUrl = response.data?.joinUrl;
      if (!joinUrl) {
        setBbbError("Failed to get video class URL");
        return;
      }
      window.open(joinUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.error || err?.response?.data?.message || "";
      if (
        errMsg.toLowerCase().includes("ended") ||
        errMsg.toLowerCase().includes("not started")
      ) {
        setBbbError("This class has not started yet or has ended.");
      } else {
        setBbbError("Failed to join video class. Please try again.");
      }
    } finally {
      setBbbJoining(false);
    }
  };

  const renderEmbededSession = () => {
    console.log("[GuestEmbed] Session details:", sessionDetails);

    if (!sessionDetails) return null;

    console.log("[GuestEmbed] Session detail keys:", Object.keys(sessionDetails));

    const linkType = sessionDetails.linkType?.toLowerCase();

    if (!linkType) return null;

    // ----- BBB (live video class) -----
    if (isBbb) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 p-8">
          {bbbError && (
            <div className="p-4 border border-red-200 rounded-lg bg-red-50 text-red-700 text-center">
              {bbbError}
            </div>
          )}
          <button
            onClick={handleBbbGuestJoin}
            disabled={bbbJoining}
            className="px-8 py-4 bg-primary-500 text-white rounded-lg text-lg font-semibold hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {bbbJoining ? "Joining..." : "Join Live Class"}
          </button>
          <p className="text-sm text-gray-500">
            Click to join the live video class in a new window
          </p>
        </div>
      );
    }

    // ----- YouTube (live or recorded) -----
    if (
      linkType === LinkType.YOUTUBE ||
      linkType === LinkType.YOUTUBE_RECORDED
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
      const isLive = linkType === LinkType.YOUTUBE;
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
      linkType === LinkType.ZOOM_RECORDED ||
      linkType === LinkType.ZOOM
    ) {
      return <ZoomEmbedPlayer recordingUrl={sessionDetails.defaultMeetLink} />;
    }

    // ----- Zoho -----
    if (
      linkType === LinkType.ZOHO ||
      linkType === LinkType.ZOHO_MEETING ||
      linkType === LinkType.ZOHO_RECORDED
    ) {
      const zohoUrl = sessionDetails.customMeetingLink || sessionDetails.defaultMeetLink;
      return (
        <ZohoEmbedPlayer
          providerHostUrl={sessionDetails.providerHostUrl}
          meetingUrl={zohoUrl}
        />
      );
    }

    // Check if embedding is enabled — if not, open the link in a new tab
    if (sessionDetails.sessionStreamingServiceType &&
      sessionDetails.sessionStreamingServiceType.toLowerCase() !== "embed") {
      const joinLink = sessionDetails.customMeetingLink || sessionDetails.defaultMeetLink;
      window.open(joinLink, "_blank", "noopener,noreferrer");
      return (
        <div className="flex flex-col items-center justify-center p-12 h-screen bg-white">
          <p className="mt-4 text-neutral-600">Opening meeting link in a new tab...</p>
        </div>
      );
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

  const isBbb =
    sessionDetails?.linkType === "bbb" ||
    sessionDetails?.linkType === LinkType.BBB_MEETING;

  if (!sessionDetails?.defaultMeetLink && !isBbb) {
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
