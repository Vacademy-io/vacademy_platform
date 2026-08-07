import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  CaretLeft,
  CaretRight,
  Clock,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { PriceWithMrp } from "@/components/common/price-with-mrp";
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
 *
 * WHY NOT CatalogueLink: that component is for catalogue *page slugs* — it
 * lowercases the route and prefixes the current `$tagName`, which turned
 * `/product-pages/x?instituteId=…` into `/book-store/product-pages/x?instituteid=…`
 * (404, plus search params the product-page route could no longer read). Product
 * pages are a top-level app route, so we link to them with the typed router
 * Link and let it serialise the search params with their exact casing.
 */

interface ProductPageMapping {
  id: string;
  ps_invite_payment_option_id: string;
  package_session_id: string;
  /** Package (course) id — the details page's route param. */
  package_id?: string;
  enroll_invite_id?: string;
  package_name?: string;
  level_name?: string;
  session_name?: string;
  course_preview_image_media_id?: string;
  about_the_course_html?: string;
  /** Comma-separated course tags (CBSE, ICSE, …). */
  tags?: string;
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
  /** 'grid' wraps onto rows; 'carousel' is a single swipeable horizontal row. */
  layout?: "grid" | "carousel";
  /** Section header alignment. 'left' reads as an app-style rail heading. */
  align?: "center" | "left";
  /** 'md' is the compact app-style header; 'lg' the full marketing header. */
  headerScale?: "md" | "lg";
  /** "See all" link in the header, straight to the product page itself. */
  showViewAll?: boolean;
  viewAllLabel?: string;
  ctaLabel?: string;
  /**
   * Second CTA that opens the course's catalogue details page instead of
   * dropping straight into checkout. Needs the mapping's package id, so it
   * silently degrades to the single enrol CTA when the backend has none.
   */
  showViewCourse?: boolean;
  viewCourseLabel?: string;
  showImage?: boolean;
  showChips?: boolean;
  showDescription?: boolean;
  showValidity?: boolean;
  showPrice?: boolean;
  /** Courses per page. 0 (or unset) renders every course with no pager. */
  pageSize?: number;
  /** Search box — auto-hidden when the page has only a handful of courses. */
  showSearch?: boolean;
  /**
   * Cards rendered in a 'carousel' rail before it hands off to the product
   * page. 0 renders every course in one row. Ignored when pageSize is set —
   * that is already an explicit per-page count.
   */
  railMaxCards?: number;
  /** Cap the grid's height and scroll inside it instead of growing the page. */
  scrollable?: boolean;
  scrollMaxHeight?: number;
  backgroundColor?: string;
  instituteId?: string;
  /** Catalogue slug — the details page lives at /{tagName}/{courseId}. */
  tagName?: string;
  /** Admin canvas passes this so the section always renders something. */
  isPreviewMode?: boolean;
}

/** Below this a search box is noise rather than help. */
const SEARCH_MIN_COURSES = 8;

/**
 * Default length of a horizontal rail, overridable per section via the
 * `railMaxCards` prop (0 = no cap). A rail is a browse teaser, not a
 * catalogue: pageSize 0 ("show everything") on a 127-course product page
 * produced a single row of 127 cards.
 */
const DEFAULT_RAIL_MAX_CARDS = 12;

// Backend stores sentinel level/session names ("default", "DEFAULT") on
// packages the admin never levelled — they are placeholders, not information,
// and rendering them as chips reads as broken data. Same rule as the main
// course catalog: hide sentinels, title-case genuine values.
const SENTINEL_CHIP_VALUES = new Set(["default", "none", "null", "undefined", ""]);

const toChipCase = (raw: string): string =>
  raw
    .trim()
    .split(/\s+/)
    .map((w) => (w === w.toUpperCase() && w.length > 3 ? w.charAt(0) + w.slice(1).toLowerCase() : w))
    .join(" ");

