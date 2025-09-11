import { useEffect, useState, useCallback } from "react";
import { useSessionCustomFields } from "../-hooks/useGetRegistrationFormData";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { toast } from "sonner";
import { transformToGuestRegistrationDTO } from "../-utils/helper";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { AccessLevel } from "../-types/enum";
import { RegistrationFormValues } from "../-types/type";
import { useLiveSessionGuestRegistration } from "../-hooks/useLiveSessionGuestRegistration";
import { useEarliestScheduleId } from "../-hooks/useEarliestScheduleId";
import { fetchSessionDetails } from "@/routes/live-class-guest/-hooks/useSessionDetails";
import { SessionDetailsResponse } from "@/routes/study-library/live-class/-types/types";
import { SessionStreamingServiceType } from "@/routes/register/live-class/-types/enum";
import { getPublicFileUrl } from "../-hooks/getPublicUrl";
import { useMarkAttendance } from "@/routes/live-class-guest/-hooks/useMarkAttendance";
import { Storage } from "@capacitor/storage";
import axios from "axios";
import { LIVE_SESSION_CHECK_EMAIL_REGISTRATION } from "@/constants/urls";

// Import the separated components
import EmailVerificationDialog from "./EmailVerificationDialog";
import RegistrationForm from "./RegistrationForm";
import SessionStatusCard from "./SessionStatusCard";
import SessionInfo from "./SessionInfo";

export default function LiveClassRegistrationPage() {
  const [dialog, setDialog] = useState<boolean>(true);
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
  const [verifiedEmail, setVerifiedEmail] = useState<string>("");
  const [isUserAlreadyRegistered, setIsUserAlreadyRegistered] =
    useState<boolean>(false);
  const [alreadyRegisteredEmail, setAlreadyRegisteredEmail] =
    useState<string>("");

  const { mutateAsync: markAttendance } = useMarkAttendance();

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
    const email = String(formValues.email);
    try {
      payload = transformToGuestRegistrationDTO(
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
      const response = await registerGuestUser(payload);
      setRegistrationResponse(response);
      if (response) {
        await Storage.set({
          key: "live-session-email",
          value: email,
        });
        await Storage.set({
          key: "live-session-guestId",
          value: response,
        });
        toast.success("Registration successful");

        const sessionDetailResponse = await fetchSessionDetails(
          earliestScheduleId || ""
        );

        if (sessionDetailResponse) {
          await handlePostRegistrationNavigation(
            sessionDetailResponse,
            response
          );
          setSessionDetails(sessionDetailResponse);
        }
      }
    } catch (error: unknown) {
      console.error("Registration API call failed:", error);

      if (
        (error as { response?: { status?: number } })?.response?.status === 511
      ) {
        setIsUserAlreadyRegistered(true);
        setAlreadyRegisteredEmail(email);
        const storedGuestId = await Storage.get({
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
        return;
      }
    }
  };

  const handlePostRegistrationNavigation = async (
    sessionDetailResponse: SessionDetailsResponse,
    guestId: string
  ) => {
    const now = new Date();
    const sessionDate = new Date(
      `${sessionDetailResponse.meetingDate}T${sessionDetailResponse.scheduleStartTime}`
    );
    const waitingRoomStart = new Date(sessionDate);
    waitingRoomStart.setMinutes(
      waitingRoomStart.getMinutes() -
        (sessionDetailResponse.waitingRoomTime ?? 0)
    );

    const isInWaitingRoom = now >= waitingRoomStart && now < sessionDate;
    const isInMainSession = now >= sessionDate;

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
      sessionDetailResponse.sessionStreamingServiceType ===
        SessionStreamingServiceType.EMBED
    ) {
      await markAttendance({
        sessionId: sessionDetailResponse.sessionId,
        scheduleId: earliestScheduleId || "",
        userSourceType: "EXTERNAL_USER",
        userSourceId: guestId || "",
        details: "Guest joined live class after registration",
      });
      navigate({
        to: "/live-class-guest/embed",
        search: {
          sessionId: earliestScheduleId || "",
        },
      });
    } else if (
      isInMainSession &&
      sessionDetailResponse.defaultMeetLink &&
      sessionDetailResponse.sessionStreamingServiceType ===
        SessionStreamingServiceType.REDIRECT
    ) {
      window.open(
        sessionDetailResponse.defaultMeetLink,
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  const onError = (errors: unknown) => {
    console.log("Validation errors:", errors);
  };

  const checkEmailRegistration = async (email: string) => {
    try {
      const response = await axios.get(LIVE_SESSION_CHECK_EMAIL_REGISTRATION, {
        headers: {
          "Content-Type": "application/json",
        },
        params: {
          sessionId: data?.sessionId,
          email: email,
        },
      });

      if (response.data === true) {
        setIsUserAlreadyRegistered(true);
        setAlreadyRegisteredEmail(email);
        const storedGuestId = await Storage.get({
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
    checkEmailRegistration(email);
    setDialog(false);
  };

  if (isLoading) return <DashboardLoader />;

  return (
    <>
      <div className="w-screen h-screen max-sm:h-fit bg-primary-50 max-sm:p-0 p-20 flex flex-row max-sm:flex-col max-sm:gap-8 justify-around items-center">
        <SessionInfo
          sessionTitle={data?.sessionTitle}
          startTime={data?.startTime}
          lastEntryTime={data?.lastEntryTime}
          subject={data?.subject}
          coverFileUrl={coverFileUrl}
          sessionDetails={sessionDetails}
        />

        <div className="w-[35%] max-sm:w-full max-sm:mb-4 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-md">
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
                  onSubmit={onSubmit}
                  onError={onError}
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
