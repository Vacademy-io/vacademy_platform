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
import { LIVE_SESSION_CHECK_EMAIL_REGISTRATION, urlInstituteDetails } from "@/constants/urls";
import { convertSessionTimeToUserTimezone } from "@/utils/timezone";

// Import the separated components
import EmailVerificationDialog from "./EmailVerificationDialog";
import RegistrationForm from "./RegistrationForm";
import SessionStatusCard from "./SessionStatusCard";
import SessionInfo from "./SessionInfo";
import { Preferences } from "@capacitor/preferences";
import { getCachedInstituteBranding } from "@/services/domain-routing";
import { useTheme } from "@/providers/theme/theme-provider";

export interface InstituteBrandingInfo {
  instituteName: string | null;
  instituteLogoUrl: string | null;
}

export default function LiveClassRegistrationPage() {
  const [dialog, setDialog] = useState<boolean>(false);
  const [sessionDetails, setSessionDetails] =
    useState<SessionDetailsResponse | null>(null);
  const router = useRouter();
  const { sessionId } = router.state.location.search;
  const { data, isLoading } = useSessionCustomFields(sessionId || "");
  const { data: earliestScheduleId } = useEarliestScheduleId(sessionId || "");
  const navigate = useNavigate();
  const { setPrimaryColor } = useTheme();
  const [coverFileUrl, setCoverFileUrl] = useState<string | undefined>(
    undefined
  );
  const [instituteBranding, setInstituteBranding] =
    useState<InstituteBrandingInfo>({ instituteName: null, instituteLogoUrl: null });
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

  // Fetch institute branding: first try cached domain routing, then fallback to public API using session's instituteId
  const fetchInstituteBranding = useCallback(async () => {
    try {
      // Try cached branding first (from domain routing)
      const cached = getCachedInstituteBranding();
      if (cached?.instituteName || cached?.instituteLogoFileId) {
        let logoUrl: string | null = null;
        if (cached.instituteLogoFileId) {
          try {
            logoUrl = await getPublicFileUrl(cached.instituteLogoFileId);
          } catch {
            // ignore logo fetch failure
          }
        }
        // Apply theme from cached branding
        if (cached.instituteThemeCode) {
          setPrimaryColor(cached.instituteThemeCode);
        }
        setInstituteBranding({
          instituteName: cached.instituteName,
          instituteLogoUrl: logoUrl,
        });
        return;
      }

      // Fallback: fetch institute details using the session's instituteId
      if (!data?.instituteId) return;
      const response = await axios.get(
        `${urlInstituteDetails}/${data.instituteId}`,
        { params: { instituteId: data.instituteId } }
      );
      const details = response.data;
      let logoUrl: string | null = null;
      if (details?.institute_logo_file_id) {
        try {
          logoUrl = await getPublicFileUrl(details.institute_logo_file_id);
        } catch {
          // ignore logo fetch failure
        }
      }
      // Apply the institute theme
      if (details?.institute_theme_code) {
        setPrimaryColor(details.institute_theme_code);
      }
      setInstituteBranding({
        instituteName: details?.institute_name || null,
        instituteLogoUrl: logoUrl,
      });
    } catch (error) {
      console.error("Failed to fetch institute branding:", error);
    }
  }, [data?.instituteId, setPrimaryColor]);

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
      fetchInstituteBranding();
    }
  }, [data, fetchCoverFileUrl, fetchInstituteBranding, router]);

  const onSubmit = async (formValues: RegistrationFormValues) => {
    let payload;
    let userPayload;
    // Extract email robustly: try form value, then look in custom fields
    let email = formValues.email ? String(formValues.email) : "";
    if (!email || email === "undefined") {
      const emailField = (data?.customFields || []).find(
        (f) =>
          f.fieldKey === "email" ||
          f.fieldKey === "email_address" ||
          f.fieldName.toLowerCase() === "email"
      );
      if (emailField) {
        const val = formValues[emailField.fieldKey];
        if (val) email = String(val);
      }
    }
    // Final fallback: use the verified email
    if (!email || email === "undefined") {
      email = verifiedEmail || "";
    }
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
      <div className="w-screen min-h-screen bg-gradient-to-b from-primary-50/80 via-white to-primary-50/40 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary-100/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none" />

        <div className="relative z-10 w-full min-h-screen p-4 sm:p-8 lg:p-12 flex flex-col lg:flex-row gap-8 lg:gap-14 justify-center items-center max-w-7xl mx-auto">
          <SessionInfo
            sessionTitle={data?.sessionTitle}
            startTime={data?.startTime}
            lastEntryTime={data?.lastEntryTime}
            subject={data?.subject}
            coverFileUrl={coverFileUrl}
            sessionDetails={sessionDetails}
            instituteName={instituteBranding.instituteName}
            instituteLogoUrl={instituteBranding.instituteLogoUrl}
          />

          <div className="w-full max-w-[420px] lg:w-[420px] flex-shrink-0">
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

      <EmailVerificationDialog
        open={dialog}
        sessionId={data?.sessionId || ""}
        instituteId={data?.instituteId || ""}
        onEmailVerified={handleEmailVerified}
      />
    </>
  );
}
