import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { createFileRoute } from "@tanstack/react-router";
import { Helmet } from "react-helmet";
import { useEffect } from "react";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { useLiveSessions } from "./-hooks/useLiveSessions";
import { SessionDetails } from "./-types/types";
import { MyButton } from "@/components/design-system/button";

export const Route = createFileRoute("/study-library/live-class/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { setNavHeading } = useNavHeadingStore();
  const {
    data: sessions,
    isLoading,
    error,
  } = useLiveSessions("29f4a84e-5fb0-40aa-ac45-1a712d3723b7");

  useEffect(() => {
    setNavHeading(
      <div className="flex items-center gap-2">
        <div>Live Class</div>
      </div>
    );
  }, [setNavHeading]);

  const formatDateTime = (date: string, time: string) => {
    const datetime = new Date(`${date}T${time}`);
    return datetime.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const calculateDuration = (startTime: string, lastEntryTime: string) => {
    const [startHours, startMinutes] = startTime.split(":").map(Number);
    const [endHours, endMinutes] = lastEntryTime.split(":").map(Number);

    let durationMinutes =
      endHours * 60 + endMinutes - (startHours * 60 + startMinutes);

    // Handle case where session ends next day
    if (durationMinutes < 0) {
      durationMinutes += 24 * 60;
    }

    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    if (hours === 0) {
      return `${minutes} minutes`;
    } else if (minutes === 0) {
      return `${hours} hour${hours > 1 ? "s" : ""}`;
    } else {
      return `${hours} hour${hours > 1 ? "s" : ""} ${minutes} minutes`;
    }
  };

  const renderSession = (session: SessionDetails, isLive: boolean) => (
    <div
      key={session.session_id}
      className="p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow w-full"
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium text-lg">{session.title}</h3>
          <p className="text-sm text-gray-600 mt-1">{session.subject}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
            {session.recurrence_type.toLowerCase()}
          </span>
          {isLive && (
            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
              Live Now
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-row gap-6">
        <p className="text-sm">
          <span className="font-medium">Starts:</span>{" "}
          {formatDateTime(session.meeting_date, session.start_time)}
        </p>
        <p className="text-sm">
          <span className="font-medium">Duration:</span>{" "}
          {calculateDuration(session.start_time, session.last_entry_time)}
        </p>
      </div>

      {isLive && session.meeting_link && (
        <MyButton buttonType="secondary" className="mt-2">
          Join Session
        </MyButton>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <LayoutContainer>
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="animate-pulse text-gray-600">Loading sessions...</div>
        </div>
      </LayoutContainer>
    );
  }

  if (error) {
    return (
      <LayoutContainer>
        <div className="p-4 border border-red-200 rounded-lg bg-red-50 text-red-700">
          Error loading sessions: {(error as Error).message}
        </div>
      </LayoutContainer>
    );
  }

  const liveSessions = sessions?.live_sessions ?? [];
  const upcomingSessions = sessions?.upcoming_sessions ?? [];

  return (
    <LayoutContainer>
      <Helmet>
        <title>Live Classes</title>
        <meta name="description" content="Live and upcoming class sessions" />
      </Helmet>

      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-semibold mb-4">Live Sessions</h2>
          {liveSessions.length > 0 ? (
            <div className="space-y-4 w-full">
              {liveSessions.map((session) => renderSession(session, true))}
            </div>
          ) : (
            <p className="text-gray-600 p-4 bg-gray-50 rounded-lg w-full">
              No live sessions at the moment
            </p>
          )}
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-4">Upcoming Sessions</h2>
          {upcomingSessions.length > 0 ? (
            <div className="space-y-4 w-full">
              {upcomingSessions.map((session) => renderSession(session, false))}
            </div>
          ) : (
            <p className="text-gray-600 p-4 bg-gray-50 rounded-lg w-full">
              No upcoming sessions scheduled
            </p>
          )}
        </div>
      </div>
    </LayoutContainer>
  );
}
