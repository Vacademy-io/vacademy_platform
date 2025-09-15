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
  const formatDateTime = (dateStr: string | undefined) => {
    if (!dateStr) return "";
    return dayjs(dateStr).format("hh:mm A");
  };

  // Convert session time to user timezone for countdown
  const getConvertedStartTime = () => {
    if (!startTime || !sessionDetails?.meetingDate) return startTime;

    const sessionTimezone =
      "timezone" in sessionDetails
        ? (sessionDetails as SessionDetailsResponse & { timezone?: string })
            .timezone
        : undefined;

    if (sessionTimezone) {
      const convertedTime = convertSessionTimeToUserTimezone(
        sessionDetails.meetingDate,
        startTime,
        sessionTimezone
      );

      return convertedTime.toISOString();
    }

    return startTime;
  };

  const convertedStartTime = getConvertedStartTime();

  return (
    <div className="flex flex-col gap-6 h-full w-[40%] max-sm:w-full items-center">
      {coverFileUrl ? (
        <img
          src={coverFileUrl}
          alt={sessionTitle}
          className="h-12 w-auto object-contain"
        />
      ) : (
        <div>Logo</div>
      )}
      <div className="text-h2">{sessionTitle}</div>
      <div>
        {convertedStartTime && (
          <CountdownTimer startTime={convertedStartTime} />
        )}
      </div>
      <div>
        {sessionDetails?.descriptionHtml &&
        sessionDetails.descriptionHtml.trim() !== "" ? (
          <div
            className="w-full max-h-[45vh] overflow-auto p-4 bg-white rounded-lg shadow-sm border prose prose-sm max-w-none"
            style={{
              lineHeight: "1.6",
            }}
            dangerouslySetInnerHTML={{
              __html: sessionDetails.descriptionHtml,
            }}
          />
        ) : (
          <div className="size-[45vh]">
            <img
              src={RegistrationLogo}
              alt="Registration Logo"
              className="size-full"
            />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <div className="font-bold">Live Class Details</div>
        <div className="flex flex-row gap-6">
          <div className="flex flex-row gap-2">
            <div>Start Time:</div>
            <div>{formatDateTime(startTime)}</div>
          </div>
          <div className="flex flex-row gap-2">
            <div>End Time:</div>
            <div>{formatDateTime(lastEntryTime)}</div>
          </div>
          {!isNullOrEmptyOrUndefined(subject) && (
            <div className="flex flex-row gap-2">
              <div>
                {getTerminology(ContentTerms.Subjects, SystemTerms.Subjects)}:
              </div>
              <div>{subject}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
