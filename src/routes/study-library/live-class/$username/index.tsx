import { useState, useEffect } from "react";
import { AuthPageBranding } from "@/components/common/institute-branding";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getTokenFromStorage } from "@/lib/auth/axiosInstance";
import { TokenKey } from "@/constants/auth/tokens";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import { Preferences } from "@capacitor/preferences";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { SessionLoginForm } from "./components/SessionLoginForm";

export const Route = createFileRoute("/study-library/live-class/$username/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { username } = Route.useParams();
  const navigate = useNavigate();
  const domainRouting = useDomainRouting();

  const [authState, setAuthState] = useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading");

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
          console.log("user is authenticated");
          setAuthState("authenticated");
        } else {
          // User is not authenticated, show login form
          console.log("user is not authenticated");
          console.log("Domain routing state:", domainRouting);
          setAuthState("unauthenticated");
        }
      } catch (error) {
        console.error("Error checking authentication:", error);
        setAuthState("unauthenticated");
      }
    };

    // Only check auth after domain routing is resolved
    if (!domainRouting.isLoading) {
      checkAuth();
    }
  }, [domainRouting.isLoading]);

  // Redirect authenticated users to live-class
  useEffect(() => {
    if (authState === "authenticated") {
      navigate({ to: "/study-library/live-class" });
    }
  }, [authState, navigate]);

  const handleLoginSuccess = () => {
    // After successful login, redirect to live-class
    navigate({ to: "/study-library/live-class" });
  };

  // Show loading while checking auth or domain routing
  if (domainRouting.isLoading || authState === "loading") {
    return <DashboardLoader />;
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
