import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { Helmet } from "react-helmet";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { useEffect, useState } from "react";
import { useSessionDetails } from "../-hooks/useSessionDetails";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { CountdownTimer } from "./-components/CountdownTimer";
import { getPublicUrl } from "@/services/upload_file";
import { BackgroundMusic } from "./-components/BackgroundMusic";
import { SessionStreamingServiceType } from "@/routes/register/live-class/-types/enum";
import { useMarkAttendance } from "../-hooks/useMarkAttendance";
import { toast } from "sonner";

export const Route = createFileRoute("/study-library/live-class/waiting-room/")(
  {
    validateSearch: z.object({
      sessionId: z.string(),
    }),
    component: WaitingRoomComponent,
  }
);

function WaitingRoomComponent() {
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

  const fetchThumbnail = async () => {
    if (sessionDetails?.thumbnailFileId) {
      const thumbnailUrl = await getPublicUrl(sessionDetails.thumbnailFileId);
      setThumbnail(thumbnailUrl);
    }
  };

  useEffect(() => {
    setNavHeading("Waiting Room");
    if (sessionDetails?.thumbnailFileId) {
      fetchThumbnail();
    }
  }, [sessionDetails]);

  // Handle session start
  useEffect(() => {
    if (sessionDetails) {
      const checkSessionStart = async () => {
        const now = new Date();
        const sessionStart = new Date(
          `${sessionDetails.meetingDate}T${sessionDetails.scheduleStartTime}`
        );

        if (now >= sessionStart && sessionDetails.defaultMeetLink) {
          try {
            // Mark attendance before redirecting
            await markAttendance({
              sessionId: sessionDetails.sessionId,
              scheduleId: sessionId,
              userSourceType: "USER",
              userSourceId: "",
              details: "Joined live class from waiting room",
            });

            // Redirect to the meeting when session starts
            if (
              sessionDetails.sessionStreamingServiceType ===
              SessionStreamingServiceType.EMBED
            ) {
              navigate({
                to: "/study-library/live-class/embed",
                search: { sessionId: sessionId },
              });
            } else {
              window.open(
                sessionDetails.defaultMeetLink,
                "_blank",
                "noopener,noreferrer"
              );
              // Navigate back to live classes page
              navigate({ to: "/study-library/live-class" });
            }
          } catch (error) {
            console.error("Failed to mark attendance:", error);
            toast.error("Failed to mark attendance");

            // Still proceed with redirection even if attendance marking fails
            if (
              sessionDetails.sessionStreamingServiceType ===
              SessionStreamingServiceType.EMBED
            ) {
              navigate({
                to: "/study-library/live-class/embed",
                search: { sessionId: sessionId },
              });
            } else {
              window.open(
                sessionDetails.defaultMeetLink,
                "_blank",
                "noopener,noreferrer"
              );
              navigate({ to: "/study-library/live-class" });
            }
          }
        }
      };

      // Check immediately
      checkSessionStart();

      // Check every 30 seconds
      const timer = setInterval(checkSessionStart, 30000);

      return () => clearInterval(timer);
    }
  }, [sessionDetails, navigate, markAttendance, sessionId]);

  if (isLoading) {
    return <DashboardLoader />;
  }

  if (error) {
    return (
      <LayoutContainer>
        <div className="p-4 border border-red-200 rounded-lg bg-red-50 text-red-700">
          Error loading session details: {(error as Error).message}
        </div>
      </LayoutContainer>
    );
  }

  return (
    <LayoutContainer>
      <Helmet>
        <title>Live Classes</title>
        <meta name="description" content="Live and upcoming class sessions" />
      </Helmet>

      <div className="flex flex-col items-center w-full justify-center p-1 gap-4">
        <h1 className="text-2xl font-bold text-center mb-6">
          {sessionDetails?.title || "Session"}
        </h1>
        <div>Get ready to flow! The session will begin in:</div>
        <div className="space-y-6">
          {sessionDetails && (
            <CountdownTimer
              startTime={`${sessionDetails.meetingDate}T${sessionDetails.scheduleStartTime}`}
              waitingRoomTime={sessionDetails.waitingRoomTime}
            />
          )}
        </div>
        {thumbnail && (
          <img
            src={thumbnail}
            alt="Session Thumbnail"
            className="w-full max-h-[300px] rounded-lg object-contain bg-gray-50"
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
