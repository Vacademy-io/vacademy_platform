import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { handleGetProductPage } from "../-services/product-page-service";
import { useProductPageStore } from "../-stores/product-page-store";
import { resolveInitialSelection } from "../-utils/custom-field-aggregator";
import {
  injectGtm,
  pushProductPageView,
} from "@/components/common/enroll-by-invite/-utils/gtm";
import { CatalogStep } from "./CatalogStep";
import { CartStep } from "./CartStep";
import { MultiEnrollForm } from "./MultiEnrollForm";
import { CombinedPaymentStep } from "./CombinedPaymentStep";
import { ProductPageSuccess } from "./ProductPageSuccess";
import { CheckoutLayout } from "./CheckoutLayout";
import type { ProductPageSettings, PageJson } from "../-types/product-page-types";

interface ProductPageShellProps {
  productPageCode: string;
  instituteId: string;
  courseIds?: string;
  defaultTab?: 'CATALOG' | 'CART' | 'PAYMENT';
  utmParams: Record<string, string | undefined>;
}

function parseSafeJson<T>(jsonStr: string | null | undefined, fallback: T): T {
  if (!jsonStr) return fallback;
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return fallback;
  }
}

const DEFAULT_SETTINGS: ProductPageSettings = {
  defaultStep: "CATALOG",
  allowCourseDeselection: true,
  gtmContainerId: "",
  tnc: { enabled: false, content: "", externalUrl: "" },
  invoice: { enabled: true, channels: ["EMAIL"] },
};

const DEFAULT_PAGE_JSON: PageJson = {
  globalSettings: { primaryColor: "#4F46E5", logoFileId: "" },
  components: [],
};

export const ProductPageShell = ({
  productPageCode,
  instituteId,
  courseIds,
  defaultTab,
  utmParams,
}: ProductPageShellProps) => {
  const { step, pageData, setPageData, setStep, setSelection, setUtmParams } =
    useProductPageStore();
  const gtmFired = useRef(false);

  const { data, isLoading, error } = useQuery({
    ...handleGetProductPage(productPageCode, instituteId),
  });

  // Hydrate store once on data load
  const initialized = useRef(false);
  useEffect(() => {
    if (!data || initialized.current) return;
    initialized.current = true;
    setPageData(data);

    const settings = parseSafeJson<ProductPageSettings>(
      data.settings_json,
      DEFAULT_SETTINGS,
    );
    const initial = resolveInitialSelection(data.mappings, courseIds);
    setSelection(initial);

    const utmFiltered = Object.fromEntries(
      Object.entries(utmParams).filter(([, v]) => v !== undefined),
    ) as Record<string, string>;
    setUtmParams(utmFiltered);

    // URL param overrides the saved setting — allows sharing step-specific links
    const resolvedStep = defaultTab ?? settings.defaultStep;
    const startStep =
      resolvedStep === "CART"
        ? "CART"
        : resolvedStep === "PAYMENT"
          ? "FORM"
          : "CATALOG";
    setStep(startStep);
  }, [data]);

  // GTM injection
  useEffect(() => {
    if (!data || gtmFired.current) return;
    const settings = parseSafeJson<ProductPageSettings>(
      data.settings_json,
      DEFAULT_SETTINGS,
    );
    const gtmId = settings.gtmContainerId || data.gtm_container_id;
    if (gtmId) {
      injectGtm(gtmId);
      gtmFired.current = true;
      pushProductPageView(productPageCode, settings.defaultStep, utmParams);
    }
  }, [data]);

  if (isLoading || !pageData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="size-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  if (error) {
    const msg = error instanceof Error ? error.message : "Failed to load page";
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
        <p className="text-lg font-semibold text-gray-700">
          Unable to load this page
        </p>
        <p className="mt-2 text-sm text-gray-500">{msg}</p>
      </div>
    );
  }

  const settings = parseSafeJson<ProductPageSettings>(
    pageData.settings_json,
    DEFAULT_SETTINGS,
  );
  const pageJson = parseSafeJson<PageJson>(pageData.page_json, DEFAULT_PAGE_JSON);
  const primaryColor = pageJson.globalSettings?.primaryColor || "#4F46E5";
  const vendor = (pageData.vendor || "FREE").toUpperCase();

  return (
    <div className="min-h-screen w-full bg-white">
      {step === "CATALOG" && (
        <CatalogStep
          pageData={pageData}
          settings={settings}
          onNext={() => setStep("CART")}
        />
      )}

      {(step === "CART" || step === "FORM" || step === "PAYMENT") && (
        <CheckoutLayout pageData={pageData} pageJson={pageJson} primaryColor={primaryColor}>
          {step === "CART" && (
            <CartStep
              pageData={pageData}
              settings={settings}
              primaryColor={primaryColor}
              onBack={() => setStep("CATALOG")}
              onNext={() => setStep("FORM")}
            />
          )}
          {step === "FORM" && (
            <MultiEnrollForm
              pageData={pageData}
              settings={settings}
              primaryColor={primaryColor}
              onBack={() => setStep("CART")}
              onNext={() => setStep("PAYMENT")}
            />
          )}
          {step === "PAYMENT" && (
            <CombinedPaymentStep
              pageData={pageData}
              settings={settings}
              instituteId={instituteId}
              vendor={vendor}
              primaryColor={primaryColor}
              onBack={() => setStep("FORM")}
              onSuccess={() => setStep("SUCCESS")}
            />
          )}
        </CheckoutLayout>
      )}

      {step === "SUCCESS" && <ProductPageSuccess pageData={pageData} />}
    </div>
  );
};
