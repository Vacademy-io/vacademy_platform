import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CaretRight, CheckCircle, Star } from "@phosphor-icons/react";
import { FitImage } from "@/components/common/fit-image/FitImage";
import { PriceWithMrp } from "@/components/common/price-with-mrp";
import { cn, sanitizeHtml } from "@/lib/utils";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { getTerminology, getTerminologyPlural } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, RoleTerms, SystemTerms } from "@/types/naming-settings";
import { RouteMatcher } from "../../-services/route-matcher";
import { useSiteNavigate } from "../../-utils/catalogue-route-search";
import { useSiteT } from "../../-utils/catalogue-locale";
import type { CourseAuthor } from "../../-utils/course-authors";
import type { CoursePageContext } from "../-utils/course-page-context";
import { plainText, summaryOf } from "../-utils/course-page-context";
import { AuthorAvatar } from "./AuthorAvatar";

/**
 * The course page's default layout: a header that says what the course is
 * (breadcrumb, title, summary, format chips, author, the course's own image),
 * a purchase card beside the content, the description open rather than
 * folded away, the outline, the authors, and a "More in …" strip.
 *
 * The purchase actions, the outline and every dialog stay in
 * CourseDetailsPage, which passes them in, so this view never forks the
 * enrol / cart / payment flow (as EbookDetailsView). A site that built its
 * own course header ("details" page) keeps it: `showHeader` is false there.
 */

const PLACEHOLDER = "/api/placeholder";

/** The first of the course's images that resolves (preview, banner, thumbnail…). */
const useCourseImage = (candidates: Array<string | null | undefined>) => {
  const ids = candidates.filter(
    (c): c is string => typeof c === "string" && !!c.trim() && !c.startsWith(PLACEHOLDER) && c !== "null",
  );
  const key = ids.join("|");
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true;
    setUrl("");
    (async () => {
      for (const id of ids) {
        if (/^https?:\/\//i.test(id)) {
          if (alive) setUrl(id);
          return;
        }
        try {
          const resolved = await getPublicUrlWithoutLogin(id);
          if (resolved) {
            if (alive) setUrl(resolved);
            return;
          }
        } catch {
          /* try the next image */
        }
      }
    })();
    return () => {
      alive = false;
    };
    // `key` stands for `ids`, whose array identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return url;
};

/**
 * Authored text, open, cut at about eight lines with one "Read more" that
 * expands in place. The author's centred or justified paragraphs read as one
 * left-aligned column here (course-richtext).
 */
const RichSection: React.FC<{ title: string; html: string; id?: string }> = ({ title, html, id }) => {
  const { t } = useTranslation("coursePlayerB");
  const bodyRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 4);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [html, open]);
  return (
    <section
      aria-labelledby={id}
      className="rounded-catalogue-lg border border-catalogue-border bg-catalogue-bg-elevated p-5 shadow-sm sm:p-6"
    >
      <h2 id={id} className="text-lg font-semibold text-catalogue-text-primary">
        {title}
      </h2>
      <div className="relative mt-3">
        <div
          ref={bodyRef}
          className={cn(
            "course-richtext richtext-content text-sm leading-relaxed text-catalogue-text-secondary sm:text-base",
            !open && "max-h-60 overflow-hidden",
          )}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
        />
        {!open && overflows && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-catalogue-bg-elevated to-transparent"
          />
        )}
      </div>
      {(overflows || open) && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-3 rounded-sm text-sm font-semibold text-primary-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
        >
          {open
            ? t("courseDetails.page.showLess", "Show less")
            : t("courseDetails.page.readMore", "Read more")}
        </button>
      )}
    </section>
  );
};

