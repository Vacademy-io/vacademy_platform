/**
 * Handles custom catalogue pages, e.g. /vacademy/about-us, /vacademy/contact.
 * The page route slug is matched against the catalogue config's pages[].route field.
 */
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { RouteMatcher } from "./-services/route-matcher";
import { CatalogueTagContext } from "./-components/CatalogueTagContext";
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
            className="rounded-catalogue-sm bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!domainRouting.instituteId) return <RootNotFoundComponent />;

  // "/new/about" on a host where `new` is mounted at the root → "/about".
  // Not for a page named like an app route ("/new/privacy-policy"): "/privacy-policy"
  // is the app's own page, so the tagged address IS this page's address.
  if (
    RouteMatcher.isRootMounted(resolvedTagName) &&
    !RouteMatcher.isReservedRootPage(resolvedTagName, resolvedPageSlug)
  ) {
    return <Navigate to={`/${resolvedPageSlug}` as never} search={true} replace />;
  }

  return (
    <CatalogueTagContext.Provider value={resolvedTagName}>
      <CourseCataloguePage
        tagName={resolvedTagName}
        instituteId={domainRouting.instituteId}
        instituteThemeCode={domainRouting.instituteThemeCode}
        pageSlug={resolvedPageSlug}
      />
    </CatalogueTagContext.Provider>
  );
}
