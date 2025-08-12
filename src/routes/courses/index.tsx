import { createFileRoute } from "@tanstack/react-router";
import CourseCatalougePage from "./-component/CourseCatalougePage";
import { useSuspenseQuery } from "@tanstack/react-query";
import { handleGetInstituteIdBySubdomain } from "./-services/courses-services";
import { useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import RootNotFoundComponent from "@/components/core/default-not-found";
import { Preferences } from "@capacitor/preferences";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import { getTokenFromStorage } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { getSubdomain } from "@/helpers/helper";

export const Route = createFileRoute("/courses/")({
    component: CoursesContainerComponent,
    validateSearch: (search) => {
        return {
            instituteId: search.instituteId as string,
        };
    },
});

function CoursesContainerComponent() {
    const navigate = useNavigate();
    const search = useSearch({ from: "/courses/" });
    const subdomain = getSubdomain(window.location.hostname);

    // Always call the hook, but only use result if needed
    const { data: apiResult, isLoading } = useSuspenseQuery(
        handleGetInstituteIdBySubdomain({
            subdomain: !search.instituteId ? subdomain || "" : "__skip__",
        })
    );
    const shouldFetchInstituteId = !search.instituteId;

    useEffect(() => {
        if (
            shouldFetchInstituteId &&
            !isLoading &&
            apiResult &&
            apiResult !== "Data not found"
        ) {
            navigate({
                to: "/courses",
                search: { ...search, instituteId: apiResult },
                replace: true,
            });
        }
    }, [apiResult, isLoading, search, navigate, shouldFetchInstituteId]);

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

    if (shouldFetchInstituteId && apiResult === "Data not found") {
        return <RootNotFoundComponent />;
    }

    return (
        <div className="min-h-screen bg-white">
            <CourseCatalougePage />
        </div>
    );
}
