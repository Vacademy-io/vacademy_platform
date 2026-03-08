import { useEffect, useState, useCallback } from "react";
import { useSessionCustomFields } from "../-hooks/useGetRegistrationFormData";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { toast } from "sonner";
import {
  transformToCollectPublicUserDataDTO,
  transformToGuestRegistrationDTO,
} from "../-utils/helper";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { AccessLevel } from "../-types/enum";
import { RegistrationFormValues } from "../-types/type";
import {
  useCollectPublicUserData,
  useLiveSessionGuestRegistration,
} from "../-hooks/useLiveSessionGuestRegistration";
import { useEarliestScheduleId } from "../-hooks/useEarliestScheduleId";
import { fetchSessionDetails } from "@/routes/live-class-guest/-hooks/useSessionDetails";
import { SessionDetailsResponse } from "@/routes/study-library/live-class/-types/types";
import { SessionStreamingServiceType } from "@/routes/register/live-class/-types/enum";
import { getPublicFileUrl } from "../-hooks/getPublicUrl";
import { useMarkAttendance } from "@/routes/live-class-guest/-hooks/useMarkAttendance";
import axios from "axios";
import { LIVE_SESSION_CHECK_EMAIL_REGISTRATION } from "@/constants/urls";
import { convertSessionTimeToUserTimezone } from "@/utils/timezone";

// Import the separated components
import EmailVerificationDialog from "./EmailVerificationDialog";
import RegistrationForm from "./RegistrationForm";
import SessionStatusCard from "./SessionStatusCard";
import SessionInfo from "./SessionInfo";
import { Preferences } from "@capacitor/preferences";

