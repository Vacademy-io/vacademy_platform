import { useProductPageStore } from "../-stores/product-page-store";
import type {
  ProductPageData,
  ProductPageSettings,
  PageJson,
} from "../-types/product-page-types";
import { ShieldCheck, ShoppingCart } from "@phosphor-icons/react";
import { PageRenderer, CourseGridBlock } from "./PageRenderer";
import { StepProgress } from "./StepProgress";

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
  const { selectedPsOptionIds, totalPrice } = useProductPageStore();

  const pageJson = parseSafeJson<PageJson>(
    pageData.page_json,
    DEFAULT_PAGE_JSON,
  );

  if (pageJson.components.length > 0) {
    return (
      <PageRenderer
        pageJson={pageJson}
        pageData={pageData}
        settings={settings}
        tagName={tagName}
        productPageCode={productPageCode}
        lockedLevels={levels}
        onNext={onNext}
      />
    );
  }

  // ── Fallback: a product page with no page_json still gets the full browse
  // experience (search, popular tags, level / batch / price filters, paging)
  // instead of an unfiltered wall of every course on the page. Same grid the
  // page-builder renders, so the two never diverge.
  const activeMappings = pageData.mappings.filter((m) => m.status === "ACTIVE");
  const currency =
    pageData.currency || activeMappings[0]?.payment_plan?.currency || "";
  const primaryColor = pageJson.globalSettings?.primaryColor || "#4F46E5"; // design-lint-ignore: page-builder default color

  const price = totalPrice();
  const count = selectedPsOptionIds.length;

  return (
    <div className="min-h-screen bg-catalogue-bg">
      {/* Step rail — same one the checkout steps wear, so browsing reads as
          step 1 of 4 rather than a separate page. Only on this fallback view:
          a page_json-designed catalog is the admin's own layout and must not
          get platform chrome injected above it. */}
      <div className="border-b border-catalogue-border bg-catalogue-bg-elevated px-4 py-5">
        <div className="mx-auto flex max-w-screen-xl items-center gap-4">
          <div className="min-w-0 flex-1 overflow-x-auto">
            <StepProgress primaryColor={primaryColor} />
          </div>
          <div className="hidden shrink-0 items-center gap-1.5 md:flex">
            <ShieldCheck className="size-4 text-success-600" aria-hidden="true" />
            <div className="leading-tight">
              <p className="text-caption font-semibold text-catalogue-text-secondary">
                Secure &amp; Safe
              </p>
              <p className="text-2xs text-catalogue-text-muted">Your data is protected</p>
            </div>
          </div>
        </div>
      </div>

      {/* Page title */}
      <div className="border-b border-catalogue-border px-6 py-8 lg:px-8">
        <div className="mx-auto max-w-screen-2xl">
          <h1 className="text-3xl font-bold leading-tight text-catalogue-text-primary md:text-4xl">
            {pageData.name}
          </h1>
          {activeMappings.length > 1 && (
            <p className="mt-2 text-sm text-catalogue-text-muted">
              Select the courses you'd like to enroll in
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

      {/* Sticky action bar */}
      {count > 0 && (
        <div className="sticky bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm">
          <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">
                {count} course{count !== 1 ? "s" : ""} selected
              </p>
              {price > 0 ? (
                <p className="text-base font-bold text-gray-900">
                  {currency} {price.toLocaleString()}
                </p>
              ) : (
                <p className="text-xs font-medium text-green-600">
                  Free enrollment
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onNext}
              className="flex shrink-0 items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
            >
              <ShoppingCart className="size-4" />
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
