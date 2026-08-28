import { useTranslation } from "react-i18next";
import type {
  ProductPageData,
  ProductPageSettings,
  PageJson,
} from "../-types/product-page-types";
import { PageRenderer, CourseGridBlock } from "./PageRenderer";
import { BasketSummaryBar } from "./BasketSummaryBar";
import { useCourseTerms } from "@/routes/$tagName/-utils/catalogue-naming";
import { StepRailBar } from "./StepRailBar";

interface CatalogStepProps {
  pageData: ProductPageData;
  settings: ProductPageSettings;
  /** Catalogue slug — enables the per-card "View course" link. */
  tagName?: string;
  productPageCode?: string;
  /** Comma-separated level names the grid is restricted to (Course Finder). */
  levels?: string;
  onNext: () => void;
}

function parseSafeJson<T>(jsonStr: string | null | undefined, fallback: T): T {
  if (!jsonStr) return fallback;
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return fallback;
  }
}

const DEFAULT_PAGE_JSON: PageJson = {
  globalSettings: { primaryColor: "#4F46E5", logoFileId: "" }, // design-lint-ignore: page-builder default color
  components: [],
};

export const CatalogStep = ({
  pageData,
  settings,
  tagName,
  productPageCode,
  levels,
  onNext,
}: CatalogStepProps) => {
  const { t } = useTranslation("productPages");
  const courses = useCourseTerms().courses;

  const pageJson = parseSafeJson<PageJson>(
    pageData.page_json,
    DEFAULT_PAGE_JSON,
  );

  const designedPrimary = pageJson.globalSettings?.primaryColor || "#4F46E5"; // design-lint-ignore: page-builder default color

  if (pageJson.components.length > 0) {
    return (
      <>
        {/* The rail belongs here too. Leaving it off a designed page meant the
            wizard was absent while browsing and appeared on reaching the cart,
            which reads as random rather than as step 1 of 4. */}
        <StepRailBar primaryColor={designedPrimary} variant="catalogue" />
      <PageRenderer
        pageJson={pageJson}
        pageData={pageData}
        settings={settings}
        tagName={tagName}
        productPageCode={productPageCode}
        lockedLevels={levels}
        onNext={onNext}
      />
      </>
    );
  }

  // ── Fallback: a product page with no page_json still gets the full browse
  // experience (search, popular tags, level / batch / price filters, paging)
  // instead of an unfiltered wall of every course on the page. Same grid the
  // page-builder renders, so the two never diverge.
  const activeMappings = pageData.mappings.filter((m) => m.status === "ACTIVE");
  const primaryColor = pageJson.globalSettings?.primaryColor || "#4F46E5"; // design-lint-ignore: page-builder default color

  return (
    <div className="min-h-screen bg-catalogue-bg">
      <StepRailBar primaryColor={primaryColor} variant="catalogue" />

      {/* Page title */}
      <div className="border-b border-catalogue-border px-6 py-8 lg:px-8">
        <div className="mx-auto max-w-screen-2xl">
          <h1 className="text-3xl font-bold leading-tight text-catalogue-text-primary md:text-4xl">
            {pageData.name}
          </h1>
          {activeMappings.length > 1 && (
            <p className="mt-2 text-sm text-catalogue-text-muted">
              {t("catalogStep.selectPrompt", { courses: courses.toLocaleLowerCase() })}
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-screen-2xl">
        {/* Column count tracks the catalogue size, as the previous fallback
            did — a lone course stretched across a 3-up grid reads as a
            broken row rather than a deliberate single offer. */}
        <CourseGridBlock
          props={{ columns: Math.min(activeMappings.length, 3) || 1 }}
          pageData={pageData}
          settings={settings}
          primaryColor={primaryColor}
          tagName={tagName}
          productPageCode={productPageCode}
          lockedLevels={levels}
        />
      </div>

      {/* Sticky action bar — shared with the designed-page catalogue, so the
          two formats cannot quote different totals for the same basket. */}
      <BasketSummaryBar
        pageData={pageData}
        onNext={onNext}
        primaryColor={primaryColor}
      />

    </div>
  );
};