export default function LiveClassRegistrationPage() {
  const [dialog, setDialog] = useState<boolean>(false);
  const [sessionDetails, setSessionDetails] =
    useState<SessionDetailsResponse | null>(null);
  const router = useRouter();
  const { sessionId } = router.state.location.search;
  const { data, isLoading } = useSessionCustomFields(sessionId || "");
  const { data: earliestScheduleId } = useEarliestScheduleId(sessionId || "");
  const navigate = useNavigate();
  const [coverFileUrl, setCoverFileUrl] = useState<string | undefined>(
    undefined
  );
  const [registrationResponse, setRegistrationResponse] = useState<string>("");
  const { mutateAsync: registerGuestUser } = useLiveSessionGuestRegistration();
  const { mutateAsync: collectPublicUserData } = useCollectPublicUserData();
  const [verifiedEmail, setVerifiedEmail] = useState<string>("");
  const [verifiedEmails, setVerifiedEmails] = useState<string[]>([]);
  const [isUserAlreadyRegistered, setIsUserAlreadyRegistered] =
    useState<boolean>(false);
  const [alreadyRegisteredEmail, setAlreadyRegisteredEmail] =
    useState<string>("");

  const { mutateAsync: markAttendance } = useMarkAttendance();

  // Load verified emails from local storage
  useEffect(() => {
    const savedVerifiedEmails = JSON.parse(
      localStorage.getItem("verifiedEmail") || "[]"
    );
    setVerifiedEmails(savedVerifiedEmails);

    if (savedVerifiedEmails.length > 0) {
      setVerifiedEmail(savedVerifiedEmails[0]);
    } else {
      setDialog(true);
    }
  }, []);

  const fetchCoverFileUrl = useCallback(async () => {
    const response = await getPublicFileUrl(data?.coverFileId || "");
    setCoverFileUrl(response);
  }, [data?.coverFileId]);

  const fetchSessionDetail = useCallback(async (id: string) => {
    try {
      const response = await fetchSessionDetails(id);
      setSessionDetails(response);
    } catch (error) {
      console.error("Failed to fetch session details:", error);
    }
  }, []);

  useEffect(() => {
    if (!sessionId) {
      router.navigate({ to: "/dashboard" });
    } else {
      const scheduleIdToUse = earliestScheduleId || sessionId;
      fetchSessionDetail(scheduleIdToUse);
    }
  }, [sessionId, earliestScheduleId, fetchSessionDetail, router]);

  useEffect(() => {
    if (data?.accessLevel === AccessLevel.PRIVATE) {
      router.navigate({ to: "/study-library/live-class" });
    } else {
      fetchCoverFileUrl();
    }
  }, [data, fetchCoverFileUrl, router]);

  const onSubmit = async (formValues: RegistrationFormValues) => {
    let payload;
    let userPayload;
    const email = String(formValues.email);
    try {
      payload = transformToGuestRegistrationDTO(
        formValues,
        data?.sessionId || "",
        data?.customFields || []
      );

      userPayload = transformToCollectPublicUserDataDTO(
        formValues,
        data?.sessionId || "",
        data?.customFields || []
      );
    } catch (error) {
      toast.error("Error building request");
      console.error("DTO transformation error:", error);
      return;
    }

    try {
      const registerResponse = await registerGuestUser(payload);
      setRegistrationResponse(registerResponse);

      if (registerResponse) {
        await Preferences.set({
          key: "live-session-email",
          value: email,
        });
        await Preferences.set({
          key: "live-session-guestId",
          value: registerResponse,
        });
        toast.success("Registration successful");

        const sessionDetailResponse = await fetchSessionDetails(
          earliestScheduleId || ""
        );

        if (sessionDetailResponse) {
          await handlePostRegistrationNavigation(
            sessionDetailResponse,
            registerResponse
          );
          setSessionDetails(sessionDetailResponse);
          setIsUserAlreadyRegistered(true);
          setAlreadyRegisteredEmail(email);
        }
      }

      try {
        await collectPublicUserData({
          payload: userPayload,
          instituteId: data?.instituteId || "",
        });
      } catch (collectError) {
        console.error("Failed to collect public user data:", collectError);
      }
    } catch (error: any) {
      console.error("Registration API call failed:", error);

      if (error?.response?.status === 511 || error?.response?.data?.ex?.includes("already")) {
        setIsUserAlreadyRegistered(true);
        setAlreadyRegisteredEmail(email);
        const storedGuestId = await Preferences.get({
          key: "live-session-guestId",
        });
        if (storedGuestId?.value) {
          setRegistrationResponse(storedGuestId.value);
          const sessionDetailResponse = await fetchSessionDetails(
            earliestScheduleId || ""
          );

          if (sessionDetailResponse) {
            await handlePostRegistrationNavigation(
              sessionDetailResponse,
              storedGuestId.value
            );
            setSessionDetails(sessionDetailResponse);
          }
        }
      }
    }
  };

  const handlePostRegistrationNavigation = async (
    sessionDetailResponse: SessionDetailsResponse,
    guestId: string
  ) => {
    const now = new Date();

    if (!sessionDetailResponse.meetingDate || !sessionDetailResponse.scheduleStartTime) {
      console.error("Missing session date or time data");
      return;
    }

    // Check if session has timezone information
    const sessionTimezone = (sessionDetailResponse as any).timezone;

    let sessionDate: Date;

    if (sessionTimezone) {
      try {
        sessionDate = convertSessionTimeToUserTimezone(
          sessionDetailResponse.meetingDate,
          sessionDetailResponse.scheduleStartTime,
          sessionTimezone
        );
      } catch (error) {
        console.error("Error converting timezone:", error);
        sessionDate = new Date(`${sessionDetailResponse.meetingDate}T${sessionDetailResponse.scheduleStartTime}`);
      }
    } else {
      sessionDate = new Date(`${sessionDetailResponse.meetingDate}T${sessionDetailResponse.scheduleStartTime}`);
    }

    if (isNaN(sessionDate.getTime())) return;

    const waitingRoomStart = new Date(sessionDate);
    waitingRoomStart.setMinutes(
      waitingRoomStart.getMinutes() - (sessionDetailResponse.waitingRoomTime ?? 0)
    );

    const isInWaitingRoom = now >= waitingRoomStart && now < sessionDate;
    const isInMainSession = now >= sessionDate;

    const handleSessionNavigation = async () => {
      const streamingType = sessionDetailResponse.sessionStreamingServiceType?.toLowerCase();
      if (isInWaitingRoom) {
        await navigate({
          to: "/live-class-guest/waiting-room",
          search: {
            sessionId: earliestScheduleId || "",
            guestId: guestId || "",
          },
        });
      } else if (
        isInMainSession &&
        sessionDetailResponse.defaultMeetLink &&
        streamingType === SessionStreamingServiceType.EMBED.toLowerCase()
      ) {
        try {
          await markAttendance({
            sessionId: sessionDetailResponse.sessionId,
            scheduleId: earliestScheduleId || "",
            userSourceType: "EXTERNAL_USER",
            userSourceId: guestId || "",
            details: "Guest joined live class after registration",
          });
        } catch (err) {
          console.error("Attendance marking failed, but proceeding to embed:", err);
        }
        navigate({
          to: "/live-class-guest/embed",
          search: {
            sessionId: earliestScheduleId || "",
          },
        });
      } else if (
        isInMainSession &&
        sessionDetailResponse.defaultMeetLink &&
        (streamingType === SessionStreamingServiceType.REDIRECT.toLowerCase() || !streamingType)
      ) {
        const joinLink = sessionDetailResponse.customMeetingLink || sessionDetailResponse.defaultMeetLink;
        window.open(joinLink, "_blank", "noopener,noreferrer");
      }
    };

    await handleSessionNavigation();
  };

  const onError = (errors: unknown) => {
    console.log("Validation errors:", errors);
  };

  const checkEmailRegistration = async (email: string) => {
    try {
      const response = await axios.get(LIVE_SESSION_CHECK_EMAIL_REGISTRATION, {
        params: {
          sessionId: data?.sessionId,
          email: email,
        },
      });

      if (response.data === true) {
        setIsUserAlreadyRegistered(true);
        setAlreadyRegisteredEmail(email);
        const storedGuestId = await Preferences.get({
          key: "live-session-guestId",
        });
        if (storedGuestId?.value) {
          setRegistrationResponse(storedGuestId.value);
        }
        toast.success("Email already registered for this session");
        if (sessionId) {
          fetchSessionDetail(earliestScheduleId || "");
        }
      } else {
        setIsUserAlreadyRegistered(false);
        toast.success("Email verified successfully");
      }
    } catch (error) {
      console.error("Failed to check email registration:", error);
    }
  };

  const handleEmailVerified = (email: string) => {
    setVerifiedEmail(email);
    const existingEmails = JSON.parse(localStorage.getItem("verifiedEmail") || "[]");
    if (!existingEmails.includes(email)) {
      const updatedEmails = [...existingEmails, email];
      localStorage.setItem("verifiedEmail", JSON.stringify(updatedEmails));
      setVerifiedEmails(updatedEmails);
    }
    checkEmailRegistration(email);
    setDialog(false);
  };

  const handleEmailChange = (email: string) => {
    setVerifiedEmail(email);
    checkEmailRegistration(email);
  };

  if (isLoading) return <DashboardLoader />;

  return (
    <>
      <div className="w-screen min-h-screen bg-primary-50 p-4 sm:p-8 lg:p-20 flex flex-col lg:flex-row gap-6 lg:gap-8 justify-center lg:justify-around items-center">
        <SessionInfo
          sessionTitle={data?.sessionTitle}
          startTime={data?.startTime}
          lastEntryTime={data?.lastEntryTime}
          subject={data?.subject}
          coverFileUrl={coverFileUrl}
          sessionDetails={sessionDetails}
        />

        <div className="w-full max-w-md lg:w-[35%] flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-md w-full">
            <div className="flex flex-col gap-4">
              {isUserAlreadyRegistered && sessionDetails ? (
                <SessionStatusCard
                  sessionDetails={sessionDetails}
                  registrationResponse={registrationResponse}
                  alreadyRegisteredEmail={alreadyRegisteredEmail}
                  earliestScheduleId={earliestScheduleId || ""}
                />
              ) : (
                <RegistrationForm
                  customFields={data?.customFields || []}
                  verifiedEmail={verifiedEmail}
                  verifiedEmails={verifiedEmails}
                  onSubmit={onSubmit}
                  onError={onError}
                  onEmailChange={handleEmailChange}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <EmailVerificationDialog
        open={dialog}
        sessionId={data?.sessionId || ""}
        instituteId={data?.instituteId || ""}
        onEmailVerified={handleEmailVerified}
      />
    </>
  );
}
