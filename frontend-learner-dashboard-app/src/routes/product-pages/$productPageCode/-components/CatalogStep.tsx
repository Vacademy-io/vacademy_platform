import { useState } from "react";
import { useProductPageStore } from "../-stores/product-page-store";
import { pushCourseSelectionChanged } from "@/components/common/enroll-by-invite/-utils/gtm";
import type {
  ProductPageData,
  ProductPageSettings,
  PageJson,
  ProductPageMappingResponse,
} from "../-types/product-page-types";
import { ShoppingCart, CheckCircle, SlidersHorizontal, X } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PageRenderer } from "./PageRenderer";

interface CatalogStepProps {
  pageData: ProductPageData;
  settings: ProductPageSettings;
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

function getDisplayParts(mapping: ProductPageMappingResponse) {
  if (mapping.package_name) {
    return {
      title: mapping.package_name,
      subtitle: [mapping.level_name, mapping.session_name]
        .filter(Boolean)
        .join(" · "),
    };
  }
  return {
    title: mapping.payment_plan?.name || `Course ${mapping.display_order + 1}`,
    subtitle: "",
  };
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function colorLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function getThumbnailStyle(primaryColor: string, selected: boolean) {
  const lum =
    primaryColor.startsWith("#") && primaryColor.length === 7
      ? colorLuminance(primaryColor)
      : 0.5;
  const isDark = lum < 0.25;
  if (isDark) {
    return {
      bg: selected ? "#1e293b" : "#f1f5f9", // design-lint-ignore: page-builder default color
      text: selected ? "#e2e8f0" : "#334155", // design-lint-ignore: page-builder default color
    };
  }
  return {
    bg: selected ? primaryColor : `${primaryColor}22`,
    text: selected ? "white" : primaryColor,
  };
}

// ─── Course Detail Dialog ─────────────────────────────────────────────────────

const CourseDetailDialog = ({
  mapping,
  selected,
  canDeselect,
  currency,
  primaryColor,
  onToggle,
  onClose,
}: {
  mapping: ProductPageMappingResponse;
  selected: boolean;
  canDeselect: boolean;
  currency: string;
  primaryColor: string;
  onToggle: () => void;
  onClose: () => void;
}) => {
  const { title, subtitle } = getDisplayParts(mapping);
  const plan = mapping.payment_plan;
  const isFree = !plan?.actual_price || plan.actual_price === 0;
  let features: string[] = [];
  try {
    if (plan?.feature_json) {
      const parsed = JSON.parse(plan.feature_json);
      if (Array.isArray(parsed))
        features = parsed.filter((f: unknown): f is string => typeof f === "string" && f.length > 0);
    }
  } catch { /* ignore */ }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-h-screen-85 overflow-y-auto rounded-t-2xl bg-white sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-100 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-bold leading-tight text-gray-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 mt-0.5 text-gray-400 hover:text-gray-600"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {mapping.level_name && (
            <span className="inline-block rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {mapping.level_name}
            </span>
          )}

          <div>
            {isFree ? (
              <span className="text-2xl font-bold text-green-600">Free</span>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold" style={{ color: primaryColor }}>
                  {currency} {plan!.actual_price.toLocaleString()}
                </span>
                {plan!.elevated_price > plan!.actual_price && (
                  <span className="text-base text-gray-400 line-through">
                    {currency} {plan!.elevated_price.toLocaleString()}
                  </span>
                )}
              </div>
            )}
            {plan?.validity_in_days > 0 && (
              <p className="mt-1 text-sm text-gray-500">
                Valid for{" "}
                {plan.validity_in_days === 365
                  ? "1 year"
                  : plan.validity_in_days % 30 === 0
                    ? `${plan.validity_in_days / 30} months`
                    : `${plan.validity_in_days} days`}
              </p>
            )}
          </div>

          {plan?.description &&
            plan.description.toLowerCase() !== title.toLowerCase() &&
            plan.description.length > 4 && (
              <div>
                <h3 className="mb-1 text-sm font-semibold text-gray-700">About</h3>
                <p className="text-sm leading-relaxed text-gray-600">{plan.description}</p>
              </div>
            )}

