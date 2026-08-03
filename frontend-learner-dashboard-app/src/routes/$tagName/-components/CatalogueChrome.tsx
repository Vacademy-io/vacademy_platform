import React, { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { JsonRenderer } from "./JsonRenderer";
import { CourseCatalogueService } from "../-services/course-catalogue-service";
import { applyCataloguePrimaryColor } from "../-utils/catalogue-theme";
import { withArabicFallback } from "@/utils/branding";

/**
 * Wraps a non-catalogue page in the catalogue's own chrome: theme preset,
 * light/dark mode, institute primary colour, fonts, and the header/footer the
 * admin configured in globalSettings.layout.
 *
 * Why: a visitor who follows "See all courses" from a catalogue section lands
 * on the product page, which has its own (usually empty) page_json and so
 * rendered bare — no navigation, no footer, and the page-builder DEFAULT
 * indigo instead of the institute's colour. Passing the catalogue slug along
 * lets that page keep the site it belongs to.
 *
 * With no tagName this renders children untouched, so a product page opened
 * directly (short link, ad, QR) looks exactly as it does today.
 */
interface CatalogueChromeProps {
  /** Catalogue slug the visitor came from — the chrome's source. */
  tagName?: string;
  instituteId: string;
  children: React.ReactNode;
}

export const CatalogueChrome: React.FC<CatalogueChromeProps> = ({
  tagName,
  instituteId,
  children,
}) => {
  const themeRootRef = useRef<HTMLDivElement>(null);

  // The catalogue pages fetch this through useEffect + service rather than
  // react-query, so this is its own request (cached here for repeat visits
  // within the session, not shared with theirs).
  const { data: catalogueData } = useQuery({
    queryKey: ["COURSE_CATALOGUE_BY_TAG", instituteId, tagName],
    queryFn: () => CourseCatalogueService.getCourseCatalogueByTag(instituteId, tagName || ""),
    enabled: !!tagName && !!instituteId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const globalSettings = catalogueData?.globalSettings as any;

  useEffect(() => {
    applyCataloguePrimaryColor(themeRootRef.current, globalSettings?.theme?.primaryColor);
  }, [globalSettings?.theme?.primaryColor]);

  // Fonts are part of "the theme" the admin picked; mirrors the catalogue page.
  useEffect(() => {
    const fonts = globalSettings?.fonts;
    if (!fonts?.enabled || !fonts?.family) return;
    const family = withArabicFallback(fonts.family);
    document.body.style.fontFamily = family;
    document.documentElement.style.setProperty("--app-font-family", family);
  }, [globalSettings?.fonts?.enabled, globalSettings?.fonts?.family]);

  // Nothing to dress the page with — render it exactly as before.
  if (!tagName || !catalogueData) return <>{children}</>;

  const header = globalSettings?.layout?.header;
  const footer = globalSettings?.layout?.footer;
  const headerEnabled = !!header && header.enabled !== false;
  const isDarkMode = globalSettings?.mode === "dark";

  const renderBlock = (id: string, component: unknown) => (
    <JsonRenderer
      page={{ id, route: id, title: id, components: [component] as any }}
      globalSettings={catalogueData.globalSettings}
      instituteId={instituteId}
      tagName={tagName}
      catalogueData={catalogueData}
    />
  );

  return (
    <div
      ref={themeRootRef}
      data-catalogue-theme={globalSettings?.theme?.preset || "default"}
      className={`min-h-screen w-full bg-catalogue-bg${isDarkMode ? " dark" : ""}`}
    >
      {headerEnabled && (
        <div className={globalSettings?.stickyHeader !== false ? "sticky top-0 z-50" : ""}>
          {renderBlock("header", header)}
        </div>
      )}

      {/* HeaderComponent renders a `fixed` <header> (h-16 md:h-20) and emits no
          spacer, and JsonRenderer deliberately skips its own pt-16 for a page
          whose id IS "header" — so the wrapper above collapses to zero height
          and the child page starts underneath the header, its first heading
          hidden. CourseCataloguePage's <main> and CourseDetailsPage reserve the
          same offset; mirror it here. */}
      <div className={headerEnabled ? "pt-16 md:pt-20" : ""}>{children}</div>

      {footer && footer.enabled !== false && renderBlock("footer", footer)}
    </div>
  );
};

export default CatalogueChrome;
