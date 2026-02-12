import { useState, useEffect, useCallback } from "react";
import { AuthPageBranding } from "@/components/common/institute-branding";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getTokenFromStorage } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import { Preferences } from "@capacitor/preferences";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { SessionLoginForm } from "./components/SessionLoginForm";
import { SessionSelectionDialog } from "./components/SessionSelectionDialog";
import { useLiveSessions } from "../-hooks/useLiveSessions";
import { getAllPackageSessionIds } from "@/utils/study-library/get-list-from-stores/getPackageSessionId";
import {
  getActiveSessions,
  SessionStatus,
} from "./-helpers/checkSessionStatus";
import { SessionDetails } from "../-types/types";
import { SessionStreamingServiceType } from "@/routes/register/live-class/-types/enum";
import { useMarkAttendance } from "../-hooks/useMarkAttendance";
import { toast } from "sonner";
import * as Sentry from "@sentry/react";

export const Route = createFileRoute("/study-library/live-class/$username/")({
  component: RouteComponent,
});

function RouteComponent() {
  const params = Route.useParams();
  const navigate = useNavigate();
  const domainRouting = useDomainRouting();

  // Sometimes during SPA navigation, params might be undefined momentarily
  // In that case, fall back to parsing the URL directly
  let username = params.username || '';

  if (!username) {
    // Fallback: Parse params from URL directly
    // URL structure: /study-library/live-class/$username
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 3 && pathParts[0] === 'study-library' && pathParts[1] === 'live-class') {
      username = pathParts[2] || '';
    }
  }

  const [authState, setAuthState] = useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading");
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [showSessionSelection, setShowSessionSelection] = useState(false);
  const [activeSessions, setActiveSessions] = useState<
    Array<{ session: SessionDetails; status: SessionStatus }>
  >([]);

  // Fetch live sessions data (only when batchIds are available)
  const { data: sessions, isLoading: isSessionsLoading } = useLiveSessions(
    batchIds.length > 0 ? batchIds : null
  );

  // Mark attendance mutation
  const { mutateAsync: markAttendance } = useMarkAttendance();

  // Fetch batch IDs
  useEffect(() => {
    const fetchBatchIds = async () => {
      const ids = await getAllPackageSessionIds();
      console.log("Fetched batchIds:", ids);
      setBatchIds(ids);
    };
    if (authState === "authenticated") {
      fetchBatchIds();
    }
  }, [authState]);

  // Handle navigation to a specific session
  const handleNavigateToSession = useCallback(
    async (session: SessionDetails, isInWaitingRoom: boolean) => {
      if (isInWaitingRoom) {
        // Navigate to waiting room (waiting room will handle attendance marking)
        console.log("Navigating to waiting room for:", session.title);
        navigate({
          to: "/study-library/live-class/waiting-room",
          search: { sessionId: session.schedule_id },
        });
      } else {
        // Mark attendance before joining live session
        try {
          console.log("Marking attendance for live session:", session.title);
          await markAttendance({
            sessionId: session.session_id,
            scheduleId: session.schedule_id,
            userSourceType: "USER",
            userSourceId: "",
            details: "Auto-joined live class from username route",
          });

          // Navigate to live session after marking attendance
          if (
            session.session_streaming_service_type ===
            SessionStreamingServiceType.EMBED
          ) {
            navigate({
              to: "/study-library/live-class/embed",
              search: { sessionId: session.schedule_id },
            });
          } else {
            window.open(session.meeting_link, "_blank", "noopener,noreferrer");
            navigate({ to: "/study-library/live-class" });
          }
        } catch (error) {
          console.error("Failed to mark attendance:", error);
          toast.error("Failed to mark attendance");

          // Still proceed with navigation even if attendance marking fails
          if (
            session.session_streaming_service_type ===
            SessionStreamingServiceType.EMBED
          ) {
            navigate({
              to: "/study-library/live-class/embed",
              search: { sessionId: session.schedule_id },
            });
          } else {
            window.open(session.meeting_link, "_blank", "noopener,noreferrer");
            navigate({ to: "/study-library/live-class" });
          }
        }
      }
    },
    [navigate, markAttendance]
  );

  // Check for active sessions and auto-navigate or show selection
  useEffect(() => {
    if (
      authState === "authenticated" &&
      sessions &&
      !isSessionsLoading &&
      batchIds.length > 0
    ) {
      // Combine live and upcoming sessions
      const allSessions = [
        ...(sessions?.live_sessions ?? []),
        ...(sessions?.upcoming_sessions ?? []),
      ];

      // Get sessions that are currently active (in waiting room or live)
      const activeSessionsData = getActiveSessions(allSessions);
      try {
        if (activeSessionsData.length === 0) {
          // No active sessions, redirect to live-class page
          Sentry.logger.info(
            Sentry.logger
              .fmt`No active live sessions found for user: '${username}'. Redirecting to live-class page.`
          );
          navigate({ to: "/study-library/live-class" });
        } else if (activeSessionsData.length === 1) {
          // Exactly one active session, auto-navigate
          const { session, status } = activeSessionsData[0];
          handleNavigateToSession(session, status.isInWaitingRoom);
        } else {
          // Multiple active sessions, show selection dialog
          setActiveSessions(activeSessionsData);
          setShowSessionSelection(true);
        }
      } catch (err) {
        console.error(
          `Error processing active sessions for user: ${username}`,
          err
        );
      }
    }
  }, [
    authState,
    sessions,
    isSessionsLoading,
    batchIds,
    navigate,
    handleNavigateToSession,
  ]);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await getTokenFromStorage(TokenKey.accessToken);
        const studentDetails = await Preferences.get({ key: "StudentDetails" });
        const instituteDetails = await Preferences.get({
          key: "InstituteDetails",
        });

        const hasToken = !isNullOrEmptyOrUndefined(token);
        const hasStudentDetails = !isNullOrEmptyOrUndefined(
          studentDetails.value
        );
        const hasInstituteDetails = !isNullOrEmptyOrUndefined(
          instituteDetails.value
        );

        if (hasToken && hasStudentDetails && hasInstituteDetails) {
          Sentry.logger.info(
            Sentry.logger
              .fmt`User with username: '${username}' is authenticated.`
          );
          setAuthState("authenticated");
        } else {
          Sentry.logger.info(
            Sentry.logger
              .fmt`User with username: ${username} is not authenticated.`
          );
          setAuthState("unauthenticated");
        }
      } catch (error) {
        console.error("Error checking authentication:", error);
        Sentry.logger.error(
          Sentry.logger
            .fmt`User: '${username}' encountered an error during authentication check.`,
          { error }
        );
        setAuthState("unauthenticated");
      }
    };

    // Only check auth after domain routing is resolved
    if (!domainRouting.isLoading) {
      checkAuth();
    }
  }, [domainRouting.isLoading, domainRouting]);

  const handleLoginSuccess = () => {
    // After successful login, set authenticated state
    setAuthState("authenticated");
  };

  const handleSessionSelect = async (session: SessionDetails) => {
    const activeSession = activeSessions.find(
      (s) => s.session.schedule_id === session.schedule_id
    );
    if (activeSession) {
      setShowSessionSelection(false);
      await handleNavigateToSession(
        session,
        activeSession.status.isInWaitingRoom
      );
    }
  };

  // Show loading while checking auth or domain routing or sessions
  if (
    domainRouting.isLoading ||
    authState === "loading" ||
    (authState === "authenticated" && isSessionsLoading)
  ) {
    return <DashboardLoader />;
  }

  // Show session selection dialog if there are multiple active sessions
  if (authState === "authenticated" && showSessionSelection) {
    return (
      <>
        <DashboardLoader />
        <SessionSelectionDialog
          open={showSessionSelection}
          onOpenChange={setShowSessionSelection}
          sessions={activeSessions}
          onSelectSession={handleSessionSelect}
        />
      </>
    );
  }

  // Don't render anything if we're redirecting authenticated users
  if (authState === "authenticated") {
    return <DashboardLoader />;
  }

  // Show login form for unauthenticated users
  return (
    <div className="min-h-screen  flex flex-col bg-gray-50 w-full ">
      {/* Institute Branding */}
      {domainRouting.instituteId && (
        <div className="w-full bg-white shadow-sm">
          <div className="mx-auto px-4 py-4">
            <AuthPageBranding
              branding={{
                instituteId: domainRouting.instituteId,
                instituteName: domainRouting.instituteName,
                instituteLogoFileId: domainRouting.instituteLogoFileId,
                instituteThemeCode: domainRouting.instituteThemeCode,
              }}
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Login Form */}
          {domainRouting.instituteId ? (
            <SessionLoginForm
              username={username}
              instituteId={domainRouting.instituteId}
              onLoginSuccess={handleLoginSuccess}
            />
          ) : (
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-semibold text-gray-900">
                Unable to Load Session
              </h2>
              <p className="text-gray-600">
                Could not determine the institute for this session. Please check
                the URL or contact support.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t">
        <div className="mx-auto px-4 py-4">
          <p className="text-center text-sm text-gray-500">
            Need help? Contact support for assistance with accessing your live
            session.
          </p>
        </div>
      </div>
    </div>
  );
}
