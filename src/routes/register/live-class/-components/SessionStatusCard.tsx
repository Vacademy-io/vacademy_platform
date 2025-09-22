import { MyButton } from "@/components/design-system/button";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SessionDetailsResponse } from "@/routes/study-library/live-class/-types/types";
import { SessionStreamingServiceType } from "@/routes/register/live-class/-types/enum";
import { useMarkAttendance } from "@/routes/live-class-guest/-hooks/useMarkAttendance";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import dayjs from "dayjs";
import {
  convertSessionTimeToUserTimezone,
  formatSessionTimeInUserTimezone,
} from "@/utils/timezone";
import { format } from "date-fns";

interface SessionStatusCardProps {
  sessionDetails: SessionDetailsResponse;
  registrationResponse: string;
  alreadyRegisteredEmail: string;
  earliestScheduleId: string;
}

export default function SessionStatusCard({
  sessionDetails,
  registrationResponse,
  alreadyRegisteredEmail,
  earliestScheduleId,
}: SessionStatusCardProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();
  const { mutateAsync: markAttendance } = useMarkAttendance();

  // Helper function to get timezone-aware session times
  const getSessionTimes = useCallback(() => {
    const sessionTimezone =
      "timezone" in sessionDetails
        ? (sessionDetails as SessionDetailsResponse & { timezone?: string })
            .timezone
        : undefined;

    if (sessionTimezone) {
      const sessionDate = convertSessionTimeToUserTimezone(
        sessionDetails.meetingDate,
        sessionDetails.scheduleStartTime,
        sessionTimezone
      );

      const waitingRoomStart = new Date(sessionDate);
      waitingRoomStart.setMinutes(
        waitingRoomStart.getMinutes() - (sessionDetails.waitingRoomTime ?? 0)
      );
      return { sessionDate, waitingRoomStart };
    } else {
      // Fallback to original logic
      const sessionDate = new Date(
        `${sessionDetails.meetingDate}T${sessionDetails.scheduleStartTime}`
      );
      const waitingRoomStart = new Date(sessionDate);
      waitingRoomStart.setMinutes(
        waitingRoomStart.getMinutes() - (sessionDetails.waitingRoomTime ?? 0)
      );
      return { sessionDate, waitingRoomStart };
    }
  }, [sessionDetails]);

  useEffect(() => {
    setCurrentTime(new Date());

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (sessionDetails && registrationResponse) {
      const now = currentTime;
      const { sessionDate, waitingRoomStart } = getSessionTimes();

      const isInWaitingRoom = now >= waitingRoomStart && now < sessionDate;
      const isInMainSession = now >= sessionDate;

      const handleSessionNavigation = async () => {
        if (isInWaitingRoom) {
          await navigate({
            to: "/live-class-guest/waiting-room",
            search: {
              sessionId: earliestScheduleId || "",
              guestId: registrationResponse || "",
            },
          });
        } else if (
          isInMainSession &&
          sessionDetails?.defaultMeetLink &&
          sessionDetails?.sessionStreamingServiceType ===
            SessionStreamingServiceType.EMBED
        ) {
          await markAttendance({
            sessionId: sessionDetails.sessionId,
            scheduleId: earliestScheduleId || "",
            userSourceType: "EXTERNAL_USER",
            userSourceId: registrationResponse || "",
            details: "Guest joined live class from waiting room",
          });
          navigate({
            to: "/live-class-guest/embed",
            search: {
              sessionId: earliestScheduleId || "",
            },
          });
        } else if (
          isInMainSession &&
          sessionDetails?.defaultMeetLink &&
          sessionDetails?.sessionStreamingServiceType ===
            SessionStreamingServiceType.REDIRECT
        ) {
          window.open(
            sessionDetails?.defaultMeetLink,
            "_blank",
            "noopener,noreferrer"
          );
        }
      };

      handleSessionNavigation();
    }
  }, [
    sessionDetails,
    currentTime,
    registrationResponse,
    earliestScheduleId,
    navigate,
    markAttendance,
    getSessionTimes,
  ]);

  const formatDateTime = (dateStr: string | undefined) => {
    if (!dateStr) return "";
    return dayjs(dateStr).format("hh:mm A");
  };

  // Helper function to get session timezone
  const getSessionTimezone = useCallback(() => {
    return "timezone" in sessionDetails
      ? (sessionDetails as SessionDetailsResponse & { timezone?: string })
          .timezone
      : undefined;
  }, [sessionDetails]);

  // Helper function to format start time using existing timezone utility
  const formatStartTime = useCallback(() => {
    const sessionTimezone = getSessionTimezone();
    if (sessionTimezone) {
      return formatSessionTimeInUserTimezone(
        sessionDetails.meetingDate,
        sessionDetails.scheduleStartTime,
        sessionTimezone
      );
    } else {
      return formatDateTime(
        `${sessionDetails.meetingDate}T${sessionDetails.scheduleStartTime}`
      );
    }
  }, [
    getSessionTimezone,
    sessionDetails.meetingDate,
    sessionDetails.scheduleStartTime,
  ]);

  // Helper function to format waiting room time
  const formatWaitingRoomTime = useCallback(() => {
    const sessionTimezone = getSessionTimezone();

    if (sessionTimezone) {
      // Convert session start time to user timezone first
      const sessionStartInUserTz = convertSessionTimeToUserTimezone(
        sessionDetails.meetingDate,
        sessionDetails.scheduleStartTime,
        sessionTimezone
      );

      // Subtract waiting room time
      const waitingRoomStartTime = new Date(
        sessionStartInUserTz.getTime() -
          sessionDetails.waitingRoomTime! * 60 * 1000
      );

      return format(waitingRoomStartTime, "h:mm aa");
    } else {
      // Fallback to original logic
      return formatDateTime(
        new Date(
          new Date(
            `${sessionDetails.meetingDate}T${sessionDetails.scheduleStartTime}`
          ).getTime() -
            sessionDetails.waitingRoomTime! * 60 * 1000
        ).toISOString()
      );
    }
  }, [
    getSessionTimezone,
    sessionDetails.meetingDate,
    sessionDetails.scheduleStartTime,
    sessionDetails.waitingRoomTime,
  ]);

  // Helper functions for session actions
  const handleJoinLiveSession = async () => {
    if (
      sessionDetails.sessionStreamingServiceType ===
      SessionStreamingServiceType.EMBED
    ) {
      await markAttendance({
        sessionId: sessionDetails.sessionId,
        scheduleId: earliestScheduleId || "",
        userSourceType: "EXTERNAL_USER",
        userSourceId: registrationResponse || "",
        details: "Guest joined live class",
      });
      navigate({
        to: "/live-class-guest/embed",
        search: {
          sessionId: earliestScheduleId || "",
        },
      });
    } else {
      window.open(
        sessionDetails.defaultMeetLink,
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  const handleEnterWaitingRoom = () => {
    navigate({
      to: "/live-class-guest/waiting-room",
      search: {
        sessionId: earliestScheduleId || "",
        guestId: registrationResponse || "",
      },
    });
  };

  // Helper function to render session status
  const renderSessionStatus = () => {
    if (isInMainSession) {
      return (
        <div className="mt-3 sm:mt-4">
          <div className="text-green-600 text-sm sm:text-base mb-2 font-medium">
            {getTerminology(ContentTerms.Session, SystemTerms.Session)} is Live!
          </div>
          <MyButton
            buttonType="primary"
            className="w-full h-10 sm:h-12 text-sm sm:text-base"
            onClick={handleJoinLiveSession}
          >
            Join Live{" "}
            {getTerminology(ContentTerms.Session, SystemTerms.Session)}
          </MyButton>
        </div>
      );
    } else if (isInWaitingRoom) {
      return (
        <div className="mt-3 sm:mt-4">
          <div className="text-orange-600 text-sm sm:text-base mb-2 font-medium">
            Waiting Room is Open
          </div>
          <MyButton
            buttonType="primary"
            className="w-full h-10 sm:h-12 text-sm sm:text-base"
            onClick={handleEnterWaitingRoom}
          >
            Enter Waiting Room
          </MyButton>
        </div>
      );
    } else {
      return (
        <div className="mt-3 sm:mt-4">
          <div className="text-gray-500 text-sm sm:text-base mb-2 font-medium">
            {getTerminology(ContentTerms.Session, SystemTerms.Session)} hasn't
            started yet
          </div>
          <MyButton buttonType="secondary" className="w-full h-10 sm:h-12 text-sm sm:text-base" disabled>
            {getTerminology(ContentTerms.Session, SystemTerms.Session)} will
            start soon
          </MyButton>
        </div>
      );
    }
  };

  const now = currentTime;
  const { sessionDate, waitingRoomStart } = getSessionTimes();

  const isInWaitingRoom = now >= waitingRoomStart && now < sessionDate;
  const isInMainSession = now >= sessionDate;

  return (
    <div className="flex flex-col gap-4 sm:gap-6 justify-center items-center p-4 sm:p-6 text-center">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <span className="text-xl sm:text-2xl text-green-600">✓</span>
        </div>
        <div className="font-bold text-lg sm:text-xl text-green-700">
          Already Registered!
        </div>
        <div className="text-sm sm:text-base text-gray-600">
          You're already registered for this session with email:
        </div>
        <div className="font-semibold text-primary-600 bg-primary-50 px-3 py-2 sm:px-4 rounded-lg text-sm sm:text-base break-all">
          {alreadyRegisteredEmail}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:gap-4 w-full">
        <div className="flex flex-col gap-2 text-sm sm:text-base">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2">
            <span className="text-gray-600 font-medium">Start Time:</span>
            <span className="font-semibold text-gray-800">{formatStartTime()}</span>
          </div>
          {sessionDetails.waitingRoomTime && (
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2">
              <span className="text-gray-600 font-medium">Waiting Room Opens:</span>
              <span className="font-semibold text-gray-800">{formatWaitingRoomTime()}</span>
            </div>
          )}
        </div>

        {renderSessionStatus()}
      </div>
    </div>
  );
}
