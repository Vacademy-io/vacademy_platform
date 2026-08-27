import { useMemo } from "react";
import {
  Gift,
  Lock,
  ShoppingCartSimple,
  Tag,
  X,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useProductPageStore } from "../-stores/product-page-store";
import type {
  ProductPageData,
  ProductPageSettings,
} from "../-types/product-page-types";
import {
  nextCourseCost,
  parseBasketPricing,
  savingsVsSingles,
} from "../-utils/basket-pricing";
import { offerStatuses, parseOffers } from "../-utils/offers";
import {
  AVATAR_TINTS,
  currencySymbolFor,
  getInitials,
  itemTitle,
} from "../-utils/cart-item-display";

/**
 * Live order summary that travels with the visitor across every checkout step
 * (see CheckoutLayout). Read-only apart from item removal — every number here
 * is derived from the payment plans configured on the product page, never from
 * a client-side pricing rule, so what the visitor sees is what the enroll call
 * bills against.
 */

interface OrderSummaryPanelProps {
  pageData: ProductPageData;
  settings: ProductPageSettings;
  /** Sticks to the viewport on desktop. Off for the stacked mobile copy. */
  sticky?: boolean;
  /**
   * 'full' lists the items too — the right rail on steps where the cart is not
   * otherwise on screen. 'totals' drops the list and the offer cards, for the
   * cart step, whose wide column already shows both. Two editable copies of the
   * same cart on one screen is a bug report waiting to happen.
   */
  variant?: "full" | "totals";
  className?: string;
}

