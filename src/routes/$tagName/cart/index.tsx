import { createFileRoute } from "@tanstack/react-router";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import RootNotFoundComponent from "@/components/core/default-not-found";
import { useEffect, useState } from "react";
import { CourseCatalogueData } from "../-types/course-catalogue-types";
import { CourseCatalogueService } from "../-services/course-catalogue-service";
import { JsonRenderer } from "../-components/JsonRenderer";

export const Route = createFileRoute("/$tagName/cart/" as any)({
  component: CartPageComponent,
});

function CartPageComponent() {
  const { tagName } = Route.useParams() as { tagName: string };
  const domainRouting = useDomainRouting();
  const [catalogueData, setCatalogueData] = useState<CourseCatalogueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch catalogue data to get cart page configuration
  useEffect(() => {
    const fetchCatalogueData = async () => {
      if (!domainRouting.instituteId) return;

      try {
        setIsLoading(true);
        const data = await CourseCatalogueService.getCourseCatalogueByTag(
          domainRouting.instituteId,
          tagName
        );
        setCatalogueData(data);
      } catch (error) {
        console.error("[CartPage] Error fetching catalogue data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (domainRouting.instituteId && !domainRouting.isLoading) {
      fetchCatalogueData();
    }
  }, [domainRouting.instituteId, domainRouting.isLoading, tagName]);

  // Debug logging
  useEffect(() => {
    console.log("[Cart Page] Domain routing state:", {
      isLoading: domainRouting.isLoading,
      instituteId: domainRouting.instituteId,
      instituteThemeCode: domainRouting.instituteThemeCode,
    });
  }, [domainRouting]);

  // Show loading while domain routing is resolving
  if (domainRouting.isLoading || isLoading) {
    return <DashboardLoader />;
  }

  // If there's an error in domain routing, show error
  if (domainRouting.error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Domain Resolution Error
          </h2>
          <p className="text-gray-600 mb-4">{domainRouting.error}</p>
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

  // If no institute ID found, show not found
  if (!domainRouting.instituteId) {
    return <RootNotFoundComponent />;
  }

  // Find cart page from catalogue data
  const cartPage = catalogueData?.pages?.find(
    (page) => page.id === "cart" || page.route === "cart"
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header from JSON globalSettings */}
      {catalogueData?.globalSettings?.layout?.header &&
        catalogueData.globalSettings.layout.header.enabled !== false && (
          <JsonRenderer
            page={{
              id: "header",
              route: "header",
              title: "Header",
              components: [catalogueData.globalSettings.layout.header],
            }}
            globalSettings={catalogueData.globalSettings}
            instituteId={domainRouting.instituteId}
            tagName={tagName}
            catalogueData={catalogueData}
          />
        )}

      {/* Cart Page Content */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {cartPage ? (
          <>
            {cartPage.title && (
              <h1 className="text-3xl font-bold text-gray-900 mb-8">
                {cartPage.title}
              </h1>
            )}
            <JsonRenderer
              page={cartPage}
              globalSettings={catalogueData!.globalSettings}
              instituteId={domainRouting.instituteId}
              tagName={tagName}
              catalogueData={catalogueData!}
            />
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-600">
              Cart page configuration not found. Please configure the cart page in your catalogue JSON.
            </p>
          </div>
        )}
      </div>

      {/* Footer from JSON globalSettings */}
      {catalogueData?.globalSettings?.layout?.footer &&
        catalogueData.globalSettings.layout.footer.enabled !== false && (
          <JsonRenderer
            page={{
              id: "footer",
              route: "footer",
              title: "Footer",
              components: [catalogueData.globalSettings.layout.footer],
            }}
            globalSettings={catalogueData.globalSettings}
            instituteId={domainRouting.instituteId}
            tagName={tagName}
            catalogueData={catalogueData}
          />
        )}
    </div>
  );
}

