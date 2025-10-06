import React, { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { LeadCollectionModal } from "./LeadCollectionModal";
import { JsonRenderer } from "./JsonRenderer";
import { CourseCatalogueService } from "../-services/course-catalogue-service";
import { CourseCatalogueData } from "../-types/course-catalogue-types";
import { useDomainRouting } from "@/hooks/use-domain-routing";

interface CourseCataloguePageProps {
  tagName: string;
  instituteId: string;
  instituteThemeCode?: string | null;
}

export const CourseCataloguePage: React.FC<CourseCataloguePageProps> = ({
  tagName,
  instituteId,
  instituteThemeCode,
}) => {
  const navigate = useNavigate();
  const domainRouting = useDomainRouting();
  const [catalogueData, setCatalogueData] = useState<CourseCatalogueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLeadCollection, setShowLeadCollection] = useState(false);

  // Fetch course catalogue data
  useEffect(() => {
    const fetchCatalogueData = async () => {
      try {
        setIsLoading(true);
        const data = await CourseCatalogueService.getCourseCatalogueByTag(instituteId, tagName);
        
        setCatalogueData(data);
        
        // Check if lead collection should be shown
        if (data.globalSettings.leadCollection.enabled) {
          setShowLeadCollection(true);
        }
      } catch (err) {
        setError("Failed to load course catalogue");
      } finally {
        setIsLoading(false);
      }
    };

    if (instituteId && tagName) {
      fetchCatalogueData();
    } else {
      console.warn("[CourseCataloguePage] Missing required data:", {
        instituteId,
        tagName,
      });
    }
  }, [instituteId, tagName]);

  // Apply institute theme
  useEffect(() => {
    if (instituteThemeCode) {
      document.documentElement.setAttribute('data-theme', instituteThemeCode);
    }
  }, [instituteThemeCode]);

  // Handle lead collection modal
  const handleLeadCollectionClose = () => {
    if (catalogueData?.globalSettings.leadCollection.mandatory) {
      // If mandatory, don't allow closing
      return;
    }
    setShowLeadCollection(false);
  };

  const handleLeadCollectionSubmit = () => {
    setShowLeadCollection(false);
  };

  if (isLoading) {
    return <DashboardLoader />;
  }

  if (error || !catalogueData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            {error || "Course catalogue not found"}
          </h2>
          <p className="text-gray-600 mb-4">
            The requested course catalogue could not be loaded.
          </p>
          <button
            onClick={() => navigate({ to: "/courses" })}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            Go to Courses
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white w-full">
      {/* Render header and footer from JSON, plus course catalog */}
      {catalogueData && (
        <>
          {/* Header from JSON globalSettings */}
          {(catalogueData.globalSettings as any).layout?.header && (catalogueData.globalSettings as any).layout?.header?.enabled !== false && (
            <JsonRenderer
              page={{
                id: "header",
                route: "header",
                title: "Header",
                components: [(catalogueData.globalSettings as any).layout.header]
              }}
              globalSettings={catalogueData.globalSettings}
              instituteId={instituteId}
              tagName={tagName}
            />
          )}


          {/* Header Section with Theme Colors - Only show if title exists in JSON */}
          {catalogueData?.pages?.[0]?.title && (
            <div 
              className="w-full py-8 text-center text-white"
              style={{
                backgroundColor: domainRouting.instituteThemeCode ? 
                  `hsl(var(--primary))` : 
                  '#3b82f6' // fallback blue
              }}
            >
              <div className="w-full px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                  {catalogueData.pages[0].title}
                </h1>
              </div>
            </div>
          )}
          
          {/* Render only homepage components from JSON */}
          {catalogueData.pages
            .filter(page => page.id === "home" || page.route === "homepage")
            .map((page) => (
              <JsonRenderer
                key={page.id}
                page={page}
                globalSettings={catalogueData.globalSettings}
                instituteId={instituteId}
                tagName={tagName}
              />
            ))}
          
          {/* Footer from JSON globalSettings */}
          {(catalogueData.globalSettings as any).layout?.footer && (catalogueData.globalSettings as any).layout?.footer?.enabled !== false && (
            <JsonRenderer
              page={{
                id: "footer",
                route: "footer",
                title: "Footer",
                components: [(catalogueData.globalSettings as any).layout.footer]
              }}
              globalSettings={catalogueData.globalSettings}
              instituteId={instituteId}
              tagName={tagName}
            />
          )}
        </>
      )}

      {/* Lead Collection Modal */}
      {showLeadCollection && (
        <LeadCollectionModal
          isOpen={showLeadCollection}
          onClose={handleLeadCollectionClose}
          onSubmit={handleLeadCollectionSubmit}
          settings={catalogueData.globalSettings.leadCollection}
          instituteId={instituteId}
          mandatory={catalogueData.globalSettings.leadCollection.mandatory}
        />
      )}
    </div>
  );
};