const displayChips = (values: (string | undefined)[]): string[] => {
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    const trimmed = v.trim();
    if (SENTINEL_CHIP_VALUES.has(trimmed.toLowerCase())) continue;
    const label = toChipCase(trimmed);
    if (!out.some((c) => c.toLowerCase() === label.toLowerCase())) out.push(label);
  }
  return out;
};

/** Tags arrive as one comma-separated string ("cbse, ncert"). */
const splitTags = (raw?: string): string[] =>
  (raw || "").split(",").map((t) => t.trim()).filter(Boolean);

/**
 * Course tags render exactly as the admin authored them — toChipCase is for
 * level/session names (it rewrites "CBSE" to "Cbse", which is wrong for a tag
 * the institute deliberately spelled that way). Level/session keep their
 * existing sentinel + casing treatment; both are deduped case-insensitively.
 */
const mergeChips = (tags: string[], rest: string[]): string[] => {
  const out: string[] = [];
  for (const v of [...tags, ...rest]) {
    const trimmed = (v || "").trim();
    if (!trimmed || SENTINEL_CHIP_VALUES.has(trimmed.toLowerCase())) continue;
    if (!out.some((c) => c.toLowerCase() === trimmed.toLowerCase())) out.push(trimmed);
  }
  return out;
};

/** A card has room for a couple of chips before the row rhythm breaks. */
const CARD_CHIP_LIMIT = 3;

/** "Summer Sprint 2.0 - Class 6" → "SS" — the monogram for imageless tiles. */
const initialsOf = (title: string): string =>
  title
    .trim()
    .split(/\s+/)
    .filter((w) => /^[a-z0-9]/i.test(w))
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("") || "•";

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

/**
 * Branded fallback tile. Most catalogues have no preview image on most
 * courses, and a grid of empty grey rectangles reads as broken — a titled
 * brand-tinted tile reads as designed.
 */
const CoursePlaceholder: React.FC<{ title: string }> = ({ title }) => (
  // Committed brand tint with a MONOGRAM, not the course title: the real title
  // renders directly under the tile, so printing it inside the tile too made
  // every imageless card read its own name twice. A big two-letter monogram
  // gives each tile identity without the echo.
  <div className="relative flex aspect-[2/1] w-full items-center justify-center overflow-hidden rounded-catalogue-lg bg-gradient-to-br from-primary-200 via-primary-100 to-primary-50">
    <span className="catalogue-h2 select-none font-bold tracking-wide-08 text-catalogue-brand-ink opacity-90" aria-hidden="true">
      {initialsOf(title)}
    </span>
    <BookOpen
      weight="duotone"
      className="absolute bottom-2.5 right-3 size-4 text-catalogue-brand-ink opacity-60"
      aria-hidden="true"
    />
  </div>
);

/**
 * Band ratio for an upload we have not measured yet — the ratio the admin
 * cropper enforces on course previews, so correctly cropped art never reflows.
 */
const DEFAULT_BAND_RATIO = 2;
/**
 * A wildly off-ratio upload (a portrait phone photo, a long banner strip) would
 * otherwise hand one card a band twice its neighbours' height and wreck the
 * row, so the measured ratio is clamped to what still reads as a card header.
 */
const MIN_BAND_RATIO = 1.4;
const MAX_BAND_RATIO = 3;