export const OrderSummaryPanel = ({
  pageData,
  settings,
  sticky = false,
  variant = "full",
  className,
}: OrderSummaryPanelProps) => {
  const {
    selectedPsOptionIds,
    setSelection,
    couponCode,
    discountAmount,
    totalPrice,
    finalPrice,
    basketQuote,
    appliedOffer,
  } = useProductPageStore();

  const items = useMemo(
    () =>
      pageData.mappings.filter((m) =>
        selectedPsOptionIds.includes(m.ps_invite_payment_option_id),
      ),
    [pageData.mappings, selectedPsOptionIds],
  );

  const currency =
    pageData.currency || items[0]?.payment_plan?.currency || "INR";
  const symbol = currencySymbolFor(currency);
  const money = (n: number) => `${symbol}${n.toLocaleString("en-IN")}`;

  // The plan's own list price (elevated_price) is what the saving is measured
  // against. Plans that never set one price at list, so max() keeps the saving
  // at zero rather than going negative.
  const listTotal = items.reduce((sum, m) => {
    const plan = m.payment_plan;
    return sum + Math.max(plan?.elevated_price ?? 0, plan?.actual_price ?? 0);
  }, 0);

  const subtotal = totalPrice();
  const planSavings = Math.max(0, listTotal - subtotal);
  const total = finalPrice();

  // A whole-basket price, on pages that sell "any 3 for ₹799" rather than
  // pricing each course. When present it replaces the item subtotal entirely —
  // those courses are individually free, so a subtotal of ₹0 would be a lie.
  const quote = basketQuote();
  const basketSettings = parseBasketPricing(pageData.settings_json);
  const perNext = nextCourseCost(basketSettings, quote);
  // More than one group means the ladder ran per class — say so, or "1 subject
  // ₹349" twice over just looks like the discount failed to apply.
  const pricedPerGroup = (quote?.lines.length ?? 0) > 1;
  // Under basket pricing the courses have no individual price, so the only
  // honest saving is against the ladder's own one-subject rate — which is the
  // number the price card itself advertises.
  const saved = quote ? savingsVsSingles(basketSettings, quote) : planSavings;

  // Predefined page offers. Shown as a list rather than applied silently: an
  // offer the visitor never knew they nearly had grows no basket.
  const offer = appliedOffer();
  const beforeOffer = quote ? quote.total : subtotal;
  const offers = offerStatuses(
    parseOffers(pageData.settings_json),
    beforeOffer,
    items.length
  );

  const canRemove = settings.allowCourseDeselection !== false;

  const removeItem = (id: string) =>
    setSelection(selectedPsOptionIds.filter((sid) => sid !== id));

  return (
    <div
      /* Scroll target for the mobile action bar. The desktop aside renders a
         second copy of this panel, so only the non-sticky one claims the id. */
      id={sticky ? undefined : "order-summary"}
      className={cn(
        "overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm",
        sticky && "lg:sticky lg:top-6",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <ShoppingCartSimple className="size-4 shrink-0 text-gray-500" aria-hidden="true" />
          <h2 className="truncate text-sm font-bold text-gray-900">
            Order Summary
          </h2>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-caption font-semibold text-gray-600 ring-1 ring-gray-200">
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-gray-100">
            <ShoppingCartSimple className="size-5 text-gray-400" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-gray-700">Your cart is empty</p>
          <p className="mt-1 text-caption text-gray-400">
            Pick a course to see your total here.
          </p>
        </div>
      ) : (
        <>
          {/* Items — only when this panel is the cart's only appearance. */}
          {variant === "full" && (
          <>
          <div className="flex items-center justify-between px-5 pb-1 pt-4">
            <span className="text-caption font-semibold uppercase tracking-wide text-gray-400">
              Selected
            </span>
            {canRemove && items.length > 1 && (
              <button
                type="button"
                onClick={() => setSelection([])}
                className="text-caption font-semibold text-danger-600 transition-opacity hover:opacity-80"
              >
                Remove all
              </button>
            )}
          </div>

          <ul className="px-2 pb-2">
            {items.map((mapping, idx) => {
              const plan = mapping.payment_plan;
              const price = plan?.actual_price ?? 0;
              const title = itemTitle(mapping);
              return (
                <li
                  key={mapping.ps_invite_payment_option_id}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 transition-colors hover:bg-gray-50"
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-caption font-bold",
                      AVATAR_TINTS[idx % AVATAR_TINTS.length],
                    )}
                    aria-hidden="true"
                  >
                    {getInitials(title)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-caption font-semibold text-gray-900">
                      {title}
                    </p>
                    {plan?.name && (
                      <p className="truncate text-2xs text-gray-400">{plan.name}</p>
                    )}
                  </div>

                  <span className="shrink-0 text-caption font-semibold text-gray-900">
                    {price > 0 ? money(price) : "Free"}
                  </span>

                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => removeItem(mapping.ps_invite_payment_option_id)}
                      className="flex size-5 shrink-0 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-danger-50 hover:text-danger-600"
                      aria-label={`Remove ${title}`}
                      title={`Remove ${title}`}
                    >
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          </>
          )}

          {/* Savings callout — only when there is a real saving to show */}
          {saved > 0 && (
            <div
              className={cn(
                "mx-5 mb-4 flex items-start gap-2.5 rounded-xl border border-success-200 bg-success-50 px-3.5 py-3",
                variant === "totals" && "mt-4",
              )}
            >
              <Gift className="mt-0.5 size-4 shrink-0 text-success-600" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-caption font-bold text-success-700">
                  You saved {money(saved)}
                </p>
                <p className="mt-0.5 text-caption text-success-600">
                  {quote
                    ? "Against buying each subject on its own."
                    : "Applied from your selected plan pricing."}
                </p>
              </div>
            </div>
          )}

          {/* Offers — what is on, and what one more step would unlock. */}
          {variant === "full" && offers.length > 0 && (
            <div className="mx-5 mb-4 space-y-1.5 rounded-xl border border-dashed border-primary-200 bg-primary-50/50 p-3">
              <p className="text-2xs font-bold uppercase tracking-wide text-primary-500">
                Offers
              </p>
              {offers.map((o) => (
                <div key={o.rule.id} className="flex items-start gap-1.5 text-2xs">
                  <Tag
                    className={cn(
                      "mt-px size-3.5 shrink-0",
                      o.applied ? "text-success-600" : "text-gray-400"
                    )}
                    weight={o.applied ? "fill" : "regular"}
                    aria-hidden="true"
                  />
                  <span
                    className={cn(
                      "min-w-0",
                      o.applied
                        ? "font-semibold text-success-700"
                        : o.unlocked
                          ? "text-gray-500"
                          : "text-gray-400"
                    )}
                  >
                    {o.rule.label}
                    {o.applied && " · applied"}
                    {/* Name the exact gap. "Spend more to save more" is not an
                        instruction anyone can act on. */}
                    {!o.unlocked && o.amountShort > 0 && (
                      <> · add {money(o.amountShort)} more</>
                    )}
                    {!o.unlocked && o.amountShort === 0 && o.coursesShort > 0 && (
                      <>
                        {" "}
                        · add {o.coursesShort} more course
                        {o.coursesShort === 1 ? "" : "s"}
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Totals */}
          <div className="space-y-2 border-t border-gray-100 px-5 py-4">
            {quote ? (
              /* One line per group, because a basket spanning two children is
                 priced per child — a single "subtotal" would hide that. */
              quote.lines.map((line, i) => (
                <div
                  key={`${line.label}-${i}`}
                  className="flex justify-between text-caption text-gray-500"
                >
                  <span className="truncate">
                    {line.label}
                    <span className="text-gray-400"> · {line.how}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">{money(line.amount)}</span>
                </div>
              ))
            ) : (
              <div className="flex justify-between text-caption text-gray-500">
                <span>
                  Subtotal ({items.length} item{items.length === 1 ? "" : "s"})
                </span>
                <span className="tabular-nums">{money(listTotal)}</span>
              </div>
            )}

            {!quote && planSavings > 0 && (
              <div className="flex justify-between text-caption font-medium text-success-600">
                <span>Plan savings</span>
                <span className="tabular-nums">− {money(planSavings)}</span>
              </div>
            )}

            {offer && (
              <div className="flex justify-between text-caption font-medium text-success-600">
                <span className="truncate">{offer.rule.label}</span>
                <span className="shrink-0 tabular-nums">− {money(offer.amount)}</span>
              </div>
            )}

            {discountAmount > 0 && (
              <div className="flex justify-between text-caption font-medium text-success-600">
                <span className="truncate">
                  Coupon{couponCode ? ` (${couponCode})` : ""}
                </span>
                <span className="shrink-0 tabular-nums">− {money(discountAmount)}</span>
              </div>
            )}

            {/* What one more actually costs. On a ladder the next subject is
                usually cheaper than the last, which IS the offer — vaguer
                wording ("save more!") tells the parent nothing they can act on. */}
            {variant === "full" && pricedPerGroup && (
              <p className="text-caption text-gray-500">
                Each class is priced on its own, so subjects for different children
                don&apos;t combine.
              </p>
            )}

            {variant === "full" && quote && perNext !== null && perNext.amount > 0 && items.length > 0 && (
              <div className="flex items-start gap-1.5 rounded-lg bg-primary-50 px-3 py-2 text-caption font-medium text-primary-500">
                <Gift className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {perNext.group
                    ? `Add another ${perNext.group} subject for ${money(perNext.amount)}.`
                    : `Add one more subject for ${money(perNext.amount)}.`}
                </span>
              </div>
            )}
          </div>

          {/* Total payable */}
          <div className="border-t border-dashed border-gray-200 px-5 py-4">
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-gray-900">Total Payable</p>
                <p className="text-caption text-gray-500">Inclusive of all taxes</p>
              </div>
              <span className="text-h3-semibold font-bold tabular-nums text-gray-900">
                {total > 0 ? money(total) : "Free"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 border-t border-gray-100 bg-gray-50 px-5 py-3">
            <Lock className="size-3 text-gray-400" aria-hidden="true" />
            <span className="text-caption font-medium text-gray-500">
              100% secure payment
            </span>
          </div>
        </>
      )}
    </div>
  );
};
