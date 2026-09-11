import { createFileRoute, Navigate, redirect } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import RootNotFoundComponent from "@/components/core/default-not-found";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { getCachedRootCatalogueTag } from "@/services/domain-routing";
import { shouldHidePaidPurchaseUI } from "@/utils/ios-iap-compliance";
import { hasActiveLearnerSession } from "@/lib/auth/sessionUtility";
import { CatalogueTagContext } from "./$tagName/-components/CatalogueTagContext";

const CourseCataloguePage = lazy(() =>
  import("./$tagName/-components/CourseCataloguePage").then((m) => ({
    default: m.CourseCataloguePage,
  })),
);

/**
 * The site root.
 *
 * Historically "/" never rendered anything: `__root`'s beforeLoad always
 * redirected it — to the dashboard when signed in, otherwise to the domain's
 * `redirect` (a catalogue at "/<tag>", or /login). That is still what happens
 * for every host EXCEPT one whose routing row names a `root_catalogue_tag`:
 * there `__root` lets "/" through and this route renders that catalogue's home
 * page, so a white-label marketing site answers on the bare domain instead of
 * bouncing visitors to "/new".
 */
export const Route = createFileRoute("/")({
  // Same reader-mode gate as /$tagName: the catalogue is a marketplace surface.
  beforeLoad: async () => {
    if (shouldHidePaidPurchaseUI()) {
      throw redirect({
        to: (await hasActiveLearnerSession()) ? "/dashboard" : "/login",
      });
    }
  },
  component: RootCatalogueRoute,
});

function RootCatalogueRoute() {
  const domainRouting = useDomainRouting();
  const [hasRetried, setHasRetried] = useState(false);

  useEffect(() => {
    if (!domainRouting.isLoading && !domainRouting.instituteId && !hasRetried) {
      setHasRetried(true);
      domainRouting.resolveRouting();
    }
  }, [domainRouting.isLoading, domainRouting.instituteId, hasRetried, domainRouting]);

  if (domainRouting.isLoading || (!domainRouting.instituteId && !hasRetried)) {
    return <DashboardLoader />;
  }

  const rootTag = getCachedRootCatalogueTag();

  // Reached "/" without a root catalogue — __root would normally have
  // redirected, so this is a resolve that failed or a host that lost its
  // flag mid-session. Fall back to what the old code did.
  if (!rootTag) {
    return <Navigate to="/login" replace />;
  }

  if (!domainRouting.instituteId) return <RootNotFoundComponent />;

  return (
    <CatalogueTagContext.Provider value={rootTag}>
      <Suspense fallback={<DashboardLoader />}>
        <CourseCataloguePage
          tagName={rootTag}
          instituteId={domainRouting.instituteId}
          instituteThemeCode={domainRouting.instituteThemeCode}
        />
      </Suspense>
    </CatalogueTagContext.Provider>
  );
}
