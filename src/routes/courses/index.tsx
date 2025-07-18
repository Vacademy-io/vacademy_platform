import { createFileRoute } from "@tanstack/react-router";
import CourseCatalougePage from "./-component/CourseCatalougePage";
import { useSuspenseQuery } from "@tanstack/react-query";
import { handleGetInstituteIdBySubdomain } from "./-services/courses-services";
import { useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import RootErrorComponent from "@/components/core/deafult-error";

export const Route = createFileRoute("/courses/")({
    component: CoursesContainerComponent,
    validateSearch: (search) => {
        return {
            instituteId:
                (search.instituteId as string) ??
                "dd9b9687-56ee-467a-9fc4-8c5835eae7f9",
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
    const { data: apiResult, isLoading, error } = useSuspenseQuery(
        handleGetInstituteIdBySubdomain({
            subdomain: subdomain || "",
        })
    );
    useEffect(() => {
        if (
            !isLoading &&
            apiResult &&
            apiResult.id &&
            search.instituteId !== apiResult.id
        ) {
            navigate({
                to: "/courses",
                search: { ...search, instituteId: apiResult.id },
                replace: true,
            });
        }
    }, [apiResult, isLoading, search, navigate]);
    if (error) {
        return <RootErrorComponent />;
    }
    return (
        <div className="min-h-screen bg-white">
            <CourseCatalougePage />
        </div>
    );
}
