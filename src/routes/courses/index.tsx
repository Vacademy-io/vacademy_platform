import { createFileRoute } from "@tanstack/react-router";
import CourseCatalougePage from "./-component/CourseCatalougePage";
// Removed legacy institute resolution in favor of domain routing
// import { useSuspenseQuery } from "@tanstack/react-query";
// import { handleGetInstituteIdWithLocalStorageCheck } from "./-services/courses-services";
import { useEffect, useState } from "react";
import RootNotFoundComponent from "@/components/core/default-not-found";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { useDomainRouting } from "@/hooks/use-domain-routing";

export const Route = createFileRoute("/courses/")({
    component: CoursesContainerComponent,
    validateSearch: () => {
        return {};
    },
});

function CoursesContainerComponent() {
    const domainRouting = useDomainRouting();


    const [hasRetried, setHasRetried] = useState(false);


    // Handle retry logic if domain routing fails initially
    useEffect(() => {
        if (!domainRouting.isLoading && !domainRouting.instituteId && !hasRetried) {
            console.log("[Courses Index] Domain routing failed, attempting retry...");
            setHasRetried(true);
            domainRouting.resolveRouting();
        }
    }, [domainRouting.isLoading, domainRouting.instituteId, hasRetried, domainRouting]);

    if (domainRouting.isLoading || (!domainRouting.instituteId && !hasRetried)) return <DashboardLoader />;

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