/** The authors, each with the profile the admin wrote (photo, subtitle, bio). */
const AuthorsSection: React.FC<{ authors: CourseAuthor[] }> = ({ authors }) => {
  const title = getTerminologyPlural(RoleTerms.Teacher, SystemTerms.Teacher);
  return (
    <section className="rounded-catalogue-lg border border-catalogue-border bg-catalogue-bg-elevated p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-catalogue-text-primary">{title}</h2>
      <ul className="mt-4 space-y-4">
        {authors.map((a, i) => (
          <li key={`${a.id}-${i}`} className="flex items-start gap-3">
            <AuthorAvatar author={a} sizeClass="size-12" />
            <div className="min-w-0">
              <p className="font-semibold text-catalogue-text-primary">{a.name}</p>
              {a.subtitle && <p className="text-sm text-catalogue-text-secondary">{a.subtitle}</p>}
              {a.description && plainText(a.description) && (
                <div
                  className="course-richtext richtext-content mt-1.5 text-sm leading-relaxed text-catalogue-text-secondary"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(a.description) }}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export interface CoursePurchasePanelProps {
  showPrice: boolean;
  pricePending: boolean;
  price: number | null | undefined;
  elevatedPrice?: number | null;
  currency?: string | null;
  /** Language / level pickers, when the site has versions. */
  picker?: React.ReactNode;
  /** Level name, when no picker names it. */
  level?: string | null;
  /** Shown only for formats that are watched or attended (see showsDuration). */
  duration?: string | null;
  /** A real average only; 0 / none hides the row. */
  rating?: number | null;
  /** Add to cart / Buy now / Enrol, built by the page. */
  actions: React.ReactNode;
  /** "What you get": base-language format labels and the access line. */
  formatLabels: string[];
  free: boolean;
  comingSoon: boolean;
}

/** Price, pickers, actions and what the buyer gets — one card, used twice (mobile inline, desktop sticky). */
export const CoursePurchasePanel: React.FC<CoursePurchasePanelProps> = ({
  showPrice,
  pricePending,
  price,
  elevatedPrice,
  currency,
  picker,
  level,
  duration,
  rating,
  actions,
  formatLabels,
  free,
  comingSoon,
}) => {
  const { t } = useTranslation("coursePlayerB");
  const siteT = useSiteT();
  const perks = [
    ...formatLabels.map((label) => siteT(label)),
    ...(comingSoon
      ? []
      : [
          free
            ? t("courseDetails.page.perkFree", "Free to enrol")
            : t("courseDetails.page.perkInstant", "Instant access after payment"),
        ]),
    t("courseDetails.page.perkPlatform", "Learn on the web and in the app"),
  ];
  return (
    <div className="space-y-4 rounded-catalogue-lg border border-catalogue-border bg-catalogue-bg-elevated p-5 shadow-sm">
      {showPrice && (
        <div>
          {pricePending ? (
            <span role="status" className="block h-8 w-28 animate-pulse rounded-catalogue-sm bg-catalogue-bg-muted">
              <span className="sr-only">{t("courseDetails.priceLoading", "Loading price")}</span>
            </span>
          ) : (
            <PriceWithMrp
              actual={price ?? 0}
              elevated={elevatedPrice}
              currency={currency ?? undefined}
              size="lg"
              className="font-bold text-catalogue-text-primary"
            />
          )}
        </div>
      )}
      {picker}
      {(level || duration || (rating ?? 0) > 0) && (
        <dl className="space-y-1.5 text-sm">
          {level && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-catalogue-text-secondary">{t("courseDetails.page.level", "Level")}</dt>
              <dd className="font-medium text-catalogue-text-primary">{level}</dd>
            </div>
          )}
          {duration && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-catalogue-text-secondary">{t("courseDetails.duration")}</dt>
              <dd className="font-medium text-catalogue-text-primary">{duration}</dd>
            </div>
          )}
          {(rating ?? 0) > 0 && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-catalogue-text-secondary">{t("courseDetails.rating")}</dt>
              <dd className="flex items-center gap-1 font-medium text-catalogue-text-primary">
                <Star size={14} weight="fill" className="text-warning-500" aria-hidden />
                {rating!.toFixed(1)}
              </dd>
            </div>
          )}
        </dl>
      )}
      <div className="space-y-2">{actions}</div>
      <div className="border-t border-catalogue-border-subtle pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-catalogue-text-muted">
          {t("courseDetails.page.whatYouGet", "What you get")}
        </p>
        <ul className="mt-2 space-y-1.5">
          {perks.map((perk) => (
            <li key={perk} className="flex items-start gap-2 text-sm text-catalogue-text-secondary">
              <CheckCircle size={16} weight="fill" className="mt-0.5 shrink-0 text-primary-500" aria-hidden />
              {perk}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export interface CourseDetailsViewProps {
  /** In the visitor's language. */
  title: string;
  aboutHtml: string;
  whyLearnHtml: string;
  whoShouldLearnHtml: string;
  /** The course's images, best first (media ids or URLs). */
  imageCandidates: Array<string | null | undefined>;
  /** False when the site renders its own course header ("details" page). */
  showHeader: boolean;
  context: CoursePageContext;
  /** Visible authors, in the visitor's language. */
  authors: CourseAuthor[];
  /** The purchase card, built by the page (CoursePurchasePanel). */
  purchase: React.ReactNode;
  outline: React.ReactNode;
  /** The site's outline view: the syllabus leads. */
  outlineFirst: boolean;
  /** "More in …" strip, or null. */
  related: React.ReactNode;
  tagName: string;
}

export const CourseDetailsView: React.FC<CourseDetailsViewProps> = ({
  title,
  aboutHtml,
  whyLearnHtml,
  whoShouldLearnHtml,
  imageCandidates,
  showHeader,
  context,
  authors,
  purchase,
  outline,
  outlineFirst,
  related,
  tagName,
}) => {
  const { t } = useTranslation("coursePlayerB");
  const siteT = useSiteT();
  const siteNavigate = useSiteNavigate();
  const imageUrl = useCourseImage(showHeader ? imageCandidates : []);
  const summary = summaryOf(aboutHtml);
  const coursesWord = getTerminologyPlural(ContentTerms.Course, SystemTerms.Course);

  // The tab says which course this is (restored when the page goes).
  useEffect(() => {
    if (!title) return;
    const before = document.title;
    document.title = title;
    return () => {
      document.title = before;
    };
  }, [title]);

  const crumbs = context.breadcrumb.map((c, i) => {
    const query = c.search ? `?${new URLSearchParams(c.search).toString()}` : "";
    return {
      key: `${c.route}-${i}`,
      label: c.label ? siteT(c.label) : coursesWord,
      href: `${RouteMatcher.pagePath(tagName, c.route)}${query}`,
    };
  });
  const openCrumb = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    void siteNavigate(href);
  };
  const chips = [
    ...context.formatLabels.map((l) => siteT(l)),
    ...(context.category ? [siteT(context.category.label)] : []),
  ];
  const leadAuthor = authors[0]?.name;

  const sections = (
    <>
      {aboutHtml && plainText(aboutHtml) && (
        <RichSection
          id="course-about"
          title={t("courseDetails.accordion.aboutThisCourse", {
            course: getTerminology(ContentTerms.Course, SystemTerms.Course),
          })}
          html={aboutHtml}
        />
      )}
      {whyLearnHtml && plainText(whyLearnHtml) && (
        <RichSection id="course-learn" title={t("courseDetails.accordion.whatYoullLearn")} html={whyLearnHtml} />
      )}
      {whoShouldLearnHtml && plainText(whoShouldLearnHtml) && (
        <RichSection id="course-audience" title={t("courseDetails.accordion.whoShouldJoin")} html={whoShouldLearnHtml} />
      )}
    </>
  );

  return (
    <div className="w-full bg-catalogue-bg-subtle pb-24">
      {showHeader && (
        <header className="w-full border-b border-catalogue-border bg-catalogue-bg">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
            {crumbs.length > 0 && (
              <nav aria-label={t("courseDetails.page.breadcrumb", "Breadcrumb")} className="mb-5">
                <ol className="flex flex-wrap items-center gap-1 text-xs font-medium text-catalogue-text-muted sm:text-sm">
                  {crumbs.map((c) => (
                    <li key={c.key} className="flex items-center gap-1">
                      <a
                        href={c.href}
                        onClick={(e) => openCrumb(e, c.href)}
                        className="rounded-sm no-underline transition-colors hover:text-primary-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                      >
                        {c.label}
                      </a>
                      <CaretRight size={12} weight="bold" aria-hidden className="rtl:rotate-180" />
                    </li>
                  ))}
                  <li aria-current="page" className="line-clamp-1 text-catalogue-text-secondary">
                    {title}
                  </li>
                </ol>
              </nav>
            )}
            <div
              className={cn(
                "grid grid-cols-1 items-center gap-6 lg:gap-10",
                imageUrl && "lg:grid-cols-12",
              )}
            >
              <div className={cn(imageUrl && "lg:col-span-7", "order-2 lg:order-1")}>
                {chips.length > 0 && (
                  <ul className="mb-3 flex flex-wrap gap-2">
                    {chips.map((chip) => (
                      <li
                        key={chip}
                        className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-500"
                      >
                        {chip}
                      </li>
                    ))}
                  </ul>
                )}
                <h1 className="text-2xl font-bold leading-tight text-catalogue-text-primary sm:text-3xl lg:text-4xl">
                  {title}
                </h1>
                {summary && (
                  <p className="mt-3 text-base leading-relaxed text-catalogue-text-secondary">{summary}</p>
                )}
                {leadAuthor && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-catalogue-text-secondary">
                    <AuthorAvatar author={authors[0]!} sizeClass="size-8" />
                    <span>
                      {t("courseDetails.page.by", { name: leadAuthor, defaultValue: "By {{name}}" })}
                    </span>
                  </div>
                )}
              </div>
              {imageUrl && (
                <div className="order-1 lg:order-2 lg:col-span-5">
                  <div className="relative aspect-video w-full overflow-hidden rounded-catalogue-lg border border-catalogue-border bg-catalogue-bg-muted shadow-md">
                    <FitImage src={imageUrl} alt={title} className="absolute inset-0 size-full" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
          <div className="lg:col-span-2">
            {/* On small screens the price and actions come right after the header. */}
            <div className="mb-6 lg:hidden">{purchase}</div>
            <div className="space-y-6">
            {outlineFirst && outline}
            {sections}
            {!outlineFirst && outline}
            {authors.length > 0 && <AuthorsSection authors={authors} />}
            </div>
          </div>
          <aside className="hidden lg:block">
            <div className="sticky top-24">{purchase}</div>
          </aside>
        </div>
      </div>

      {/* The strip brings its own section and shell. */}
      {related && <div className="mt-6">{related}</div>}
    </div>
  );
};