          {features.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">What's included</h3>
              <ul className="space-y-1.5">
                {features.map((feat, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <CheckCircle className="mt-0.5 size-4 shrink-0 text-green-500" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-gray-100 bg-white p-5">
          {selected ? (
            <button
              type="button"
              onClick={() => { if (canDeselect) { onToggle(); onClose(); } }}
              disabled={!canDeselect}
              className="w-full rounded-xl border border-red-300 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Remove from Cart
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { onToggle(); onClose(); }}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
            >
              Add to Cart
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Course Card Item ─────────────────────────────────────────────────────────

const CourseCardItem = ({
  mapping,
  selected,
  settings,
  currency,
  primaryColor,
  onToggle,
}: {
  mapping: ProductPageMappingResponse;
  selected: boolean;
  settings: ProductPageSettings;
  currency: string;
  primaryColor: string;
  onToggle: () => void;
}) => {
  const [showDetail, setShowDetail] = useState(false);
  const { title, subtitle } = getDisplayParts(mapping);
  const plan = mapping.payment_plan;
  const isFree = !plan?.actual_price || plan.actual_price === 0;
  const initials = getInitials(title);
  const thumbStyle = getThumbnailStyle(primaryColor, selected);
  const descriptionText = plan?.description?.trim();
  const showDescription =
    !!descriptionText &&
    descriptionText.toLowerCase() !== title.toLowerCase() &&
    descriptionText.length > 4;

  return (
    <>
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-xl border bg-white transition-all duration-200 hover:shadow-md",
          selected ? "border-blue-400 shadow-sm" : "border-gray-200 hover:border-gray-300",
        )}
      >
        <div
          className="flex h-32 items-center justify-center"
          style={{ backgroundColor: thumbStyle.bg }}
        >
          <span className="text-4xl font-bold tracking-tight" style={{ color: thumbStyle.text }}>
            {initials}
          </span>
        </div>

        <div className="flex flex-1 flex-col p-4">
          {mapping.level_name && (
            <span className="mb-2 inline-block self-start rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {mapping.level_name}
            </span>
          )}

          <h3 className="mb-1 line-clamp-2 text-sm font-semibold leading-snug text-gray-900">
            {title}
          </h3>

          {subtitle && (
            <p className="mb-2 line-clamp-1 text-xs text-gray-500">{subtitle}</p>
          )}

          {showDescription && (
            <p className="mb-2 line-clamp-2 flex-1 text-xs leading-relaxed text-gray-500">
              {descriptionText}
            </p>
          )}

          {plan?.validity_in_days > 0 && (
            <p className="mb-2 text-xs text-gray-400">
              {plan.validity_in_days === 365
                ? "1 year access"
                : plan.validity_in_days % 30 === 0
                  ? `${plan.validity_in_days / 30} months access`
                  : `${plan.validity_in_days} days access`}
            </p>
          )}

          <div className="mb-4 mt-1">
            {isFree ? (
              <Badge variant="outline" className="border-green-200 bg-green-50 text-xs font-semibold text-green-700">
                Free
              </Badge>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-base font-bold" style={{ color: primaryColor }}>
                  {currency} {plan!.actual_price.toLocaleString()}
                </span>
                {plan!.elevated_price > plan!.actual_price && (
                  <span className="text-sm text-gray-400 line-through">
                    {currency} {plan!.elevated_price.toLocaleString()}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="mt-auto flex gap-2">
            <button
              type="button"
              onClick={() => setShowDetail(true)}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
            >
              View
            </button>
            {selected ? (
              <button
                type="button"
                onClick={() => { if (settings.allowCourseDeselection) onToggle(); }}
                disabled={!settings.allowCourseDeselection}
                className="flex-1 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove
              </button>
            ) : (
              <button
                type="button"
                onClick={onToggle}
                className="flex-1 rounded-lg px-3 py-2 text-xs font-medium text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                Add
              </button>
            )}
          </div>
        </div>
      </div>

      {showDetail && (
        <CourseDetailDialog
          mapping={mapping}
          selected={selected}
          canDeselect={settings.allowCourseDeselection}
          currency={currency}
          primaryColor={primaryColor}
          onToggle={onToggle}
          onClose={() => setShowDetail(false)}
        />
      )}
    </>
  );
};

export const CatalogStep = ({
  pageData,
  settings,
  onNext,
}: CatalogStepProps) => {
  const { selectedPsOptionIds, toggleSelection, totalPrice } =
    useProductPageStore();
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>(
    {},
  );

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
        onNext={onNext}
      />
    );
  }

  // ── Fallback: full-width catalog ──────────────────────────────────────────
  const activeMappings = pageData.mappings.filter((m) => m.status === "ACTIVE");
  const currency =
    pageData.currency || activeMappings[0]?.payment_plan?.currency || "";
  const primaryColor = pageJson.globalSettings?.primaryColor || "#4F46E5"; // design-lint-ignore: page-builder default color

  // Auto-derive filter dimensions
  const autoFilterDimensions: { key: string; label: string }[] = [];
  if (activeMappings.length > 1) {
    const levels = [
      ...new Set(
        activeMappings.map((m) => m.level_name).filter(Boolean) as string[],
      ),
    ];
    const sessions = [
      ...new Set(
        activeMappings.map((m) => m.session_name).filter(Boolean) as string[],
      ),
    ];
    if (levels.length > 1)
      autoFilterDimensions.push({ key: "level", label: "Level" });
    if (sessions.length > 1)
      autoFilterDimensions.push({ key: "session", label: "Batch" });
  }

  const onFilterChange = (key: string, value: string) =>
    setActiveFilters((prev) => ({ ...prev, [key]: value }));

  const filteredMappings = activeMappings.filter((m) => {
    for (const [key, val] of Object.entries(activeFilters)) {
      if (!val) continue;
      if (key === "level" && m.level_name !== val) return false;
      if (key === "session" && m.session_name !== val) return false;
    }
    return true;
  });

  const handleToggle = (psOptionId: string) => {
    toggleSelection(psOptionId);
    const newCount = selectedPsOptionIds.includes(psOptionId)
      ? selectedPsOptionIds.length - 1
      : selectedPsOptionIds.length + 1;
    pushCourseSelectionChanged(newCount, totalPrice());
  };

  const price = totalPrice();
  const count = selectedPsOptionIds.length;

  return (
    <div className="min-h-screen bg-white">
      {/* Page title */}
      <div className="border-b border-gray-100 px-6 py-8 lg:px-8">
        <div className="mx-auto max-w-screen-2xl">
          <h1 className="text-3xl font-bold leading-tight text-gray-900 md:text-4xl">
            {pageData.name}
          </h1>
          {activeMappings.length > 1 && (
            <p className="mt-2 text-sm text-gray-500">
              Select the courses you'd like to enroll in
            </p>
          )}
        </div>
      </div>

      {/* Auto filter bar */}
      {autoFilterDimensions.length > 0 && (
        <div className="border-b border-gray-100 bg-white px-6 py-3 lg:px-8">
          <div className="mx-auto max-w-screen-2xl">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <SlidersHorizontal className="size-3.5" />
                Filter
              </div>
              {autoFilterDimensions.map((dim) => {
                const values = [
                  ...new Set(
                    activeMappings
                      .map((m) =>
                        dim.key === "level" ? m.level_name : m.session_name,
                      )
                      .filter(Boolean) as string[],
                  ),
                ];
                const activeValue = activeFilters[dim.key];
                return (
                  <div
                    key={dim.key}
                    className="flex flex-wrap items-center gap-1.5"
                  >
                    <span className="text-xs text-gray-400">{dim.label}:</span>
                    {values.map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() =>
                          onFilterChange(
                            dim.key,
                            activeValue === val ? "" : val,
                          )
                        }
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          activeValue === val
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                        )}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Course grid */}
      <div className="px-6 py-6 lg:px-8">
        <div className="mx-auto max-w-screen-2xl">
          {filteredMappings.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">
              No courses match the selected filters.
            </p>
          ) : (
            <div
              className={cn(
                "grid gap-4",
                filteredMappings.length === 1
                  ? "max-w-xl grid-cols-1"
                  : filteredMappings.length === 2
                    ? "grid-cols-1 sm:grid-cols-2"
                    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
              )}
            >
              {filteredMappings.map((mapping) => (
                <CourseCardItem
                  key={mapping.ps_invite_payment_option_id}
                  mapping={mapping}
                  selected={selectedPsOptionIds.includes(mapping.ps_invite_payment_option_id)}
                  settings={settings}
                  currency={currency}
                  primaryColor={primaryColor}
                  onToggle={() => handleToggle(mapping.ps_invite_payment_option_id)}
                />
              ))}
            </div>
          )}
        </div>
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
