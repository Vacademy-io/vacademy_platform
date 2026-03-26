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
    price: (search.price as string) || undefined,
    available_slots: search.available_slots !== undefined ? Number(search.available_slots) : undefined,
  }),
});

function RouteComponent() {
  const { courseId, tagName } = Route.useParams() as { courseId: string; tagName: string };
  const { enrollInviteId, packageSessionId, bannerImage, level, price, available_slots } = Route.useSearch();
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

  // Get route params from TanStack Router
  // Sometimes during SPA navigation, params might be undefined momentarily
  // In that case, fall back to parsing the URL directly
  let resolvedCourseId = courseId;
  let resolvedTagName = tagName;
  
  if (!resolvedCourseId || !resolvedTagName) {
    // Fallback: Parse params from URL directly
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
      resolvedTagName = pathParts[0] || tagName;
      resolvedCourseId = pathParts[1] || courseId;
    }
  }

  // If still no params after URL fallback, show loading (shouldn't happen in normal flow)
  if (!resolvedCourseId || !resolvedTagName) {
    console.log("[Course Details] Waiting for route params...", { courseId, tagName, resolvedCourseId, resolvedTagName });
    return <DashboardLoader />;
  }

  // Check if courseId looks like a course ID (numeric or UUID)
  const isNumeric = /^\d+$/.test(resolvedCourseId);
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedCourseId);
  const isCourseId = isNumeric || isUUID;

  // If this looks like a page name (not a course ID), render the subpage component
  // Only render after domain routing has resolved to ensure instituteId is available
  if (!isCourseId) {
    // Wait for domain routing before rendering subpage
    if (domainRouting.isLoading) {
      return <DashboardLoader />;
    }
    // If no institute ID after loading, pass empty string (subpage will handle it)
    return <CourseSubPage tagName={resolvedTagName} page={resolvedCourseId} instituteId={domainRouting.instituteId || ''} instituteThemeCode={domainRouting.instituteThemeCode} />;
  }

  // Show loading while domain routing is resolving
  if (domainRouting.isLoading) {
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
      courseId={resolvedCourseId}
      tagName={resolvedTagName}
      instituteId={domainRouting.instituteId}
      instituteThemeCode={domainRouting.instituteThemeCode}
      enrollInviteId={enrollInviteId}
      packageSessionId={packageSessionId}
      bannerImage={bannerImage}
      level={level}
      price={price}
      available_slots={available_slots}
    />
  );
}
