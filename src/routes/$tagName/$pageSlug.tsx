/**
 * Handles custom catalogue pages, e.g. /vacademy/about-us, /vacademy/contact.
 * The page route slug is matched against the catalogue config's pages[].route field.
 */
import { createFileRoute } from "@tanstack/react-router";
import { CourseCataloguePage } from "./-components/CourseCataloguePage";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import RootNotFoundComponent from "@/components/core/default-not-found";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/$tagName/$pageSlug")({
  component: RouteComponent,
});

function RouteComponent() {
  const params = Route.useParams() as { tagName: string; pageSlug: string };
  const domainRouting = useDomainRouting();
  const [hasRetried, setHasRetried] = useState(false);

  const resolvedTagName = params.tagName || "";
  const resolvedPageSlug = params.pageSlug || "";

  useEffect(() => {
    if (!domainRouting.isLoading && !domainRouting.instituteId && !hasRetried) {
      setHasRetried(true);
      domainRouting.resolveRouting();
    }
  }, [domainRouting.isLoading, domainRouting.instituteId, hasRetried, domainRouting]);

  if (!resolvedTagName) return <DashboardLoader />;

  if (domainRouting.isLoading || (!domainRouting.instituteId && !hasRetried)) {
    return <DashboardLoader />;
  }

  if (domainRouting.error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-2xl font-semibold text-gray-900">
            Domain Resolution Error
          </h2>
          <p className="mb-4 text-gray-600">{domainRouting.error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!domainRouting.instituteId) return <RootNotFoundComponent />;

  return (
    <CourseCataloguePage
      tagName={resolvedTagName}
      instituteId={domainRouting.instituteId}
      instituteThemeCode={domainRouting.instituteThemeCode}
      pageSlug={resolvedPageSlug}
    />
  );
}
