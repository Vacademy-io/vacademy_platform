import { createFileRoute } from "@tanstack/react-router";
import CourseCatalougePage from "./-component/CourseCatalougePage";
import { useSuspenseQuery } from "@tanstack/react-query";
import { handleGetInstituteIdBySubdomain } from "./-services/courses-services";
import { useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import RootNotFoundComponent from "@/components/core/default-not-found";

export const Route = createFileRoute("/courses/")({
    component: CoursesContainerComponent,
    validateSearch: (search) => {
        return {
            instituteId: search.instituteId as string,
        };
    },
});

function getSubdomain(hostname: string) {
    // e.g. learner.vacademy.io => learner
    const parts = hostname.split(".");
    if (parts.length >= 3) {
        return parts[0];
    }
    return null;
}

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

    if (shouldFetchInstituteId && apiResult === "Data not found") {
        return <RootNotFoundComponent />;
    }

    return (
        <div className="min-h-screen bg-white">
            <CourseCatalougePage />
        </div>
    );
}
