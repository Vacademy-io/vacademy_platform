import { createFileRoute } from "@tanstack/react-router";
import CourseCatalougePage from "./-component/CourseCatalougePage";
import { useSuspenseQuery } from "@tanstack/react-query";
import { handleGetInstituteIdWithLocalStorageCheck } from "./-services/courses-services";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import RootNotFoundComponent from "@/components/core/default-not-found";
import { Preferences } from "@capacitor/preferences";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import { getTokenFromStorage } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { getSubdomain } from "@/helpers/helper";
import { useDomainRouting } from "@/hooks/use-domain-routing";

export const Route = createFileRoute("/courses/")({
    component: CoursesContainerComponent,
    validateSearch: () => {
        return {};
    },
});

function CoursesContainerComponent() {
    const navigate = useNavigate();
    const subdomain = getSubdomain(window.location.hostname);
    const domainRouting = useDomainRouting();

    // Use the new function that checks localStorage first, then compares with API result
    const { data: apiResult, isLoading } = useSuspenseQuery(
        handleGetInstituteIdWithLocalStorageCheck({
            subdomain: subdomain || "",
        })
    );

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

    if (isLoading || domainRouting.isLoading) return <DashboardLoader />;

    // If we couldn't get any instituteId (neither from API nor localStorage), show not found
    if (apiResult === "Data not found" && !domainRouting.instituteId) {
        return <RootNotFoundComponent />;
    }

    return (
        <div className="min-h-screen bg-white">
            <CourseCatalougePage instituteId={domainRouting.instituteId || apiResult} />
        </div>
    );
}
