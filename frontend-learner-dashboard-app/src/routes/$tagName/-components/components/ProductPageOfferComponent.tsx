import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock } from "@phosphor-icons/react";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { PriceWithMrp } from "@/components/common/price-with-mrp";
import { CatalogueLink } from "../CatalogueLink";
import { handleGetProductPage } from "@/routes/product-pages/$productPageCode/-services/product-page-service";

/**
 * Product Page Offer — surfaces a Product Page's sellable courses on a
 * catalogue (marketing) page, with a direct route into checkout.
 *
 * WHY IT READS LIVE: a Product Page `update` soft-deletes and re-inserts ALL
 * of its invite mappings (no diffing), so any course list cached in this
 * component's props would silently go stale the moment an admin re-saves the
 * page. We only persist the page CODE and fetch the courses at render time.
 *
 * The endpoint is the anonymous `open/v1/product-page/by-code`, so this works
 * for logged-out visitors — which is the whole point of a marketing page.
 */

interface ProductPageMapping {
  id: string;
  ps_invite_payment_option_id: string;
  package_session_id: string;
  package_name?: string;
  level_name?: string;
  session_name?: string;
  course_preview_image_media_id?: string;
  about_the_course_html?: string;
  display_order?: number;
  status?: string;
  payment_plan?: {
    actual_price?: number;
    elevated_price?: number;
    currency?: string;
    validity_in_days?: number;
  } | null;
}

interface ProductPageOfferProps {
  productPageCode?: string;
  title?: string;
  subtitle?: string;
  columns?: number;
  ctaLabel?: string;
  showImage?: boolean;
  showChips?: boolean;
  showDescription?: boolean;
  showValidity?: boolean;
  showPrice?: boolean;
  backgroundColor?: string;
  instituteId?: string;
  /** Admin canvas passes this so the section always renders something. */
  isPreviewMode?: boolean;
}

/** Strips HTML and clamps the course blurb to a card-sized teaser. */
const toPlainText = (html?: string, max = 160): string => {
  if (!html) return "";
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
};

/** "12 months access" / "90 days access" from the plan's validity. */
const formatValidity = (days?: number): string => {
  if (!days || days <= 0) return "";
  if (days % 365 === 0) {
    const y = days / 365;
    return `${y} year${y > 1 ? "s" : ""} access`;
  }
  if (days >= 60 && days % 30 === 0) {
    const m = days / 30;
    return `${m} month${m > 1 ? "s" : ""} access`;
  }
  return `${days} days access`;
};

