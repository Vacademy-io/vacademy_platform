import dayjs from "dayjs";
import CountdownTimer from "./CountDown";
import RegistrationLogo from "@/svgs/registration-logo.svg?url";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import { SessionDetailsResponse } from "@/routes/study-library/live-class/-types/types";
import { convertSessionTimeToUserTimezone } from "@/utils/timezone";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface SessionInfoProps {
  sessionTitle?: string;
  startTime?: string;
  lastEntryTime?: string;
  subject?: string;
  coverFileUrl?: string;
  sessionDetails?: SessionDetailsResponse | null;
  instituteName?: string | null;
  instituteLogoUrl?: string | null;
}

export default function SessionInfo({
  sessionTitle,
  startTime,
  lastEntryTime,
  subject,
  coverFileUrl,
  sessionDetails,
  instituteName,
  instituteLogoUrl,
}: SessionInfoProps) {
  const getSessionTimezone = () => {
    return "timezone" in (sessionDetails || {})
      ? (sessionDetails as SessionDetailsResponse & { timezone?: string })
          .timezone
      : undefined;
  };

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

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "";
    const convertedTime = convertTimeForDisplay(dateStr);
    return dayjs(convertedTime).format("ddd, MMM D, YYYY");
  };

  const getConvertedStartTime = () => {
    const convertedTime = convertTimeForDisplay(startTime);
    return convertedTime || startTime;
  };

  const convertedStartTime = getConvertedStartTime();

  return (
    <div className="flex flex-col gap-6 h-full w-full lg:w-[50%] lg:max-w-[560px] items-center">
      {/* Institute Branding */}
      <div className="flex items-center gap-3">
        {instituteLogoUrl ? (
          <img
            src={instituteLogoUrl}
            alt={instituteName || "Institute"}
            className="h-9 sm:h-10 w-auto object-contain"
          />
        ) : (
          <div className="h-9 sm:h-10 w-9 sm:w-10 bg-primary-100 rounded-lg flex items-center justify-center">
            <span className="text-primary-500 font-bold text-base">
              {instituteName ? instituteName.charAt(0).toUpperCase() : "V"}
            </span>
          </div>
        )}
        {instituteName && (
          <span className="text-sm sm:text-base font-semibold text-gray-700">
            {instituteName}
          </span>
        )}
      </div>

      {/* Session Title */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight tracking-tight">
          {sessionTitle}
        </h1>
        {!isNullOrEmptyOrUndefined(subject) && (
          <Badge
            variant="outline"
            className="text-primary-500 border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium"
          >
            {getTerminology(ContentTerms.Subjects, SystemTerms.Subjects)}:{" "}
            {subject}
          </Badge>
        )}
      </div>

      {/* Countdown */}
      {convertedStartTime && (
        <CountdownTimer startTime={convertedStartTime} />
      )}

      {/* Description Card or Illustration */}
      {sessionDetails?.descriptionHtml &&
      sessionDetails.descriptionHtml.trim() !== "" ? (
        <Card className="w-full border-primary-100/60 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div
              className="max-h-[28vh] sm:max-h-[35vh] overflow-auto prose prose-sm max-w-none text-gray-600 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: sessionDetails.descriptionHtml,
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="w-full flex items-center justify-center py-2">
          <img
            src={RegistrationLogo}
            alt="Registration"
            className="max-w-[280px] max-h-[200px] object-contain opacity-70"
          />
        </div>
      )}

      {/* Session Details Bar */}
      <Card className="w-full border-primary-100/60 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-3 sm:gap-5 text-sm flex-wrap">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-primary-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6l4 2"
                />
                <circle cx="12" cy="12" r="10" />
              </svg>
              <span className="text-gray-500">Start</span>
              <span className="font-semibold text-gray-800">
                {formatDateTime(startTime)}
              </span>
            </div>

            <Separator orientation="vertical" className="h-4" />

            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-primary-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6l4 2"
                />
                <circle cx="12" cy="12" r="10" />
              </svg>
              <span className="text-gray-500">End</span>
              <span className="font-semibold text-gray-800">
                {formatDateTime(lastEntryTime)}
              </span>
            </div>

            {startTime && (
              <>
                <Separator orientation="vertical" className="h-4 hidden sm:block" />
                <div className="flex items-center gap-2 hidden sm:flex">
                  <svg
                    className="w-4 h-4 text-primary-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  <span className="font-medium text-gray-700">
                    {formatDate(startTime)}
                  </span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
