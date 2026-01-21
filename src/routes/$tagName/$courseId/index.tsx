import { createFileRoute } from "@tanstack/react-router";
import { CourseDetailsPage } from "./-components/CourseDetailsPage";
import { CourseSubPage } from "../-components/CourseSubPage";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import RootNotFoundComponent from "@/components/core/default-not-found";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/$tagName/$courseId/")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    enrollInviteId: (search.enrollInviteId as string) || undefined,
    packageSessionId: (search.packageSessionId as string) || undefined,
    bannerImage: (search.bannerImage as string) || undefined,
    level: (search.level as string) || undefined,
  }),
});

function RouteComponent() {
  const { courseId, tagName } = Route.useParams() as { courseId: string; tagName: string };
  const { enrollInviteId, packageSessionId, bannerImage, level } = Route.useSearch();
  const domainRouting = useDomainRouting();
  const [hasRetried, setHasRetried] = useState(false);

  // Handle retry logic if domain routing fails initially
  useEffect(() => {
    if (!domainRouting.isLoading && !domainRouting.instituteId && !hasRetried) {
      console.log("[Course Details] Domain routing failed, attempting retry...");
      setHasRetried(true);
      domainRouting.resolveRouting();
    }
  }, [domainRouting.isLoading, domainRouting.instituteId, hasRetried, domainRouting]);

  // Check if courseId looks like a course ID (numeric or UUID)
  const isNumeric = /^\d+$/.test(courseId);
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(courseId);
  const isCourseId = isNumeric || isUUID;

  // If this looks like a page name (not a course ID), render the subpage component
  if (!isCourseId) {
    return <CourseSubPage tagName={tagName} page={courseId} instituteId={domainRouting.instituteId || ''} instituteThemeCode={domainRouting.instituteThemeCode} />;
  }

  // Show loading while domain routing is resolving
  // Also show loading if we are in the process of retrying (isLoading might be false momentarily before retry starts)
  if (domainRouting.isLoading || (!domainRouting.instituteId && !hasRetried)) {
    return <DashboardLoader />;
  }

  // If there's an error in domain routing, show error
  if (domainRouting.error) {
    console.error("[Course Details] Domain routing error:", domainRouting.error);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Domain Resolution Error
          </h2>
          <p className="text-gray-600 mb-4">
            {domainRouting.error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // If no institute ID found after domain routing completes (and retry), show not found
  if (!domainRouting.instituteId) {
    console.warn("[Course Details] No institute ID found after domain routing (and retry)");
    return <RootNotFoundComponent />;
  }


  return (
    <CourseDetailsPage
      courseId={courseId}
      tagName={tagName}
      instituteId={domainRouting.instituteId}
      instituteThemeCode={domainRouting.instituteThemeCode}
      enrollInviteId={enrollInviteId}
      packageSessionId={packageSessionId}
      bannerImage={bannerImage}
      level={level}
    />
  );
}