const CourseImage: React.FC<{ mediaId?: string; alt: string }> = ({ mediaId, alt }) => {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!mediaId) return;
    if (mediaId.startsWith("http")) {
      setUrl(mediaId);
      return;
    }
    getPublicUrlWithoutLogin(mediaId)
      .then((u) => { if (alive && u) setUrl(u); })
      .catch(() => { /* placeholder below covers it */ });
    return () => { alive = false; };
  }, [mediaId]);

  // Reserve the band either way so cards don't reflow when images resolve.
  return (
    <div className="catalogue-img-zoom aspect-[16/9] w-full overflow-hidden rounded-catalogue-lg bg-catalogue-bg-muted">
      {url && !failed && (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
};

export const ProductPageOfferComponent: React.FC<ProductPageOfferProps> = ({
  productPageCode,
  title,
  subtitle,
  columns = 3,
  ctaLabel,
  showImage = true,
  showChips = true,
  showDescription = true,
  showValidity = true,
  showPrice = true,
  backgroundColor,
  instituteId,
  isPreviewMode = false,
}) => {
  const { data, isLoading, isError } = useQuery({
    ...handleGetProductPage(productPageCode || "", instituteId || ""),
  });

  const cols = Math.min(Math.max(Number(columns) || 3, 1), 4);
  const gridCols =
    `grid gap-6 grid-cols-1 sm:grid-cols-2 ${cols >= 3 ? "lg:grid-cols-3" : ""} ${cols >= 4 ? "xl:grid-cols-4" : ""}`;

  const header = (
    <>
      {title && <h2 className="catalogue-h2 text-catalogue-text-primary">{title}</h2>}
      {subtitle && (
        <p className="catalogue-lead catalogue-measure text-catalogue-text-muted">{subtitle}</p>
      )}
    </>
  );

  const section = (children: React.ReactNode) => (
    <section
      className="catalogue-section bg-catalogue-bg"
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      <div className="catalogue-shell">
        {(title || subtitle) && (
          <div className="catalogue-section-header text-center">{header}</div>
        )}
        {children}
      </div>
    </section>
  );

  // ── Not configured yet: guide the admin, stay invisible to visitors ──
  if (!productPageCode) {
    if (!isPreviewMode) return null;
    return section(
      <div className="catalogue-card rounded-catalogue-lg border border-dashed border-catalogue-border p-8 text-center text-sm text-catalogue-text-muted">
        Pick a product page in the properties panel to show its courses here.
      </div>
    );
  }

  if (isLoading) {
    return section(
      <div className={gridCols} aria-busy="true">
        {Array.from({ length: cols }, (_, i) => (
          <div key={i} className="catalogue-card-elevated p-5">
            {showImage && <div className="catalogue-skeleton-shimmer mb-4 aspect-[16/9] w-full rounded-catalogue-lg" />}
            <div className="catalogue-skeleton-shimmer mb-2 h-5 w-3/4 rounded" />
            <div className="catalogue-skeleton-shimmer mb-4 h-4 w-full rounded" />
            <div className="catalogue-skeleton-shimmer h-9 w-full rounded-catalogue-md" />
          </div>
        ))}
      </div>
    );
  }

  const mappings: ProductPageMapping[] = ((data?.mappings as unknown as ProductPageMapping[]) || [])
    .filter((m) => (m.status ?? "ACTIVE") === "ACTIVE")
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  // A marketing page should never show a broken or empty band to a visitor.
  if (isError || mappings.length === 0) {
    if (!isPreviewMode) return null;
    return section(
      <div className="catalogue-card rounded-catalogue-lg border border-dashed border-catalogue-border p-8 text-center text-sm text-catalogue-text-muted">
        {isError
          ? "Couldn't load this product page. Check that it is ACTIVE and belongs to this institute."
          : "This product page has no courses yet — add them in its Courses tab."}
      </div>
    );
  }

  return section(
    <div className={gridCols}>
      {mappings.map((m, i) => {
        const name = m.package_name || "Course";
        const chips = [m.level_name, m.session_name].filter(Boolean) as string[];
        const blurb = showDescription ? toPlainText(m.about_the_course_html) : "";
        const validity = showValidity ? formatValidity(m.payment_plan?.validity_in_days) : "";
        // package_session_id is the canonical form the funnel matches first;
        // defaultTab=CART drops the visitor straight into checkout with this
        // course already selected.
        const href =
          `/product-pages/${productPageCode}?instituteId=${encodeURIComponent(instituteId || "")}` +
          `&courseIds=${encodeURIComponent(m.package_session_id)}&defaultTab=CART`;

        return (
          <CatalogueLink
            key={m.id || i}
            to={href}
            data-stagger-item
            style={{ ["--stagger-i" as string]: i } as React.CSSProperties}
            className="catalogue-card-elevated group flex flex-col p-5 text-start no-underline"
          >
            {showImage && <CourseImage mediaId={m.course_preview_image_media_id} alt={name} />}
            <div className={showImage ? "mt-4 flex flex-1 flex-col" : "flex flex-1 flex-col"}>
              {showChips && chips.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {chips.map((c, j) => (
                    <span
                      key={j}
                      className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-catalogue-brand-ink ring-1 ring-primary-100"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
              <h3 className="catalogue-h3 mb-2 text-catalogue-text-primary">{name}</h3>
              {blurb && (
                <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-catalogue-text-secondary">
                  {blurb}
                </p>
              )}
              {validity && (
                <p className="mb-3 inline-flex items-center gap-1.5 text-xs text-catalogue-text-muted">
                  <Clock size={14} aria-hidden="true" /> {validity}
                </p>
              )}
              {/* Price and CTA pinned to the bottom so ragged card bodies
                  still line up across the row. */}
              <div className="mt-auto space-y-3 pt-1">
                {showPrice && (
                  <PriceWithMrp
                    actual={m.payment_plan?.actual_price}
                    elevated={m.payment_plan?.elevated_price}
                    currency={m.payment_plan?.currency}
                    size="md"
                  />
                )}
                <span className="catalogue-btn catalogue-btn-primary w-full justify-center">
                  {ctaLabel || "Enrol now"}
                  <ArrowRight size={15} weight="bold" aria-hidden="true" />
                </span>
              </div>
            </div>
          </CatalogueLink>
        );
      })}
    </div>
  );
};

export default ProductPageOfferComponent;
