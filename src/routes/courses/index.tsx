import { createFileRoute } from "@tanstack/react-router";
import CourseCatalougePage from "./-component/CourseCatalougePage";
// Removed legacy institute resolution in favor of domain routing
// import { useSuspenseQuery } from "@tanstack/react-query";
// import { handleGetInstituteIdWithLocalStorageCheck } from "./-services/courses-services";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import RootNotFoundComponent from "@/components/core/default-not-found";
import { Preferences } from "@capacitor/preferences";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import { getTokenFromStorage } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { useDomainRouting } from "@/hooks/use-domain-routing";

export const Route = createFileRoute("/courses/")({
    component: CoursesContainerComponent,
    validateSearch: () => {
        return {};
    },
});

function CoursesContainerComponent() {
    const navigate = useNavigate();
    const domainRouting = useDomainRouting();


    useEffect(() => {
        const redirectToDashboardIfAuthenticated = async () => {
            const currentPath = window.location.pathname;
            
            // Only redirect if we're on the exact /courses/ route, not on sub-routes like /courses/course-details/
            if (currentPath !== "/courses/" && currentPath !== "/courses") {
                return; // Don't redirect if we're on a sub-route
            }
            
            const token = await getTokenFromStorage(TokenKey.accessToken);
            const studentDetails = await Preferences.get({
                key: "StudentDetails",
            });
            const instituteDetails = await Preferences.get({
                key: "InstituteDetails",
            });

            if (
                !isNullOrEmptyOrUndefined(token) &&
                !isNullOrEmptyOrUndefined(studentDetails) &&
                !isNullOrEmptyOrUndefined(instituteDetails)
            ) {
                navigate({ to: "/study-library/courses" });
            }
        };

        redirectToDashboardIfAuthenticated();
    }, [navigate]);

    if (domainRouting.isLoading) return <DashboardLoader />;

    // If we couldn't resolve any instituteId, show not found
    if (!domainRouting.instituteId) {
        return <RootNotFoundComponent />;
    }

    return (
        <div className="min-h-screen bg-white">
            <CourseCatalougePage instituteId={domainRouting.instituteId} />
        </div>
    );
}
