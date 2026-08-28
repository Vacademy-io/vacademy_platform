import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { withArabicFallback } from "@/utils/branding";
import { Capacitor } from "@capacitor/core";
import { getTerminology, getTerminologyPlural } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import { useNavigate } from "@tanstack/react-router";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { LeadCollectionModal } from "./LeadCollectionModal";
import { AudienceFormModal } from "./AudienceFormModal";
import { MobileActionBar } from "./MobileActionBar";
import { useCatalogueTracking, captureUtmOnce } from "../-utils/catalogue-tracking";
import { CatalogueNamingProvider } from "../-utils/catalogue-naming";
import { WhatsAppFloatingButton } from "./WhatsAppFloatingButton";
import { IntroPageComponent } from "./IntroPageComponent";
import { JsonRenderer } from "./JsonRenderer";
import {
  CourseFinderWizard,
  type CourseFinderOptions,
  type CourseFinderSelection,
} from "./CourseFinderWizard";
import { buildPrimaryScaleVars } from "../-utils/style-utils";
import { CourseCatalogueService } from "../-services/course-catalogue-service";
import { CourseCatalogueData } from "../-types/course-catalogue-types";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { Helmet } from "react-helmet";
import { CaretUp } from "@phosphor-icons/react";
import { ensureFontsLoaded, collectConfigFontFamilies } from "../-utils/catalogue-fonts";
import { shouldShowMobileGetStarted } from "../-utils/catalogue-cta";

interface CourseCataloguePageProps {
  tagName: string;
  instituteId: string;
  instituteThemeCode?: string | null;
  /** When set, renders the page matching this route slug instead of the home page */
  pageSlug?: string;
}

