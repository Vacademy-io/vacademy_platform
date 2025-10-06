import { createFileRoute } from "@tanstack/react-router";
import { CourseCataloguePage } from "./-components/CourseCataloguePage";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import RootNotFoundComponent from "@/components/core/default-not-found";
import { useEffect } from "react";

export const Route = createFileRoute("/$tagName/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { tagName } = Route.useParams() as { tagName: string };
  const domainRouting = useDomainRouting();

  // Debug logging to track domain routing
  useEffect(() => {
    console.log("[Course Catalogue] Domain routing state:", {
      isLoading: domainRouting.isLoading,
      instituteId: domainRouting.instituteId,
      instituteName: domainRouting.instituteName,
      instituteThemeCode: domainRouting.instituteThemeCode,
      error: domainRouting.error,
    });
  }, [domainRouting]);

  // Show loading while domain routing is resolving
  if (domainRouting.isLoading) {
    console.log("[Course Catalogue] Domain routing in progress...");
    return <DashboardLoader />;
  }

  // If there's an error in domain routing, show error
  if (domainRouting.error) {
    console.error("[Course Catalogue] Domain routing error:", domainRouting.error);
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

  // If no institute ID found after domain routing completes, show not found
  if (!domainRouting.instituteId) {
    console.warn("[Course Catalogue] No institute ID found after domain routing");
    return <RootNotFoundComponent />;
  }

  console.log("[Course Catalogue] Rendering course catalogue for:", {
    tagName,
    instituteId: domainRouting.instituteId,
    instituteThemeCode: domainRouting.instituteThemeCode,
  });

  return (
    <CourseCataloguePage
      tagName={tagName}
      instituteId={domainRouting.instituteId}
      instituteThemeCode={domainRouting.instituteThemeCode}
    />
  );
}
