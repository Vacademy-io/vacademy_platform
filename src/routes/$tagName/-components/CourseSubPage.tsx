import React, { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { LeadCollectionModal } from "./LeadCollectionModal";
import { IntroPageComponent } from "./IntroPageComponent";
import { JsonRenderer } from "./JsonRenderer";
import { CourseCatalogueService } from "../-services/course-catalogue-service";
import { CourseCatalogueData } from "../-types/course-catalogue-types";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { getTokenFromStorage } from "@/lib/auth/sessionUtility";
import { Preferences } from "@capacitor/preferences";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";

interface CourseSubPageProps {
  tagName: string;
  page: string;
  instituteId: string;
  instituteThemeCode?: string | null;
}

export const CourseSubPage: React.FC<CourseSubPageProps> = ({
  tagName,
  page,
  instituteId,
  instituteThemeCode,
}) => {

  const navigate = useNavigate();
  const domainRouting = useDomainRouting();
  const [catalogueData, setCatalogueData] = useState<CourseCatalogueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLeadCollection, setShowLeadCollection] = useState(false);
  const [showIntroPage, setShowIntroPage] = useState(false);
  const [introCompleted, setIntroCompleted] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check if user is authenticated and redirect to login if they are
  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        const token = await getTokenFromStorage("accessToken");
        const studentDetails = await Preferences.get({ key: "StudentDetails" });
        const instituteDetails = await Preferences.get({ key: "InstituteDetails" });

        const hasToken = !isNullOrEmptyOrUndefined(token);
        const hasStudentDetails = !isNullOrEmptyOrUndefined(studentDetails);
        const hasInstituteDetails = !isNullOrEmptyOrUndefined(instituteDetails);

        // If user is authenticated, redirect to login page
        if (hasToken && hasStudentDetails && hasInstituteDetails) {
          navigate({ to: "/login" });
          return;
        }
      } catch (error) {
        console.error("[CourseSubPage] Error checking authentication:", error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuthentication();
  }, [navigate]);

  // Fetch course catalogue data
  useEffect(() => {
    const fetchCatalogueData = async () => {
      try {
        setIsLoading(true);
        const data = await CourseCatalogueService.getCourseCatalogueByTag(instituteId, tagName);

        setCatalogueData(data);

        // Check if intro page should be shown based on localStorage
        const introPageSeenKey = `introPageSeen_${instituteId}_${tagName}`;
        const hasSeenIntroPage = localStorage.getItem(introPageSeenKey) === 'true';

        // Check if lead collection form has already been submitted
        const leadCollectionSubmittedKey = `leadCollectionSubmitted_${instituteId}_${tagName}`;
        const hasSubmittedLeadCollection = localStorage.getItem(leadCollectionSubmittedKey) === 'true';

        if (data.introPage?.enabled && !hasSeenIntroPage) {
          setShowIntroPage(true);
        } else if (data.introPage?.enabled && hasSeenIntroPage) {
          // Mark intro as completed since user has already seen it
          setIntroCompleted(true);
        } else if (data.globalSettings.leadCollection.enabled && !hasSubmittedLeadCollection) {
          // Only show lead collection if no intro page or intro already seen, and form hasn't been submitted
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
      console.warn("[CourseSubPage] Missing required data:", {
        instituteId,
        tagName,
      });
    }
  }, [instituteId, tagName]);

  // Apply font from JSON if fonts.enabled is true
  useEffect(() => {
    const fonts = catalogueData?.globalSettings?.fonts;

    if (!fonts?.enabled || !fonts?.family) {
      document.body.style.fontFamily =
        "'Figtree', system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      return;
    }

    const fontFamily = fonts.family.trim();
    const primaryFont = fontFamily.split(",")[0].replace(/['"]/g, "").trim();

    // Create Google Fonts link 
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      primaryFont
    )}:wght@300;400;500;600;700&display=swap`;

    // Append link only once
    if (!document.querySelector(`link[href="${link.href}"]`)) {
      document.head.appendChild(link);
    }

    // Apply font exactly as specified in JSON
    document.body.style.fontFamily = fontFamily;
    document.documentElement.style.setProperty("--app-font-family", fontFamily);
    
    console.log("[CourseSubPage] Applied font:", fontFamily, "Primary font:", primaryFont);
  }, [catalogueData]);


  // Apply institute theme
  useEffect(() => {
    if (instituteThemeCode) {
      document.documentElement.setAttribute('data-theme', instituteThemeCode);
    }
  }, [instituteThemeCode]);

  // Listen for custom event to open lead collection
  useEffect(() => {
    const handleOpenLeadCollection = () => {
      // Only show lead collection if it's enabled in JSON
      if (catalogueData?.globalSettings.leadCollection.enabled) {
        setShowLeadCollection(true);
      } else {
        console.log("[CourseSubPage] Lead collection is disabled, ignoring openLeadCollection event");
      }
    };

    window.addEventListener('openLeadCollection', handleOpenLeadCollection);

    return () => {
      window.removeEventListener('openLeadCollection', handleOpenLeadCollection);
    };
  }, [catalogueData]);

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

  // Intro page handlers
  const handleIntroGetStarted = () => {
    // This will be handled internally by IntroPageComponent
    // No need to show separate lead collection modal
  };

  const handleIntroLogin = () => {
    // Navigate to login page
    navigate({ to: '/login' });
  };

  const handleIntroComplete = () => {
    setIntroCompleted(true);
    setShowIntroPage(false);

    // Mark intro page as seen in localStorage
    const introPageSeenKey = `introPageSeen_${instituteId}_${tagName}`;
    localStorage.setItem(introPageSeenKey, 'true');

    // Show lead collection if enabled and not already shown and not already submitted
    const leadCollectionSubmittedKey = `leadCollectionSubmitted_${instituteId}_${tagName}`;
    const hasSubmittedLeadCollection = localStorage.getItem(leadCollectionSubmittedKey) === 'true';
    
    if (catalogueData?.globalSettings.leadCollection.enabled && !showLeadCollection && !hasSubmittedLeadCollection) {
      setShowLeadCollection(true);
    }
  };

  const handleIntroClose = () => {
    setShowIntroPage(false);
    setIntroCompleted(true);

    // Mark intro page as seen in localStorage even when closed
    const introPageSeenKey = `introPageSeen_${instituteId}_${tagName}`;
    localStorage.setItem(introPageSeenKey, 'true');
  };

  if (isLoading || isCheckingAuth) {
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

  // Find the page configuration that matches the current route
  const currentPage = catalogueData.pages.find(p =>
    p.route === page ||
    p.id === page ||
    p.route === `/${page}` ||
    p.id === `/${page}`
  );

  // If no matching page found, show not found
  if (!currentPage) {
    console.warn("[CourseSubPage] No page found for route:", page);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Page Not Found
          </h2>
          <p className="text-gray-600 mb-4">
            The requested page "{page}" could not be found.
          </p>
          <button
            onClick={() => navigate({ to: `/${tagName}` })}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            Go Back to Catalogue
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-white w-full pb-20 md:pb-0 pt-20">
      {/* Intro Page - Show first if enabled and not completed */}
      {showIntroPage && catalogueData?.introPage && (
        <IntroPageComponent
          introPage={catalogueData.introPage}
          onGetStarted={handleIntroGetStarted}
          onLogin={handleIntroLogin}
          onComplete={handleIntroComplete}
          onClose={handleIntroClose}
          leadCollectionSettings={catalogueData.globalSettings.leadCollection}
          instituteId={instituteId}
        />
      )}

      {/* Main Content - Only show after intro is completed or if no intro page */}
      {(!showIntroPage || introCompleted) && catalogueData && (
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
              catalogueData={catalogueData}
            />
          )}

          {/* Header Section with Theme Colors - Only show if title exists in JSON */}
          {currentPage?.title && (
            <div
              className="w-full py-0 text-center text-white"
              style={{
                backgroundColor: domainRouting.instituteThemeCode ?
                  `hsl(var(--primary))` :
                  '#3b82f6' // fallback blue
              }}
            >
              <div className="w-full px-4 sm:px-6 lg:px-8">
                <h1 className="text-xl sm:text-4xl lg:text-5xl font-bold mb-0">
                  {currentPage.title} {currentPage.title == "Your Cart" ? "🛒" : ""}
                </h1>
              </div>
            </div>
          )}

          {/* Render the current page components from JSON */}
          <JsonRenderer
            key={currentPage.id}
            page={currentPage}
            globalSettings={catalogueData.globalSettings}
            instituteId={instituteId}
            tagName={tagName}
            catalogueData={catalogueData}
          />

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
              catalogueData={catalogueData}
            />
          )}
        </>
      )}

      {/* Lead Collection Modal - Show when requested and intro is completed or not active */}
      {showLeadCollection && catalogueData && catalogueData.globalSettings.leadCollection.enabled && (!showIntroPage || introCompleted) && (
        <LeadCollectionModal
          isOpen={showLeadCollection}
          onClose={handleLeadCollectionClose}
          onSubmit={handleLeadCollectionSubmit}
          settings={{
            enabled: catalogueData.globalSettings.leadCollection.enabled,
            mandatory: catalogueData.globalSettings.leadCollection.mandatory,
            inviteLink: catalogueData.globalSettings.leadCollection.inviteLink,
            formStyle: catalogueData.globalSettings.leadCollection.formStyle,
            fields: catalogueData.globalSettings.leadCollection.fields || []
          }}
          instituteId={instituteId}
          mandatory={catalogueData.globalSettings.leadCollection.mandatory}
        />
      )}


      {/* Mobile Action Buttons - Fixed at bottom for catalogue page */}
      {(!showIntroPage || introCompleted) && catalogueData && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 p-4">
          <div className="flex flex-col gap-3">
            {/* Get Started Button */}
            {!(catalogueData?.globalSettings?.courseCatalogeType?.enabled ?? false) && <button
              onClick={() => {
                if (catalogueData?.globalSettings.leadCollection.enabled) {
                  setShowLeadCollection(true);
                } else {
                  console.log("[CourseSubPage] Lead collection is disabled, not showing modal");
                }
              }}
              className="w-full px-4 py-2 text-white font-medium hover:opacity-90 rounded-md transition-colors"
              style={{
                backgroundColor: domainRouting.instituteThemeCode ? `hsl(var(--primary))` : '#3b82f6'
              }}
            >
              Get Started
            </button>}

            {/* Login Text */}
            <div className="text-center">
              <span
                onClick={handleIntroLogin}
                className="cursor-pointer text-sm transition-colors"
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                <span className="text-black">Already have an account?</span>
                <span
                  className="underline"
                  style={{
                    color: domainRouting.instituteThemeCode ? `hsl(var(--primary))` : '#3b82f6'
                  }}
                >
                  Login
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
