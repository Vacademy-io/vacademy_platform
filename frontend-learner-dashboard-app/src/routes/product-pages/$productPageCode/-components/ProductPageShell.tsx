import { useEffect, useLayoutEffect, useRef } from "react";
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
import { CpoInstallmentsCheckoutStep } from "./CpoInstallmentsCheckoutStep";
import { ProductPageSuccess } from "./ProductPageSuccess";
import { CheckoutLayout } from "./CheckoutLayout";
import type {
  ProductPageSettings,
  PageJson,
  ProductPageData,
} from "../-types/product-page-types";

interface ProductPageShellProps {
  productPageCode: string;
  instituteId: string;
  pageData: ProductPageData;
  courseIds?: string;
  defaultTab?: "CATALOG" | "CART" | "PAYMENT";
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
  pageData,
  courseIds,
  defaultTab,
  utmParams,
}: ProductPageShellProps) => {
  const { step, setPageData, setStep, setSelection, setUtmParams, selectedPsOptionIds } =
    useProductPageStore();
  const gtmFired = useRef(false);
  const initialized = useRef(false);

  // useLayoutEffect runs synchronously before the browser paints — ensures the
  // correct step is set before any frame is visible, preventing a flash of the
  // catalog when the page is supposed to start on CART / FORM.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    setPageData(pageData);

    const settings = parseSafeJson<ProductPageSettings>(
      pageData.settings_json,
      DEFAULT_SETTINGS,
    );

    const resolvedStep = defaultTab ?? settings.defaultStep;
    const startStep =
      resolvedStep === "CART"
        ? "CART"
        : resolvedStep === "PAYMENT"
          ? "FORM"
          : "CATALOG";

    // Priority: URL courseIds → DB preselected → empty. Never auto-select all.
    setSelection(resolveInitialSelection(pageData.mappings, courseIds));

    const utmFiltered = Object.fromEntries(
      Object.entries(utmParams).filter(([, v]) => v !== undefined),
    ) as Record<string, string>;
    setUtmParams(utmFiltered);

    setStep(startStep);
  }, []);

  // GTM injection — run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (gtmFired.current) return;
    const settings = parseSafeJson<ProductPageSettings>(
      pageData.settings_json,
      DEFAULT_SETTINGS,
    );
    const gtmId = settings.gtmContainerId || pageData.gtm_container_id;
    if (gtmId) {
      injectGtm(gtmId);
      gtmFired.current = true;
      const utmFiltered = Object.fromEntries(
        Object.entries(utmParams).filter(([, v]) => v !== undefined),
      ) as Record<string, string>;
      pushProductPageView(productPageCode, settings.defaultStep, utmFiltered);
    }
  }, []);

  const settings = parseSafeJson<ProductPageSettings>(
    pageData.settings_json,
    DEFAULT_SETTINGS,
  );
  const pageJson = parseSafeJson<PageJson>(pageData.page_json, DEFAULT_PAGE_JSON);
  const primaryColor = pageJson.globalSettings?.primaryColor || "#4F46E5";
  const vendor = (pageData.vendor || "FREE").toUpperCase();

  // Determine if the current selection is all-CPO (routes to CPO installments step)
  const selectedMappings = pageData.mappings.filter((m) =>
    selectedPsOptionIds.includes(m.ps_invite_payment_option_id)
  );
  const isCpoSelection =
    selectedMappings.length > 0 &&
    selectedMappings.every((m) => m.payment_option_type?.toUpperCase() === "CPO");

  const handleFormNext = () => {
    setStep(isCpoSelection ? "CPO_INSTALLMENTS" : "PAYMENT");
  };

  return (
    <div className="min-h-screen w-full bg-white">
      {step === "CATALOG" && (
        <CatalogStep
          pageData={pageData}
          settings={settings}
          onNext={() => setStep("CART")}
        />
      )}

      {(step === "CART" || step === "FORM" || step === "PAYMENT" || step === "CPO_INSTALLMENTS") && (
        <CheckoutLayout
          pageData={pageData}
          pageJson={pageJson}
          primaryColor={primaryColor}
        >
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
              courseIds={courseIds}
              onBack={() => setStep("CART")}
              onNext={handleFormNext}
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
          {step === "CPO_INSTALLMENTS" && (
            <CpoInstallmentsCheckoutStep
              pageData={pageData}
              settings={settings}
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
