import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useProductPageStore } from "../-stores/product-page-store";
import { CheckCircle, BookOpen, ArrowRight } from "@phosphor-icons/react";
import { formatPriceAmount } from "@/components/common/price-with-mrp";
import { itemSubject } from "../-utils/cart-item-display";
import { shouldHidePaidPurchaseUI } from "@/utils/ios-iap-compliance";
import {
  getTerminology,
  getTerminologyPlural,
} from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import type {
  ProductPageData,
  ProductPageSettings,
} from "../-types/product-page-types";

interface ProductPageSuccessProps {
  pageData: ProductPageData;
}

// Origins allowed to receive the PAYMENT_SUCCESS postMessage when this page is
// embedded in an iframe. Sending to a targetOrigin (not '*') prevents leaking
// the event to unintended embedders.
const PAYMENT_SUCCESS_TARGET_ORIGINS = [
  "https://shikshanation.com",
  "https://www.shikshanation.com",
  "http://localhost:3000",
];

export const ProductPageSuccess = ({ pageData }: ProductPageSuccessProps) => {
  const { t } = useTranslation("productPages");
  const course = getTerminology(ContentTerms.Course, SystemTerms.Course);
  const coursePlural = getTerminologyPlural(ContentTerms.Course, SystemTerms.Course);
  const { selectedPsOptionIds, utmParams, finalPrice, totalPrice } = useProductPageStore();

  const settings: ProductPageSettings = pageData.settings_json
    ? (() => {
        try {
          return JSON.parse(pageData.settings_json);
        } catch {
          return {};
        }
      })()
    : {};

  const redirectUrl = settings.afterPaymentRedirectUrl?.trim() ?? "";
  const showLoginButton = settings.showLoginButton ?? true;
  const successPageContent = settings.successPageContent?.trim() ?? "";

  const enrolledCount = selectedPsOptionIds.length;
  const currency =
    pageData.currency || pageData.mappings[0]?.payment_plan?.currency || "";

  const enrolledMappings = pageData.mappings.filter((m) =>
    selectedPsOptionIds.includes(m.ps_invite_payment_option_id),
  );

  // What was actually PAID, not what each course lists for.
  //
  // This page used to print the payment plan's price beside every course, so a
  // ₹949 four-subject order read "₹349" four times — ₹1,396 of receipts for one
  // ₹949 payment, and no total anywhere to reconcile it against. On a page that
  // prices the basket as a whole (any 3 for ₹799, +₹150 each) the per-course
  // list price is not a figure the parent ever paid, so it is the one number
  // that must NOT appear on a receipt. The order total is; the saving beside it
  // is what makes the smaller figure legible.
  const amountPaid = finalPrice();
  const listTotal = totalPrice();
  const saved = Math.max(0, Math.round(listTotal - amountPaid));
  // Prices are hidden wholesale inside Apple's reader-app builds.
  const showAmount = !shouldHidePaidPurchaseUI() && enrolledMappings.length > 0;

  /** "1 year access" / "6 months access" / "45 days access"; "" when unset. */
  const accessLabel = (days?: number): string => {
    if (!days || days <= 0) return "";
    if (days === 365) return t("success.access.oneYear");
    if (days % 30 === 0) return t("success.access.months", { count: days / 30 });
    return t("success.access.days", { count: days });
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (window.parent && window.parent !== window) {
      const payload = {
        type: "PAYMENT_SUCCESS",
        event: "payment_success",
        status: "success",
        utm: utmParams,
      };
      PAYMENT_SUCCESS_TARGET_ORIGINS.forEach((origin) => {
        try {
          window.parent.postMessage(payload, origin);
        } catch {
          // Ignore — postMessage to a non-matching origin is a no-op,
          // and we don't want a single bad origin to block the others.
        }
      });
    }
  }, [utmParams]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      {/* Success icon */}
      <div className="mb-6 flex size-20 items-center justify-center rounded-3xl bg-green-100">
        <CheckCircle className="size-10 text-green-600" />
      </div>

      <h1 className="text-2xl font-bold text-gray-900">{t("success.title")}</h1>

      {/* Custom or default content */}
      {successPageContent ? (
        <div
          className="mt-3 max-w-sm text-center text-sm text-gray-500"
          dangerouslySetInnerHTML={{ __html: successPageContent }}
        />
      ) : (
        <p className="mt-2 max-w-sm text-center text-sm text-gray-500">
          {t("success.defaultMessage", {
            count: enrolledCount,
            course: (enrolledCount === 1 ? course : coursePlural).toLocaleLowerCase(),
          })}
        </p>
      )}

      {/* Enrolled course list */}
      <div className="mt-8 w-full max-w-sm space-y-2">
        {enrolledMappings.map((m) => {
          // The COURSE's name, not the plan's. Every course on a basket-priced
          // page shares one plan ("Per Subject"), so a receipt built from the
          // plan name lists the same row four times and cannot be checked
          // against what was actually bought. itemSubject is the same label the
          // cart showed two screens earlier, so the two agree.
          //
          // Class and session sit on the meta line because a parent buying for
          // two children needs to see WHICH child each row is for; the plan's
          // validity joins them rather than owning a line of its own.
          const meta = [m.level_name, m.session_name, accessLabel(m.payment_plan?.validity_in_days)]
            .filter(Boolean)
            .join(" · ");
          return (
            <div
              key={m.ps_invite_payment_option_id}
              className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm"
            >
              <CheckCircle className="size-4 shrink-0 text-green-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{itemSubject(m, course)}</p>
                {meta && <p className="mt-0.5 text-xs text-gray-400">{meta}</p>}
              </div>
            </div>
          );
        })}

        {showAmount && (
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-gray-900">
                {t("success.totalPaid")}
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {formatPriceAmount(amountPaid, currency)}
              </span>
            </div>
            {saved > 0 && (
              <p className="mt-1 text-xs text-green-600">
                {t("success.youSaved", {
                  amount: formatPriceAmount(saved, currency),
                })}
              </p>
            )}
          </div>
        )}
      </div>

      {showLoginButton && (
        <a
          href="/dashboard"
          className="mt-8 flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <BookOpen className="size-4" />
          {t("success.goToMyCourses", { courses: coursePlural })}
          <ArrowRight className="size-4" />
        </a>
      )}
    </div>
  );
};
