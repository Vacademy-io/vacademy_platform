import { createFileRoute } from "@tanstack/react-router";
import CourseCatalougePage from "./-component/CourseCatalougePage";
import { useSuspenseQuery } from "@tanstack/react-query";
import { handleGetInstituteIdBySubdomain } from "./-services/courses-services";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import RootNotFoundComponent from "@/components/core/default-not-found";
import { Preferences } from "@capacitor/preferences";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import { getTokenFromStorage } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { getSubdomain } from "@/helpers/helper";

export const Route = createFileRoute("/courses/")({
    component: CoursesContainerComponent,
    validateSearch: () => {
        return {};
    },
});

function CoursesContainerComponent() {
    const navigate = useNavigate();
    const subdomain = getSubdomain(window.location.hostname);

    // Always call the hook to get instituteId from API
    const { data: apiResult, isLoading } = useSuspenseQuery(
        handleGetInstituteIdBySubdomain({
            subdomain: subdomain || "",
        })
    );

    useEffect(() => {
        const redirectToDashboardIfAuthenticated = async () => {
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

    if (isLoading) return <DashboardLoader />;

    if (apiResult === "Data not found") {
        return <RootNotFoundComponent />;
    }

    return (
        <div className="min-h-screen bg-white">
            <CourseCatalougePage instituteId={apiResult} />
        </div>
    );
}