export const CourseCataloguePage: React.FC<CourseCataloguePageProps> = ({
  tagName,
  instituteId,
  instituteThemeCode,
  pageSlug,
}) => {
  const { t } = useTranslation("coursePlayerA");
  const course = getTerminology(ContentTerms.Course, SystemTerms.Course);
  const courses = getTerminologyPlural(ContentTerms.Course, SystemTerms.Course);
  const navigate = useNavigate();
  const domainRouting = useDomainRouting();
  const isAndroid = Capacitor.getPlatform() === 'android';
  const isIOS = Capacitor.getPlatform() === 'ios';
  const [catalogueData, setCatalogueData] = useState<CourseCatalogueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLeadCollection, setShowLeadCollection] = useState(false);
  const [audienceForm, setAudienceForm] = useState<{ audienceId: string; title?: string } | null>(null);

  // Site-configured GA4 / Meta Pixel / GTM (Global Settings → Tracking) +
  // first-touch UTM capture for lead attribution.
  useCatalogueTracking((catalogueData?.globalSettings as any)?.tracking);


  useEffect(() => { captureUtmOnce(); }, []);
  // Non-mandatory lead collection is "armed" rather than shown immediately, then
  // surfaced on a scroll/dwell signal (see effect below) to avoid t=0 friction.
  const [leadArmed, setLeadArmed] = useState(false);
  const [showIntroPage, setShowIntroPage] = useState(false);
  const [introCompleted, setIntroCompleted] = useState(false);

  // Course Finder wizard: options arrive live from whichever courseCatalog
  // block(s) are on the page (see CourseCatalogComponent's
  // courseFinderOptionsReady broadcast) — never a separate fetch.
  const [courseFinderOptions, setCourseFinderOptions] = useState<CourseFinderOptions>({
    levels: [],
    sessions: [],
    tags: [],
  });
  const [hasCourseFinderOptions, setHasCourseFinderOptions] = useState(false);
  const [showCourseFinder, setShowCourseFinder] = useState(false);

  // Preview mode: bidirectional communication with admin editor iframe
  const isPreviewMode = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('preview') === 'true';
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);


  // Fetch course catalogue data
  useEffect(() => {
    const fetchCatalogueData = async () => {
      // Reset error state when starting a new fetch
      setError(null);

      try {
        setIsLoading(true);
        console.log("[CourseCataloguePage] Fetching catalogue data for:", { instituteId, tagName });

        const data = await CourseCatalogueService.getCourseCatalogueByTag(instituteId, tagName);

        console.log("[CourseCataloguePage] Successfully fetched catalogue data");
        setCatalogueData(data);

        // Check if intro page should be shown based on localStorage
        const introPageSeenKey = `introPageSeen_${instituteId}_${tagName}`;
        const hasSeenIntroPage = localStorage.getItem(introPageSeenKey) === 'true';

        // Check if lead collection form has already been submitted
        const leadCollectionSubmittedKey = `leadCollectionSubmitted_${instituteId}_${tagName}`;
        const hasSubmittedLeadCollection = localStorage.getItem(leadCollectionSubmittedKey) === 'true';

        console.log("Checking intro page and lead collection:", {
          introPageEnabled: data.introPage?.enabled,
          leadCollectionEnabled: data.globalSettings.leadCollection.enabled,
          hasSeenIntroPage,
          hasSubmittedLeadCollection,
          introPageSeenKey,
          leadCollectionSubmittedKey
        });

        if (data.introPage?.enabled && !hasSeenIntroPage) {
          console.log("Setting showIntroPage to true - first time visit or cache cleared");
          setShowIntroPage(true);
        } else if (data.introPage?.enabled && hasSeenIntroPage) {
          console.log("Intro page already seen, skipping intro page");
          // Mark intro as completed since user has already seen it
          setIntroCompleted(true);
        } else if (data.globalSettings.leadCollection.enabled && !hasSubmittedLeadCollection) {
          // Mandatory gates immediately; non-mandatory is armed for a deferred
          // scroll/dwell trigger so we don't interrupt at zero intent.
          if (data.globalSettings.leadCollection.mandatory) {
            setShowLeadCollection(true);
          } else {
            setLeadArmed(true);
          }
        }
      } catch (err) {
        console.error("[CourseCataloguePage] Error fetching catalogue data:", err);
        setError(t("courseSubPage.loadCatalogueFailed", { course }));
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch if we have valid instituteId and tagName
    // This prevents premature API calls before domain routing completes
    if (instituteId && tagName) {
      console.log("[CourseCataloguePage] Starting catalogue data fetch");
      fetchCatalogueData();
    } else {
      console.log("[CourseCataloguePage] Waiting for required data:", {
        hasInstituteId: !!instituteId,
        hasTagName: !!tagName,
      });
      // Keep loading state true while waiting for instituteId
      if (!instituteId || !tagName) {
        setIsLoading(true);
      }
    }
  }, [instituteId, tagName]);

  // Preview mode: receive live config updates and highlight signals from admin editor
  useEffect(() => {
    if (!isPreviewMode) return;

    // Signal readiness to the admin editor
    window.parent.postMessage({ type: 'PREVIEW_READY' }, '*');

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'CATALOGUE_CONFIG_UPDATE' && event.data.payload) {
        setCatalogueData(event.data.payload);
        setIsLoading(false);
        setError(null);
      }
      if (event.data?.type === 'HIGHLIGHT_COMPONENT') {
        setSelectedComponentId(event.data.componentId || null);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePreviewComponentClick = (componentId: string, pageId: string) => {
    window.parent.postMessage({ type: 'COMPONENT_SELECTED', componentId, pageId }, '*');
    setSelectedComponentId(componentId);
  };

  useEffect(() => {
    // Load EVERY font face the config references (global family + every
    // per-component style.typography.fontFamily incl. responsive overrides)
    // in one merged Google-Fonts request. Previously only the global family
    // loaded, so per-component font picks silently fell back to system fonts.
    ensureFontsLoaded(collectConfigFontFamilies(catalogueData));

    const fonts = catalogueData?.globalSettings?.fonts;
    if (!fonts?.enabled || !fonts?.family) {
      document.body.style.fontFamily = withArabicFallback(
        "'Figtree', system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      );
      document.documentElement.style.removeProperty("--catalogue-heading-font");
      return;
    }

    // Apply the global font exactly as specified in JSON, plus the Arabic
    // fallback the stack would otherwise drop (Latin order is preserved).
    const fontFamily = withArabicFallback(fonts.family.trim());
    document.body.style.fontFamily = fontFamily;
    document.documentElement.style.setProperty("--app-font-family", fontFamily);

    // Optional separate heading font (serif display over sans body). Set the
    // var consumed by the catalogue heading rule; clear it when unset so
    // headings fall back to the body font (byte-identical to before).
    const headingFamily = (fonts as { headingFamily?: string })?.headingFamily?.trim();
    if (headingFamily) {
      document.documentElement.style.setProperty("--catalogue-heading-font", headingFamily);
    } else {
      document.documentElement.style.removeProperty("--catalogue-heading-font");
    }
  }, [catalogueData]);

  // Apply institute theme
  useEffect(() => {
    if (instituteThemeCode) {
      document.documentElement.setAttribute('data-theme', instituteThemeCode);
    }
  }, [instituteThemeCode]);

  // Theme wiring — must be before early returns (Rules of Hooks)
  const wrapperRef = useRef<HTMLDivElement>(null);
  const themeSettings = (catalogueData?.globalSettings as any)?.theme;
  const themePreset = themeSettings?.preset || 'default';
  const themeRadius = themeSettings?.borderRadius || 'rounded';
  const isDarkMode = (catalogueData?.globalSettings as any)?.mode === 'dark';

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const primaryColor = themeSettings?.primaryColor as string | undefined;
    if (primaryColor && /^#[0-9a-fA-F]{6}$/.test(primaryColor)) {
      const r = parseInt(primaryColor.slice(1, 3), 16) / 255;
      const g = parseInt(primaryColor.slice(3, 5), 16) / 255;
      const b = parseInt(primaryColor.slice(5, 7), 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const l = (max + min) / 2;
      let h = 0, s = 0;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
      }
      const H = Math.round(h * 360), S = Math.round(s * 100), L = Math.round(l * 100);
      el.style.setProperty('--primary-500', `${H} ${S}% ${L}%`);
      // Keep the shadcn base `--primary` var in sync with --primary-500. The
      // header Login button (and other shadcn `bg-primary` elements) read
      // hsl(var(--primary)); without this it stays on a stale/default green
      // while the rest of the catalogue uses the institute color — so the
      // Login button looked a different green from every other accent.
      el.style.setProperty('--primary', `${H} ${S}% ${L}%`);
      el.style.setProperty('--primary-400', `${H} ${S}% ${Math.min(L + 10, 90)}%`);
      el.style.setProperty('--primary-200', `${H} ${Math.max(S - 15, 10)}% ${Math.min(L + 28, 95)}%`);
      el.style.setProperty('--primary-50', `${H} ${Math.max(S - 30, 5)}% ${Math.min(L + 43, 98)}%`);
    } else {
      el.style.removeProperty('--primary-500');
      el.style.removeProperty('--primary');
      el.style.removeProperty('--primary-400');
      el.style.removeProperty('--primary-200');
      el.style.removeProperty('--primary-50');
    }
  }, [themeSettings?.primaryColor]);

  // Listen for custom event to open lead collection
  useEffect(() => {
    const handleOpenLeadCollection = () => {
      console.log("[CourseCataloguePage] Received openLeadCollection event");
      // Only show lead collection if it's enabled in JSON
      if (catalogueData?.globalSettings.leadCollection.enabled) {
        setShowLeadCollection(true);
      } else {
        console.log("[CourseCataloguePage] Lead collection is disabled, ignoring openLeadCollection event");
      }
    };

    console.log("[CourseCataloguePage] Adding openLeadCollection event listener");
    window.addEventListener('openLeadCollection', handleOpenLeadCollection);

    return () => {
      console.log("[CourseCataloguePage] Removing openLeadCollection event listener");
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
    console.log("[CourseCataloguePage] Closing lead collection modal");
    if (catalogueData?.globalSettings.leadCollection.mandatory) {
      // If mandatory, don't allow closing
      console.log("[CourseCataloguePage] Lead collection is mandatory, not allowing close");
      return;
    }
    setShowLeadCollection(false);
  };

  const handleLeadCollectionSubmit = () => {
    // Persist so the modal doesn't re-arm on subsequent visits/reloads.
    try {
      localStorage.setItem(
        `leadCollectionSubmitted_${instituteId}_${tagName}`,
        "true",
      );
    } catch {
      // ignore storage errors (private mode etc.)
    }
    setLeadArmed(false);
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
    console.log(`[CourseCataloguePage] Marked intro page as seen: ${introPageSeenKey}`);

    // Show lead collection if enabled and not already shown and not already submitted
    const leadCollectionSubmittedKey = `leadCollectionSubmitted_${instituteId}_${tagName}`;
    const hasSubmittedLeadCollection = localStorage.getItem(leadCollectionSubmittedKey) === 'true';

    if (catalogueData?.globalSettings.leadCollection.enabled && !showLeadCollection && !hasSubmittedLeadCollection) {
      if (catalogueData.globalSettings.leadCollection.mandatory) {
        setShowLeadCollection(true);
      } else {
        setLeadArmed(true);
      }
    }
  };

  // Deferred trigger for non-mandatory lead collection: surface the modal once
  // the visitor shows intent (scrolled ~600px) or after a dwell fallback.
  useEffect(() => {
    if (!leadArmed || showLeadCollection || isPreviewMode) return;
    // One-shot: disarm the instant we show it so dismiss/submit can't re-arm
    // the trigger (the effect re-runs when showLeadCollection flips back).
    const fire = () => {
      setLeadArmed(false);
      setShowLeadCollection(true);
    };
    const onScroll = () => {
      if (window.scrollY > 600) fire();
    };
    const timer = setTimeout(fire, 15000);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [leadArmed, showLeadCollection, isPreviewMode]);

  const handleIntroClose = () => {
    setShowIntroPage(false);
    setIntroCompleted(true);

    // Mark intro page as seen in localStorage even when closed
    const introPageSeenKey = `introPageSeen_${instituteId}_${tagName}`;
    localStorage.setItem(introPageSeenKey, 'true');
    console.log(`[CourseCataloguePage] Marked intro page as seen (closed): ${introPageSeenKey}`);
  };

  // Course Finder: collect live filter options from the page's course-grid
  // block(s) as soon as they're ready.
  useEffect(() => {
    const handleOptionsReady = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setCourseFinderOptions({
        levels: Array.isArray(detail.levels) ? detail.levels : [],
        sessions: Array.isArray(detail.sessions) ? detail.sessions : [],
        tags: Array.isArray(detail.tags) ? detail.tags : [],
      });
      setHasCourseFinderOptions(true);
    };
    window.addEventListener('courseFinderOptionsReady', handleOptionsReady);
    return () => window.removeEventListener('courseFinderOptionsReady', handleOptionsReady);
  }, []);

  // Show it once — after intro/lead gating clears, options have arrived, and
  // this visitor hasn't completed or skipped it before at this tag page.
  useEffect(() => {
    if (isPreviewMode) return;
    if (!catalogueData?.globalSettings?.courseFinder?.enabled) return;
    if (!hasCourseFinderOptions) return;
    if (showIntroPage && !introCompleted) return;
    const seenKey = `courseFinderSeen_${instituteId}_${tagName}`;
    if (localStorage.getItem(seenKey) === 'true') return;
    setShowCourseFinder(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isPreviewMode,
    catalogueData?.globalSettings?.courseFinder?.enabled,
    hasCourseFinderOptions,
    showIntroPage,
    introCompleted,
  ]);

  const markCourseFinderSeen = () => {
    try {
      localStorage.setItem(`courseFinderSeen_${instituteId}_${tagName}`, 'true');
    } catch {
      // ignore storage errors (private mode etc.)
    }
  };

  const handleCourseFinderComplete = (selection: CourseFinderSelection) => {
    setShowCourseFinder(false);
    markCourseFinderSeen();
    window.dispatchEvent(new CustomEvent('courseFinderApplied', { detail: selection }));
  };

  const handleCourseFinderSkip = () => {
    setShowCourseFinder(false);
    markCourseFinderSeen();
  };

  if (isLoading) {
    return <DashboardLoader />;
  }

  if (error || !catalogueData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-catalogue-bg px-4">
        <div className="catalogue-card flex max-w-md flex-col items-center gap-3 p-8 text-center">
          <h2 className="text-xl font-semibold text-catalogue-text-primary">
            {error || t("courseSubPage.catalogueNotFound", { course })}
          </h2>
          <p className="text-sm text-catalogue-text-secondary">
            {t("courseSubPage.catalogueNotLoaded", { course })}
          </p>
          <button
            onClick={() => navigate({ to: "/courses" })}
            className="catalogue-btn catalogue-btn-primary mt-1"
          >
            {t("courseSubPage.goToCourses", { courses })}
          </button>
        </div>
      </div>
    );
  }

  // Keep the tenant's branded tab title (set by TabBranding/use-domain-routing);
  // only fall back to a sensible default if none was applied. og:* uses the
  // richer institute name for link previews without overriding the tab title.
  const brandedTitle =
    (typeof document !== "undefined" && document.title) || "";
  const defaultCatalogueTitle = t("courseCataloguePage.defaultTitle", { course });
  const seoTitle = brandedTitle || domainRouting.instituteName || defaultCatalogueTitle;
  const ogTitle = domainRouting.instituteName || defaultCatalogueTitle;
  const seoDescription = domainRouting.instituteName
    ? t("courseCataloguePage.seoDescriptionWithInstitute", {
        courses,
        institute: domainRouting.instituteName,
      })
    : t("courseCataloguePage.seoDescription", { courses });

  /** Which page this URL resolves to. Shared by the chrome check and the
   *  render so the two can never disagree about what is on screen. */
  const matchesActivePage = (page: { id?: string; route?: string }) =>
    pageSlug
      ? page.route === pageSlug || page.route === `/${pageSlug}`
      : page.id === "home" ||
        page.route === "homepage" ||
        page.route === "/" ||
        page.route === "";

  /** An imported HTML page normally pastes in its own nav and footer, so the
   *  site's chrome would render a second set. Opt-out lives on the page. */
  const hidesSiteChrome = !!(
    catalogueData.pages.find(matchesActivePage) as { hideSiteChrome?: boolean } | undefined
  )?.hideSiteChrome;

  return (
    <CatalogueNamingProvider naming={catalogueData?.globalSettings?.naming}>
    <div
      ref={wrapperRef}
      className={`min-h-screen bg-catalogue-bg w-full pb-20 md:pb-0 md:pt-0${isDarkMode ? ' dark' : ''}`}
      data-catalogue-theme={themePreset}
      data-catalogue-radius={themeRadius}
      data-heading-scale={catalogueData?.globalSettings?.theme?.headingScale || 'default'}
      data-catalogue-atmosphere={themeSettings?.atmosphere?.canvas || 'flat'}
      data-catalogue-motion={(catalogueData?.globalSettings as any)?.motion?.personality}
      data-catalogue-intensity={themeSettings?.atmosphere?.intensity || 'subtle'}
      data-catalogue-density={(catalogueData?.globalSettings as any)?.compactness || 'medium'}
      style={buildPrimaryScaleVars(themeSettings?.primaryColor) as React.CSSProperties}
    >
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:type" content="website" />
      </Helmet>
      {/* Intro Page - Show first if enabled and not completed (hidden in preview mode) */}
      {showIntroPage && !isPreviewMode && catalogueData?.introPage && (
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
          {/* Keyboard users land on the header nav; this lets them jump the
              whole global chrome straight to the page content. */}
          <a href="#catalogue-main" className="catalogue-skip-link">
            {t("courseCataloguePage.skipToMainContent")}
          </a>
          {/* Header from JSON globalSettings.
              Suppressed when the active page asks for it: an imported HTML
              page usually pastes in its own nav and footer, so rendering the
              site's chrome as well gives the visitor two of each. */}
          {!hidesSiteChrome && (catalogueData.globalSettings as any).layout?.header && (catalogueData.globalSettings as any).layout?.header?.enabled !== false && (
            <div className={(catalogueData.globalSettings as any).stickyHeader !== false ? 'sticky top-0 z-50' : ''}>
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
                isPreviewMode={isPreviewMode}
                selectedComponentId={selectedComponentId}
                onComponentClick={handlePreviewComponentClick}
              />
            </div>
          )}

          {/* Legacy page title banner — removed in v2. Page titles are now handled by hero/textBlock components. */}
          {/* Render the matching page (home page by default, or specific slug) */}
          {catalogueData.pages
            .filter(matchesActivePage)
            .map((page) => (
              <main id="catalogue-main" tabIndex={-1} key={page.id} className={hidesSiteChrome ? '' : 'pt-16 md:pt-20'} style={{ backgroundColor: (page as any).backgroundColor || undefined }}>
                <JsonRenderer
                  page={page}
                  globalSettings={catalogueData.globalSettings}
                  instituteId={instituteId}
                  tagName={tagName}
                  isPreviewMode={isPreviewMode}
                  selectedComponentId={selectedComponentId}
                  onComponentClick={handlePreviewComponentClick}
                />
              </main>
            ))}

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
              isPreviewMode={isPreviewMode}
              selectedComponentId={selectedComponentId}
              onComponentClick={handlePreviewComponentClick}
            />
          )}
        </>
      )}

      {/* Lead Collection Modal - Show when requested, intro completed, and not in preview mode */}
      {audienceForm && (
        <AudienceFormModal
          isOpen={!!audienceForm}
          onClose={() => setAudienceForm(null)}
          audienceId={audienceForm.audienceId}
          title={audienceForm.title}
          instituteId={instituteId}
        />
      )}
      {showLeadCollection && !isPreviewMode && catalogueData && catalogueData.globalSettings.leadCollection && (!showIntroPage || introCompleted) && (
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

      {showCourseFinder && !isPreviewMode && catalogueData?.globalSettings?.courseFinder && (
        <CourseFinderWizard
          steps={catalogueData.globalSettings.courseFinder.steps}
          mandatory={catalogueData.globalSettings.courseFinder.mandatory}
          stepLabels={catalogueData.globalSettings.courseFinder.stepLabels}
          levelGroups={catalogueData.globalSettings.courseFinder.levelGroups}
          options={courseFinderOptions}
          onComplete={handleCourseFinderComplete}
          onSkip={handleCourseFinderSkip}
        />
      )}

      {/* Mobile action bar — mirrors the header's Auth/CTA buttons (see
          MobileActionBar): admins control it from Global Header, including
          campaign-form popup buttons; removing every header button hides it. */}
            <WhatsAppFloatingButton
        settings={(catalogueData?.globalSettings as any)?.whatsapp}
        hasMobileBar
      />

      {(!showIntroPage || introCompleted) && !isPreviewMode && catalogueData && (
        <MobileActionBar
          catalogueData={catalogueData}
          pageSlug={pageSlug}
          legacyGetStartedVisible={!(catalogueData?.globalSettings?.courseCatalogeType?.enabled ?? false)}
          onLogin={handleIntroLogin}
          onLegacyGetStarted={() => setShowLeadCollection(true)}
          onNavigate={(route) => navigate({ to: `/${tagName}/${route.replace(/^\//, '')}` })}
          nativePad={isAndroid || isIOS}
        />
      )}

      {/* Back to Top Button */}
      {catalogueData?.globalSettings?.backToTop && !isPreviewMode && (
        <BackToTopButton />
      )}
    </div>
    </CatalogueNamingProvider>
  );
};

/* ─── Back to Top Button ───────────────────────────────────────────────── */

const BackToTopButton = () => {
  const { t } = useTranslation("coursePlayerA");
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="catalogue-fab fixed bottom-6 end-6 z-50 flex h-11 w-11 items-center justify-center rounded-full backdrop-blur active:scale-95 md:bottom-8 md:end-8"
      aria-label={t("courseCataloguePage.backToTop")}
    >
      <CaretUp size={20} weight="bold" aria-hidden="true" />
    </button>
  );
};
