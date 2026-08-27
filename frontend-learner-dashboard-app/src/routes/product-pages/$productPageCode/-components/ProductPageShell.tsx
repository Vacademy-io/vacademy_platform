import { useEffect, useLayoutEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
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
import { CatalogueChrome } from "@/routes/$tagName/-components/CatalogueChrome";
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
  /** Catalogue the visitor came from — supplies header, footer and theme. */
  tagName?: string;
  /** Comma-separated level names the browse step is restricted to. */
  levels?: string;
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
  globalSettings: { primaryColor: "#4F46E5", logoFileId: "" }, // design-lint-ignore: page-builder default color
  components: [],
};

export const ProductPageShell = ({
  productPageCode,
  instituteId,
  pageData,
  courseIds,
  defaultTab,
  tagName,
  levels,
  utmParams,
}: ProductPageShellProps) => {
  const { step, setPageData, setStep, setSelection, setUtmParams, selectedPsOptionIds } =
    useProductPageStore();
  const gtmFired = useRef(false);
  const initialized = useRef(false);
  const navigate = useNavigate();

  /**
   * Where "Back" from the cart leads.
   *
   * A visitor who arrived from a catalogue with a basket already filled
   * (defaultTab=CART) has never seen THIS page's own catalogue step, so
   * dropping them there is a place they have never been — a different grid of
   * the same courses, with the basket bar they were just using replaced by
   * another one. Send them back where they came from instead; the catalogue
   * restores their basket from sessionStorage, so nothing is lost.
   *
   * Once they have actually visited this page's catalogue step, that becomes
   * the honest destination again.
   */
  const enteredAtCart = useRef(defaultTab === "CART").current;
  const sawOwnCatalog = useRef(defaultTab !== "CART");
  useEffect(() => {
    if (step === "CATALOG") sawOwnCatalog.current = true;
  }, [step]);

  const backFromCart = () => {
    if (enteredAtCart && !sawOwnCatalog.current && tagName) {
      navigate({ to: `/${tagName}` });
      return;
    }
    setStep("CATALOG");
  };

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
  const primaryColor = pageJson.globalSettings?.primaryColor || "#4F46E5"; // design-lint-ignore: page-builder default color
  const vendor = (pageData.vendor || "FREE").toUpperCase();

  // Matches the header/footer types PageRenderer renders itself, so a product
  // page the admin gave its own chrome never gets a second one layered on.
  const pageHasOwnChrome = (pageJson.components || []).some(
    (c) =>
      c.enabled !== false &&
      ["Header", "header", "Footer", "footer"].includes(c.type as string),
  );

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
      {/* Only the browse step wears the catalogue chrome. The checkout steps
          stay in CheckoutLayout's focused shell — dropping site navigation
          into a payment flow invites visitors to wander out of it.
          A page_json that already declares its own header/footer keeps them:
          injecting the catalogue's on top would stack two headers. */}
      {step === "CATALOG" && (
        <CatalogueChrome
          tagName={pageHasOwnChrome ? undefined : tagName}
          instituteId={instituteId}
          showFooter={false}
        >
          <CatalogStep
            pageData={pageData}
            settings={settings}
            tagName={tagName}
            productPageCode={productPageCode}
            levels={levels}
            onNext={() => setStep("CART")}
          />
        </CatalogueChrome>
      )}

      {(step === "CART" || step === "FORM" || step === "PAYMENT" || step === "CPO_INSTALLMENTS") && (
        <CheckoutLayout
          pageData={pageData}
          pageJson={pageJson}
          settings={settings}
          primaryColor={primaryColor}
        >
          {step === "CART" && (
            <CartStep
              pageData={pageData}
              settings={settings}
              primaryColor={primaryColor}
              onBack={backFromCart}
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
