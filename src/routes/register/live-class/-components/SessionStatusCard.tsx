import { MyButton } from "@/components/design-system/button";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SessionDetailsResponse } from "@/routes/study-library/live-class/-types/types";
import { SessionStreamingServiceType } from "@/routes/register/live-class/-types/enum";
import { useMarkAttendance } from "@/routes/live-class-guest/-hooks/useMarkAttendance";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import dayjs from "dayjs";
import { convertSessionTimeToUserTimezone } from "@/utils/timezone";

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

  const now = currentTime;
  const { sessionDate, waitingRoomStart } = getSessionTimes();

  const isInWaitingRoom = now >= waitingRoomStart && now < sessionDate;
  const isInMainSession = now >= sessionDate;

  return (
    <div className="flex flex-col gap-6 justify-center items-center m-6 text-center">
      <div className="flex flex-col gap-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <span className="text-2xl text-green-600">✓</span>
        </div>
        <div className="font-bold text-xl text-green-700">
          Already Registered!
        </div>
        <div className="text-gray-600">
          You're already registered for this session with email:
        </div>
        <div className="font-semibold text-primary-600 bg-primary-50 px-4 py-2 rounded-lg">
          {alreadyRegisteredEmail}
        </div>
      </div>

      <div className="flex flex-col gap-4 w-full">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Start Time:</span>
            <span className="font-medium">
              {formatDateTime(
                `${sessionDetails.meetingDate}T${sessionDetails.scheduleStartTime}`
              )}
            </span>
          </div>
          {sessionDetails.waitingRoomTime && (
            <div className="flex justify-between">
              <span className="text-gray-600">Waiting Room Opens:</span>
              <span className="font-medium">
                {formatDateTime(
                  new Date(
                    new Date(
                      `${sessionDetails.meetingDate}T${sessionDetails.scheduleStartTime}`
                    ).getTime() -
                      sessionDetails.waitingRoomTime * 60 * 1000
                  ).toISOString()
                )}
              </span>
            </div>
          )}
        </div>

        {(() => {
          if (isInMainSession) {
            return (
              <div className="mt-4">
                <div className="text-green-600 text-sm mb-2">
                  {getTerminology(ContentTerms.Session, SystemTerms.Session)} is
                  Live!
                </div>
                <MyButton
                  buttonType="primary"
                  className="w-full"
                  onClick={async () => {
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
                  }}
                >
                  Join Live{" "}
                  {getTerminology(ContentTerms.Session, SystemTerms.Session)}
                </MyButton>
              </div>
            );
          } else if (isInWaitingRoom) {
            return (
              <div className="mt-4">
                <div className="text-orange-600 text-sm mb-2">
                  Waiting Room is Open
                </div>
                <MyButton
                  buttonType="primary"
                  className="w-full"
                  onClick={() => {
                    navigate({
                      to: "/live-class-guest/waiting-room",
                      search: {
                        sessionId: earliestScheduleId || "",
                        guestId: registrationResponse || "",
                      },
                    });
                  }}
                >
                  Enter Waiting Room
                </MyButton>
              </div>
            );
          } else {
            return (
              <div className="mt-4">
                <div className="text-gray-500 text-sm mb-2">
                  {getTerminology(ContentTerms.Session, SystemTerms.Session)}{" "}
                  hasn't started yet
                </div>
                <MyButton buttonType="secondary" className="w-full" disabled>
                  {getTerminology(ContentTerms.Session, SystemTerms.Session)}{" "}
                  will start soon
                </MyButton>
              </div>
            );
          }
        })()}
      </div>
    </div>
  );
}
