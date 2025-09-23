import dayjs from "dayjs";
import CountdownTimer from "./CountDown";
import RegistrationLogo from "@/svgs/registration-logo.svg?url";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import { SessionDetailsResponse } from "@/routes/study-library/live-class/-types/types";
import { convertSessionTimeToUserTimezone } from "@/utils/timezone";

interface SessionInfoProps {
  sessionTitle?: string;
  startTime?: string;
  lastEntryTime?: string;
  subject?: string;
  coverFileUrl?: string;
  sessionDetails?: SessionDetailsResponse | null;
}

export default function SessionInfo({
  sessionTitle,
  startTime,
  lastEntryTime,
  subject,
  coverFileUrl,
  sessionDetails,
}: SessionInfoProps) {
  // Helper function to get session timezone
  const getSessionTimezone = () => {
    return "timezone" in (sessionDetails || {})
      ? (sessionDetails as SessionDetailsResponse & { timezone?: string })
          .timezone
      : undefined;
  };

  // Convert any session time to user timezone for display
  const convertTimeForDisplay = (timeStr: string | undefined) => {
    if (!timeStr || !sessionDetails?.meetingDate) return timeStr;

    const sessionTimezone = getSessionTimezone();

    if (sessionTimezone) {
      try {
        const convertedTime = convertSessionTimeToUserTimezone(
          sessionDetails.meetingDate,
          timeStr,
          sessionTimezone
        );
        return convertedTime.toISOString();
      } catch (error) {
        console.error("Error converting time for display:", error);
        return timeStr;
      }
    }

    return timeStr;
  };

  const formatDateTime = (dateStr: string | undefined) => {
    if (!dateStr) return "";
    const convertedTime = convertTimeForDisplay(dateStr);
    return dayjs(convertedTime).format("hh:mm A");
  };

  // Convert session time to user timezone for countdown
  const getConvertedStartTime = () => {
    const convertedTime = convertTimeForDisplay(startTime);
    return convertedTime || startTime;
  };

  const convertedStartTime = getConvertedStartTime();

  return (
    <div className="flex flex-col gap-3 sm:gap-4 md:gap-6 h-full w-full md:w-[45%] lg:w-[40%] items-center text-center">
      {coverFileUrl ? (
        <img
          src={coverFileUrl}
          alt={sessionTitle}
          className="h-10 sm:h-12 w-auto object-contain"
        />
      ) : (
        <div className="h-10 sm:h-12 flex items-center text-gray-500">Logo</div>
      )}
      <div className="text-xl sm:text-2xl lg:text-h2 font-bold">
        {sessionTitle}
      </div>
      <div>
        {convertedStartTime && (
          <CountdownTimer startTime={convertedStartTime} />
        )}
      </div>
      <div className="w-full">
        {sessionDetails?.descriptionHtml &&
        sessionDetails.descriptionHtml.trim() !== "" ? (
          <div
            className="w-full max-h-[30vh] sm:max-h-[45vh] overflow-auto p-3 sm:p-4 bg-white rounded-lg shadow-sm border prose prose-sm max-w-none"
            style={{
              lineHeight: "1.6",
            }}
            dangerouslySetInnerHTML={{
              __html: sessionDetails.descriptionHtml,
            }}
          />
        ) : (
          <div className="w-full h-[30vh] sm:h-[45vh] flex items-center justify-center">
            <img
              src={RegistrationLogo}
              alt="Registration Logo"
              className="max-w-full max-h-full object-contain"
            />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 w-full">
        <div className="font-bold text-lg">Live Class Details</div>
        <div className="flex flex-wrap gap-3 sm:gap-6 text-sm sm:text-base justify-center md:flex-nowrap">
          <div className="flex flex-row gap-2 whitespace-nowrap">
            <div className="font-medium">Start Time:</div>
            <div className="text-gray-700">{formatDateTime(startTime)}</div>
          </div>
          <div className="flex flex-row gap-2 whitespace-nowrap">
            <div className="font-medium">End Time:</div>
            <div className="text-gray-700">{formatDateTime(lastEntryTime)}</div>
          </div>
          {!isNullOrEmptyOrUndefined(subject) && (
            <div className="flex flex-row gap-2 whitespace-nowrap">
              <div className="font-medium">
                {getTerminology(ContentTerms.Subjects, SystemTerms.Subjects)}:
              </div>
              <div className="text-gray-700">{subject}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