const CourseImage: React.FC<{ mediaId?: string; alt: string }> = ({ mediaId, alt }) => {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  // The band takes the artwork's OWN ratio once the file reports it. `cover`
  // into a fixed band cropped the logo and class label off the corners;
  // `contain` kept them but padded the band with dead space, because these
  // tiles carry their own margins. Matching the ratio means the image fills
  // the band edge to edge with nothing cropped and nothing padded — the two
  // fits become identical. Uploads reach us off ratio routinely (bulk create
  // and the course-details editor both skip the 2:1 cropper), so this is
  // measured per image rather than assumed.
  const [bandRatio, setBandRatio] = useState(DEFAULT_BAND_RATIO);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setUrl("");
    setBandRatio(DEFAULT_BAND_RATIO);
    if (!mediaId) return;
    if (mediaId.startsWith("http")) {
      setUrl(mediaId);
      return;
    }
    getPublicUrlWithoutLogin(mediaId)
      .then((u) => { if (alive && u) setUrl(u); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [mediaId]);

  if (!mediaId || failed) return <CoursePlaceholder title={alt} />;

  // Reserve the band either way so cards don't reflow when images resolve.
  return (
    <div
      className="catalogue-img-zoom w-full overflow-hidden rounded-catalogue-lg bg-catalogue-bg-muted"
      // Dynamic: the uploaded artwork's own ratio, known only at load.
      style={{ aspectRatio: bandRatio }}
    >
      {url && (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
            if (!w || !h) return;
            setBandRatio(Math.min(Math.max(w / h, MIN_BAND_RATIO), MAX_BAND_RATIO));
          }}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
};

/** Compact windowed pager: ‹ 1 … 4 5 6 … 20 › */
const buildPageWindow = (current: number, total: number): (number | "gap")[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push("gap");
    out.push(p);
  });
  return out;
};

