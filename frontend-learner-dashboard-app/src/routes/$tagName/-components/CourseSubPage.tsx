import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { withArabicFallback } from "@/utils/branding";
import { useNavigate } from "@tanstack/react-router";
import { getTerminology, getTerminologyPlural } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { LeadCollectionModal } from "./LeadCollectionModal";
import { AudienceFormModal } from "./AudienceFormModal";
import { MobileActionBar } from "./MobileActionBar";
import { useCatalogueTracking, captureUtmOnce } from "../-utils/catalogue-tracking";
import { WhatsAppFloatingButton } from "./WhatsAppFloatingButton";
import { IntroPageComponent } from "./IntroPageComponent";
import { JsonRenderer } from "./JsonRenderer";
import { buildPrimaryScaleVars } from "../-utils/style-utils";
import { CourseCatalogueService } from "../-services/course-catalogue-service";
import { CourseCatalogueData } from "../-types/course-catalogue-types";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { getTokenFromStorage } from "@/lib/auth/sessionUtility";
import { Preferences } from "@capacitor/preferences";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import { shouldShowMobileGetStarted } from "../-utils/catalogue-cta";

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
  const { t } = useTranslation("coursePlayerA");
  const course = getTerminology(ContentTerms.Course, SystemTerms.Course);
  const courses = getTerminologyPlural(ContentTerms.Course, SystemTerms.Course);

  const navigate = useNavigate();
  const domainRouting = useDomainRouting();
  const [catalogueData, setCatalogueData] = useState<CourseCatalogueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLeadCollection, setShowLeadCollection] = useState(false);
  const [audienceForm, setAudienceForm] = useState<{ audienceId: string; title?: string } | null>(null);

  // Site-configured GA4 / Meta Pixel / GTM (Global Settings → Tracking) +
  // first-touch UTM capture for lead attribution.
  useCatalogueTracking((catalogueData?.globalSettings as any)?.tracking);
  useEffect(() => { captureUtmOnce(); }, []);
  const [showIntroPage, setShowIntroPage] = useState(false);
  const [introCompleted, setIntroCompleted] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check if user is authenticated - removed previous botched redirect
  useEffect(() => {
    setIsCheckingAuth(false);
  }, []);

  // Fetch course catalogue data
  useEffect(() => {
    const fetchCatalogueData = async () => {
      // Reset error state when starting a new fetch
      setError(null);

      try {
        setIsLoading(true);
        console.log("[CourseSubPage] Fetching catalogue data for:", { instituteId, tagName, page });

        const data = await CourseCatalogueService.getCourseCatalogueByTag(instituteId, tagName);

        console.log("[CourseSubPage] Successfully fetched catalogue data");
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
        console.error("[CourseSubPage] Error fetching catalogue data:", err);
        setError(t("courseSubPage.loadCatalogueFailed", { course }));
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch if we have valid instituteId and tagName
    // This prevents premature API calls before domain routing completes
    if (instituteId && tagName && !isCheckingAuth) {
      console.log("[CourseSubPage] Starting catalogue data fetch");
      fetchCatalogueData();
    } else {
      console.log("[CourseSubPage] Waiting for required data:", {
        hasInstituteId: !!instituteId,
        hasTagName: !!tagName,
        isCheckingAuth,
      });
      // Keep loading state true while waiting for instituteId
      if (!instituteId || !tagName) {
        setIsLoading(true);
      }
    }
  }, [instituteId, tagName, isCheckingAuth]);

  // Apply font from JSON if fonts.enabled is true
  useEffect(() => {
    const fonts = catalogueData?.globalSettings?.fonts;

    if (!fonts?.enabled || !fonts?.family) {
      document.body.style.fontFamily =
        "'Figtree', system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      document.documentElement.style.removeProperty("--catalogue-heading-font");
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

    // Apply font exactly as specified in JSON, plus the Arabic fallback the
    // stack would otherwise drop (withArabicFallback preserves Latin order).
    const resolvedFontFamily = withArabicFallback(fontFamily);
    document.body.style.fontFamily = resolvedFontFamily;
    document.documentElement.style.setProperty("--app-font-family", resolvedFontFamily);

    // Optional separate heading font (serif display over sans body) — same
    // contract as CourseCataloguePage: load it and expose the CSS var the
    // catalogue heading rule reads; unset → headings inherit the body font.
    const headingFamily = (fonts as { headingFamily?: string })?.headingFamily?.trim();
    if (headingFamily) {
      const primaryHeading = headingFamily.split(",")[0].replace(/['"]/g, "").trim();
      const headingHref = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
        primaryHeading
      )}:wght@300;400;500;600;700&display=swap`;
      if (!document.querySelector(`link[href="${headingHref}"]`)) {
        const headingLink = document.createElement("link");
        headingLink.rel = "stylesheet";
        headingLink.href = headingHref;
        document.head.appendChild(headingLink);
      }
      document.documentElement.style.setProperty("--catalogue-heading-font", headingFamily);
    } else {
      document.documentElement.style.removeProperty("--catalogue-heading-font");
    }

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

  // Listen for buttons asking to open an Audience campaign form as a popup
  // (action 'openForm' on buttonBlock / ctaBanner). Mirrors openLeadCollection.
  useEffect(() => {
    const handleOpenAudienceForm = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.audienceId) {
        setAudienceForm({ audienceId: detail.audienceId, title: detail.title });
      }
    };
    window.addEventListener('openAudienceForm', handleOpenAudienceForm);
    return () => window.removeEventListener('openAudienceForm', handleOpenAudienceForm);
  }, []);

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

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  if (isLoading || isCheckingAuth) {
    return <DashboardLoader />;
  }

  if (error || !catalogueData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            {error || t("courseSubPage.catalogueNotFound", { course })}
          </h2>
          <p className="text-gray-600 mb-4">
            {t("courseSubPage.catalogueNotLoaded", { course })}
          </p>
          <button
            onClick={() => navigate({ to: "/courses" })}
            className="px-4 py-2 bg-primary-600 text-white rounded-catalogue-sm hover:bg-primary-700"
          >
            {t("courseSubPage.goToCourses", { courses })}
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

  /** Same opt-out as CourseCataloguePage. This component is the one that
   *  ACTUALLY renders custom pages on published sites: /$tagName/$courseId/
   *  outranks /$tagName/$pageSlug in route matching, so the gate added to
   *  CourseCataloguePage never ran for them — found by tracing a live page's
   *  header parent chain over CDP after the config flag provably had no
   *  effect. An imported HTML page carries its own nav and footer. */
  const hidesSiteChrome = !!(currentPage as { hideSiteChrome?: boolean } | undefined)?.hideSiteChrome;

  // If no matching page found, show not found
  if (!currentPage) {
    console.warn("[CourseSubPage] No page found for route:", page);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            {t("courseSubPage.pageNotFound")}
          </h2>
          <p className="text-gray-600 mb-4">
            {t("courseSubPage.pageNotFoundDetail", { page })}
          </p>
          <button
            onClick={() => navigate({ to: `/${tagName}` })}
            className="px-4 py-2 bg-primary-600 text-white rounded-catalogue-sm hover:bg-primary-700"
          >
            {t("courseSubPage.goBackToCatalogue")}
          </button>
        </div>
      </div>
    );
  }


  // The generic blue title band is FALLBACK chrome, for pages that never
  // introduce themselves (a bare cart or policy page). Any page that opens with
  // its own hero or heading already shows a title, so the band is duplicate
  // chrome stacked on top of a designed page.
  //
  // This used to test for heroSection only. Directory/reference pages — the
  // composer's `courses` archetype — deliberately open with a COMPACT
  // sectionHeading instead of a tall hero so the content owns the fold, which
  // meant they fell through to the fallback and got a blue bar sitting above
  // their own heading.
  const enabledComponents = (currentPage.components || []).filter(
    (c: any) => c?.enabled !== false
  );
  const OPENS_WITH_OWN_TITLE = new Set([
    "heroSection",
    "sectionHeading",
    "detailBlocks",
    "htmlBlock",
    "banner",
  ]);
  const hasOwnPageHeader =
    enabledComponents.some((c: any) => c?.type === "heroSection") ||
    OPENS_WITH_OWN_TITLE.has(enabledComponents[0]?.type);
  const themeSettings = catalogueData?.globalSettings?.theme as any;

  return (
    <div
      // pt-20 exists to clear the fixed site header; with the chrome hidden it
      // would just open the page on an 80px blank strip.
      className={`min-h-screen bg-catalogue-bg w-full pb-20 md:pb-0 ${hidesSiteChrome ? '' : 'pt-20'}`}
      data-catalogue-theme={themeSettings?.preset || "default"}
      data-catalogue-radius={themeSettings?.borderRadius || "rounded-catalogue-xs"}
      data-heading-scale={themeSettings?.headingScale || "default"}
      data-catalogue-atmosphere={themeSettings?.atmosphere?.canvas || "flat"}
      data-catalogue-motion={(catalogueData?.globalSettings as any)?.motion?.personality}
      data-catalogue-intensity={themeSettings?.atmosphere?.intensity || "subtle"}
      data-catalogue-density={(catalogueData?.globalSettings as any)?.compactness || "medium"}
      style={buildPrimaryScaleVars(themeSettings?.primaryColor) as React.CSSProperties}
    >
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
          {!hidesSiteChrome && (catalogueData.globalSettings as any).layout?.header && (catalogueData.globalSettings as any).layout?.header?.enabled !== false && (
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

          {/* Page Title Header — fallback chrome only; suppressed when the page
              opens with its own hero or heading (see hasOwnPageHeader) */}
          {currentPage?.title && !hasOwnPageHeader && (
            <div
              className="w-full py-5 sm:py-6 lg:py-8"
              style={{
                backgroundColor: domainRouting.instituteThemeCode ?
                  `hsl(var(--primary))` :
                  '#3b82f6' // design-lint-ignore: page-builder default color
              }}
            >
              <div className="w-full px-4 sm:px-6 lg:px-8">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white text-center">
                  {currentPage.title} {currentPage.title === "Your Cart" ? "🛒" : ""}
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
          {!hidesSiteChrome && (catalogueData.globalSettings as any).layout?.footer && (catalogueData.globalSettings as any).layout?.footer?.enabled !== false && (
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
      {audienceForm && (
        <AudienceFormModal
          isOpen={!!audienceForm}
          onClose={() => setAudienceForm(null)}
          audienceId={audienceForm.audienceId}
          title={audienceForm.title}
          instituteId={instituteId}
        />
      )}
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


      {/* Mobile action bar — mirrors the header's Auth/CTA buttons (see
          MobileActionBar): admins control it from Global Header, including
          campaign-form popup buttons; removing every header button hides it. */}
            <WhatsAppFloatingButton
        settings={(catalogueData?.globalSettings as any)?.whatsapp}
        hasMobileBar
      />

      {(!showIntroPage || introCompleted) && catalogueData && (
        <MobileActionBar
          catalogueData={catalogueData}
          pageSlug={page}
          legacyGetStartedVisible={!(catalogueData?.globalSettings?.courseCatalogeType?.enabled ?? false)}
          onLogin={handleIntroLogin}
          onLegacyGetStarted={() => {
            if (catalogueData?.globalSettings.leadCollection.enabled) {
              setShowLeadCollection(true);
            } else {
              console.log("[CourseSubPage] Lead collection is disabled, not showing modal");
            }
          }}
          onNavigate={(route) => navigate({ to: `/${tagName}/${route.replace(/^\//, '')}` })}
        />
      )}
    </div>
  );
};