export const ProductPageOfferComponent: React.FC<ProductPageOfferProps> = ({
  productPageCode,
  title,
  subtitle,
  columns,
  layout = "grid",
  align,
  headerScale,
  showViewAll = false,
  viewAllLabel,
  ctaLabel,
  showViewCourse = true,
  viewCourseLabel,
  showImage = true,
  showChips = true,
  showDescription = true,
  showValidity = true,
  showPrice = true,
  pageSize = 9,
  railMaxCards,
  showSearch = true,
  scrollable = false,
  scrollMaxHeight = 640,
  backgroundColor,
  instituteId,
  tagName,
  isPreviewMode = false,
}) => {
  const { data, isLoading, isError } = useQuery({
    ...handleGetProductPage(productPageCode || "", instituteId || ""),
  });

  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const isCarousel = layout === "carousel";
  // A rail wants denser cards than a grid: default 4-up so a fifth card peeks
  // in from the edge (the browse cue), 3-up for the grid. Explicit props win.
  const cols = Math.min(Math.max(Number(columns) || (isCarousel ? 4 : 3), 1), 4);
  const gridCols =
    `grid gap-6 grid-cols-1 sm:grid-cols-2 ${cols >= 3 ? "lg:grid-cols-3" : ""} ${cols >= 4 ? "xl:grid-cols-4" : ""}`;

  const mappings: ProductPageMapping[] = useMemo(
    () =>
      ((data?.mappings as unknown as ProductPageMapping[]) || [])
        .filter((m) => (m.status ?? "ACTIVE") === "ACTIVE")
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
    [data]
  );

  const searchEnabled = showSearch !== false && mappings.length >= SEARCH_MIN_COURSES;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !searchEnabled) return mappings;
    return mappings.filter((m) =>
      [m.package_name, m.level_name, m.session_name, ...splitTags(m.tags)]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    );
  }, [mappings, query, searchEnabled]);

  // 0/unset means "no pager" — render everything.
  const perPage = Number(pageSize) > 0 ? Math.floor(Number(pageSize)) : filtered.length || 1;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  // Derive rather than sync via an effect: a shrinking result set (search)
  // must not leave the pager parked on a page that no longer exists.
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * perPage;
  const paged = filtered.slice(start, start + perPage);
  // An explicit pageSize is an admin decision — respect it. The cap only
  // applies to an uncapped rail, and the admin can raise it or switch it off
  // (0) per section via railMaxCards.
  const railCap = railMaxCards === undefined ? DEFAULT_RAIL_MAX_CARDS : Math.max(Number(railMaxCards) || 0, 0);
  const railCapped = isCarousel && !(Number(pageSize) > 0) && railCap > 0;
  const visible = railCapped ? paged.slice(0, railCap) : paged;
  const railHidden = paged.length - visible.length;

  const goToPage = (p: number) => {
    setPage(Math.min(Math.max(p, 1), totalPages));
    // Keep the viewer at the start of the list they just paged.
    if (scrollRef.current) scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    if (trackRef.current) trackRef.current.scrollTo({ left: 0, behavior: "smooth" });
  };

  /** Enable each arrow only when there is actually room to travel that way. */
  const syncArrows = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  };

  const scrollByPage = (dir: number) => {
    const el = trackRef.current;
    if (!el) return;
    // Just under a full viewport keeps a sliver of the previous card visible,
    // which is what tells the visitor the row continues.
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  useEffect(() => {
    if (!isCarousel) return;
    syncArrows();
    window.addEventListener("resize", syncArrows);
    return () => window.removeEventListener("resize", syncArrows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCarousel, visible.length, cols]);

  // A horizontal rail IS the app pattern, so unless the admin chose otherwise
  // it gets the app-style header (left, compact) — a big centered heading over
  // an edge-bleeding rail is two design languages in one section.
  const isLeft = align ? align === "left" : isCarousel;
  const compact = headerScale ? headerScale === "md" : isCarousel;

  // Straight to the product page itself — the "there's more here" affordance
  // an app-style rail heading is expected to carry.
  const seeAll =
    showViewAll && productPageCode ? (
      <Link
        to="/product-pages/$productPageCode"
        params={{ productPageCode }}
        search={{ ...(instituteId ? { instituteId } : {}), ...(tagName ? { tagName } : {}) }}
        className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-catalogue-brand-ink no-underline hover:underline"
      >
        {viewAllLabel || "See all"}
        <ArrowRight className="size-3.5" weight="bold" aria-hidden="true" />
      </Link>
    ) : null;

  const titleClass = compact
    ? "catalogue-h3 text-catalogue-text-primary"
    : "catalogue-h2 text-catalogue-text-primary";
  const subtitleClass = compact
    ? "mt-1 text-sm text-catalogue-text-muted"
    : "catalogue-lead text-catalogue-text-muted";

  const header =
    title || subtitle || seeAll ? (
      isLeft ? (
        <div className="catalogue-section-header flex items-end justify-between gap-4 text-start">
          <div className="min-w-0">
            {title && <h2 className={titleClass}>{title}</h2>}
            {subtitle && (
              <p className={`${subtitleClass} catalogue-measure-start`}>{subtitle}</p>
            )}
          </div>
          {seeAll}
        </div>
      ) : (
        <div className="catalogue-section-header text-center">
          {title && <h2 className={titleClass}>{title}</h2>}
          {subtitle && <p className={`${subtitleClass} catalogue-measure`}>{subtitle}</p>}
          {seeAll && <div className="mt-2">{seeAll}</div>}
        </div>
      )
    ) : null;

  const section = (children: React.ReactNode) => (
    <section
      className="catalogue-section bg-catalogue-bg"
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      <div className="catalogue-shell">
        {header}
        {children}
      </div>
    </section>
  );

  const emptyState = (message: string) =>
    section(
      <div className="catalogue-card rounded-catalogue-lg border border-dashed border-catalogue-border p-8 text-center text-sm text-catalogue-text-muted">
        {message}
      </div>
    );

  // ── Not configured yet: guide the admin, stay invisible to visitors ──
  if (!productPageCode) {
    if (!isPreviewMode) return null;
    return emptyState("Pick a product page in the properties panel to show its courses here.");
  }

  if (isLoading) {
    return section(
      <div className={gridCols} aria-busy="true">
        {Array.from({ length: cols }, (_, i) => (
          <div key={i} className="catalogue-card-elevated p-5">
            {showImage && <div className="catalogue-skeleton-shimmer mb-4 aspect-[2/1] w-full rounded-catalogue-lg" />}
            <div className="catalogue-skeleton-shimmer mb-2 h-5 w-3/4 rounded" />
            <div className="catalogue-skeleton-shimmer mb-4 h-4 w-full rounded" />
            <div className="catalogue-skeleton-shimmer h-9 w-full rounded-catalogue-md" />
          </div>
        ))}
      </div>
    );
  }

  // A marketing page should never show a broken or empty band to a visitor.
  if (isError || mappings.length === 0) {
    if (!isPreviewMode) return null;
    return emptyState(
      isError
        ? "Couldn't load this product page. Check that it is ACTIVE and belongs to this institute."
        : "This product page has no courses yet — add them in its Courses tab."
    );
  }

  const renderCard = (m: ProductPageMapping, i: number) => {
        const name = m.package_name || "Course";
        // Course tags (CBSE / ICSE …) read first — they are what a visitor
        // scans for — then the level/session the batch belongs to.
        const chips = showChips
          ? mergeChips(
              splitTags(m.tags),
              displayChips([m.level_name, m.session_name]),
            ).slice(0, CARD_CHIP_LIMIT)
          : [];
        const blurb = showDescription ? toPlainText(m.about_the_course_html) : "";
        const validity = showValidity ? formatValidity(m.payment_plan?.validity_in_days) : "";

        // package_session_id is the canonical form the funnel matches first;
        // defaultTab=CART drops the visitor straight into checkout with this
        // course already selected.
        const enrolSearch = {
          ...(instituteId ? { instituteId } : {}),
          ...(tagName ? { tagName } : {}),
          courseIds: m.package_session_id,
          defaultTab: "CART" as const,
        };

        // The details page carries productPageCode so ITS enrol CTA re-enters
        // this exact checkout instead of the standalone enroll-invite dialog.
        const detailsLink =
          showViewCourse && tagName && m.package_id
            ? {
                to: "/$tagName/$courseId" as const,
                params: { tagName, courseId: m.package_id },
                // Every key the details route validates — its validateSearch
                // returns them all, so a partial object would not typecheck.
                search: {
                  enrollInviteId: m.enroll_invite_id,
                  packageSessionId: m.package_session_id,
                  productPageCode,
                  bannerImage: undefined,
                  level: m.level_name,
                  price: m.payment_plan?.actual_price?.toString(),
                  available_slots: undefined,
                },
              }
            : null;

        return (
          <article
            key={m.id || `${start}-${i}`}
            data-stagger-item
            style={{
              ["--stagger-i" as string]: i,
              // Carousel cards size to show exactly `columns` per view (minus
              // the gap-5 gaps); the min-width below takes over on narrow
              // screens so the row overflows into a swipe instead of crushing
              // the cards.
              ...(isCarousel
                ? { flexBasis: `calc((100% - ${(cols - 1) * 1.25}rem) / ${cols})` }
                : {}),
            } as React.CSSProperties}
            className={
              "catalogue-card-elevated group flex flex-col p-4 text-start" +
              (isCarousel ? " min-w-reg-250 shrink-0 snap-start" : "")
            }
          >
            {/* Image + title are the "browse" affordance: they open the course
                page. The enrol CTA below is the "buy" affordance. Keeping them
                separate is why the card is no longer one big link. */}
            {showImage &&
              (detailsLink ? (
                <Link {...detailsLink} className="no-underline" tabIndex={-1} aria-hidden="true">
                  <CourseImage mediaId={m.course_preview_image_media_id} alt={name} />
                </Link>
              ) : (
                <CourseImage mediaId={m.course_preview_image_media_id} alt={name} />
              ))}
            <div className={showImage ? "mt-3 flex flex-1 flex-col" : "flex flex-1 flex-col"}>
              {showChips && chips.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {chips.map((c, j) => (
                    <span
                      key={j}
                      className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-catalogue-brand-ink ring-1 ring-primary-100"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
              {/* Card-scale type, not a section heading: catalogue-h3 here made
                  every card title read like a page title (the field complaint).
                  Clamped because course names run long ("Chapter 10 | Living
                  Creatures…") and an unclamped title ruins the row rhythm. */}
              <h3 className="mb-1.5 line-clamp-2 text-base font-semibold leading-snug text-catalogue-text-primary">
                {detailsLink ? (
                  <Link
                    {...detailsLink}
                    className="text-catalogue-text-primary no-underline hover:underline"
                  >
                    {name}
                  </Link>
                ) : (
                  name
                )}
              </h3>
              {blurb && (
                <p className="mb-2 line-clamp-2 text-sm leading-relaxed text-catalogue-text-secondary">
                  {blurb}
                </p>
              )}
              {validity && (
                <p className="mb-2 inline-flex items-center gap-1.5 text-xs text-catalogue-text-muted">
                  <Clock className="size-3.5" aria-hidden="true" /> {validity}
                </p>
              )}
              {/* Price and CTAs pinned to the bottom so ragged card bodies
                  still line up across the row. */}
              <div className="mt-auto space-y-2.5 pt-1">
                {showPrice && (
                  <PriceWithMrp
                    actual={m.payment_plan?.actual_price}
                    elevated={m.payment_plan?.elevated_price}
                    currency={m.payment_plan?.currency}
                    size="sm"
                  />
                )}
                {/* No min-width: each button keeps its own text width (they
                    never wrap mid-label), so when both no longer fit — a narrow
                    phone, or a long custom label — the row wraps and they stack
                    full-width instead of squashing. */}
                <div className={detailsLink ? "flex flex-wrap gap-2" : ""}>
                  {detailsLink && (
                    <Link
                      {...detailsLink}
                      className="catalogue-btn catalogue-btn-secondary catalogue-btn-sm flex-1 justify-center whitespace-nowrap no-underline"
                    >
                      {viewCourseLabel || "View course"}
                    </Link>
                  )}
                  <Link
                    to="/product-pages/$productPageCode"
                    params={{ productPageCode }}
                    search={enrolSearch}
                    className="catalogue-btn catalogue-btn-primary catalogue-btn-sm flex-1 justify-center whitespace-nowrap no-underline"
                    aria-label={`${ctaLabel || "Enrol now"} — ${name}`}
                  >
                    {ctaLabel || "Enrol now"}
                    <ArrowRight className="size-3.5" weight="bold" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </article>
        );
  };

  const cards = visible.map((m, i) => renderCard(m, i));

  const grid = <div className={gridCols}>{cards}</div>;

  // The rail renders OUTSIDE the shell so cards scroll edge-to-edge across the
  // viewport (a card visibly continuing past the screen edge IS the swipe
  // affordance); catalogue-carousel-bleed re-creates the shell's gutter as
  // padding so the first card still lines up with the heading above it.
  const carousel = (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={syncArrows}
        className="catalogue-carousel-bleed catalogue-no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto py-2"
        role="group"
        aria-label={title || "Courses"}
      >
        {cards}
        {/* Tail card — states plainly how many courses the rail is not
            showing, rather than silently truncating the list. */}
        {railHidden > 0 && productPageCode && (
          <Link
            to="/product-pages/$productPageCode"
            params={{ productPageCode }}
            search={{ ...(instituteId ? { instituteId } : {}), ...(tagName ? { tagName } : {}) }}
            style={
              {
                flexBasis: `calc((100% - ${(cols - 1) * 1.25}rem) / ${cols})`,
              } as React.CSSProperties
            }
            className="catalogue-card group flex min-w-reg-250 shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-catalogue-lg border border-dashed border-catalogue-border p-6 text-center no-underline"
          >
            <span className="catalogue-h3 text-catalogue-brand-ink">+{railHidden}</span>
            <span className="text-sm font-semibold text-catalogue-text-primary">
              {viewAllLabel || "See all courses"}
            </span>
            <span className="text-xs text-catalogue-text-muted">
              Search and filter the full list
            </span>
            <ArrowRight className="size-4 text-catalogue-brand-ink" weight="bold" aria-hidden="true" />
          </Link>
        )}
      </div>

      {/* Arrows are an affordance on top of native scroll/swipe, not the only
          way to move — they stay hidden until there is somewhere to go. */}
      {canPrev && (
        <button
          type="button"
          onClick={() => scrollByPage(-1)}
          aria-label="Scroll to previous courses"
          className="catalogue-btn catalogue-btn-secondary absolute left-3 top-1/2 hidden size-10 -translate-y-1/2 justify-center rounded-full border-catalogue-border bg-catalogue-bg p-0 shadow-lg md:inline-flex"
        >
          <CaretLeft className="size-5" weight="bold" aria-hidden="true" />
        </button>
      )}
      {canNext && (
        <button
          type="button"
          onClick={() => scrollByPage(1)}
          aria-label="Scroll to more courses"
          className="catalogue-btn catalogue-btn-secondary absolute right-3 top-1/2 hidden size-10 -translate-y-1/2 justify-center rounded-full border-catalogue-border bg-catalogue-bg p-0 shadow-lg md:inline-flex"
        >
          <CaretRight className="size-5" weight="bold" aria-hidden="true" />
        </button>
      )}
    </div>
  );

  const searchRow = searchEnabled && (
    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <MagnifyingGlass
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-catalogue-text-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          placeholder="Search courses"
          aria-label="Search courses"
          className={`catalogue-input catalogue-input-icon-start w-full ${query ? "catalogue-input-icon-end" : ""}`}
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setPage(1); }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-catalogue-text-muted transition-colors hover:bg-catalogue-interactive-hover hover:text-catalogue-text-primary"
          >
            <X className="size-3.5" weight="bold" aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="text-xs text-catalogue-text-muted" role="status" aria-live="polite">
        {filtered.length === 0
          ? "No matches"
          : `Showing ${start + 1}–${Math.min(start + visible.length, filtered.length)} of ${filtered.length}`}
      </p>
    </div>
  );

  // Hand-rolled shell layout (instead of section()) because the carousel track
  // must be a DIRECT child of the full-width section to bleed to the viewport
  // edge — everything else stays inside the shell column.
  return (
    <section
      className="catalogue-section bg-catalogue-bg"
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      <div className="catalogue-shell">
        {header}
        {searchRow}
        {filtered.length === 0 && (
          <div className="catalogue-card rounded-catalogue-lg border border-dashed border-catalogue-border p-8 text-center text-sm text-catalogue-text-muted">
            No courses match “{query.trim()}”.
          </div>
        )}
      </div>

      {filtered.length > 0 &&
        (isCarousel ? (
          carousel
        ) : (
          <div className="catalogue-shell">
            {scrollable ? (
              <div
                ref={scrollRef}
                className="overflow-y-auto overscroll-contain pr-1"
                // Admin-authored height — a free-form px value, so it cannot be a token.
                style={{ maxHeight: `${Math.max(Number(scrollMaxHeight) || 640, 240)}px` }}
              >
                {grid}
              </div>
            ) : (
              grid
            )}
          </div>
        ))}

      <div className="catalogue-shell">
      {totalPages > 1 && (
        <nav className="mt-8 flex flex-wrap items-center justify-center gap-2" aria-label="Course pages">
          <button
            type="button"
            onClick={() => goToPage(safePage - 1)}
            disabled={safePage === 1}
            aria-label="Previous page"
            className="catalogue-btn catalogue-btn-secondary catalogue-btn-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CaretLeft className="size-3.5" weight="bold" aria-hidden="true" />
          </button>

          {buildPageWindow(safePage, totalPages).map((p, i) =>
            p === "gap" ? (
              <span key={`gap-${i}`} className="px-1 text-xs text-catalogue-text-muted" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => goToPage(p)}
                aria-label={`Page ${p}`}
                aria-current={p === safePage ? "page" : undefined}
                className={
                  p === safePage
                    ? "catalogue-btn catalogue-btn-primary catalogue-btn-sm min-w-9 justify-center"
                    : "catalogue-btn catalogue-btn-secondary catalogue-btn-sm min-w-9 justify-center"
                }
              >
                {p}
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => goToPage(safePage + 1)}
            disabled={safePage === totalPages}
            aria-label="Next page"
            className="catalogue-btn catalogue-btn-secondary catalogue-btn-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CaretRight className="size-3.5" weight="bold" aria-hidden="true" />
          </button>
        </nav>
      )}
      </div>
    </section>
  );
};

export default ProductPageOfferComponent;
