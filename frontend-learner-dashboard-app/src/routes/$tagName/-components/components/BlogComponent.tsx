import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CalendarBlank, Clock, LinkSimple, UserCircle } from "@phosphor-icons/react";
import { RouteMatcher } from "../../-services/route-matcher";
import { BlogService, type BlogPostPage, type BlogPostSummary } from "../../-services/blog-service";
import { blogPlainText, sanitizeBlogHtml } from "../../-utils/blog-html";
import "./catalogue-blog.css";

/**
 * Blog — the catalogue section that shows an institute's blog posts.
 *
 * Posts are NOT in catalogue_json: they are rows an admin writes in Manage
 * Pages → Blog (or an AI app writes over MCP), read live here, so publishing
 * an article never means republishing the site. This one component renders
 * both faces of a blog:
 *
 *   list   — /<site>/<page>            cards, newest first, category chips
 *   post   — /<site>/<page>/<slug>     the article, with its own SEO tags
 *
 * Which face shows is decided from the URL, not from props, so the same
 * section on the same page serves both without the admin wiring anything.
 * The slug is read from the path segment after this page's route; `?post=`
 * is accepted too, for a blog placed on the home page where a trailing
 * segment would collide with page and course routes.
 *
 * Bodies are authored HTML and render on the learner domain, so they pass
 * through sanitizeBlogHtml at render time — the only line of defence for
 * HTML an admin pasted by hand.
 */

export interface BlogComponentProps {
  heading?: string;
  subheading?: string;
  layout?: "grid" | "list";
  columns?: 2 | 3;
  pageSize?: number;
  /** '' = every category. */
  category?: string;
  showCoverImage?: boolean;
  showExcerpt?: boolean;
  showDate?: boolean;
  showAuthor?: boolean;
  showCategory?: boolean;
  showReadingTime?: boolean;
  showCategoryFilter?: boolean;
  readMoreLabel?: string;
  backLabel?: string;
  emptyMessage?: string;
  backgroundColor?: string;
  textColor?: string;
  /* injected by the renderer */
  instituteId: string;
  tagName: string;
  pageRoute: string;
  isPreviewMode?: boolean;
}

const isHomeRoute = (route: string) => {
  const r = RouteMatcher.normalizeRoute(route || "");
  return r === "" || r === "home";
};

const formatDate = (iso: string | null | undefined, locale: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
};

export const BlogComponent: React.FC<BlogComponentProps> = ({
  heading,
  subheading,
  layout = "grid",
  columns = 3,
  pageSize = 9,
  category = "",
  showCoverImage = true,
  showExcerpt = true,
  showDate = true,
  showAuthor = true,
  showCategory = true,
  showReadingTime = true,
  showCategoryFilter = true,
  readMoreLabel,
  backLabel,
  emptyMessage,
  backgroundColor,
  textColor,
  instituteId,
  tagName,
  pageRoute,
  isPreviewMode = false,
}) => {
  const { t, i18n } = useTranslation("coursePlayerB");
  const location = useLocation();
  const navigate = useNavigate();

  const onHome = isHomeRoute(pageRoute);

  /** The post slug this URL addresses, if any. */
  const postSlug = useMemo(() => {
    const search = new URLSearchParams(location.searchStr || "");
    const fromQuery = search.get("post");
    if (fromQuery) return fromQuery;
    if (onHome) return null;
    const segs = RouteMatcher.segmentsAfterBase(location.pathname, tagName);
    if (segs.length >= 2 && RouteMatcher.normalizeRoute(segs[0]) === RouteMatcher.normalizeRoute(pageRoute)) {
      return decodeURIComponent(segs[1]);
    }
    return null;
  }, [location.pathname, location.searchStr, onHome, pageRoute, tagName]);

  const listPath = RouteMatcher.pagePath(tagName, pageRoute);
  const postPath = (slug: string) =>
    onHome ? `${listPath}?post=${encodeURIComponent(slug)}` : `${listPath}/${encodeURIComponent(slug)}`;

  const sectionStyle: React.CSSProperties | undefined =
    backgroundColor || textColor ? { backgroundColor: backgroundColor || undefined, color: textColor || undefined } : undefined;

  if (postSlug) {
    return (
      <BlogPost
        slug={postSlug}
        instituteId={instituteId}
        listPath={listPath}
        backLabel={backLabel || t("blog.backToList")}
        showDate={showDate}
        showAuthor={showAuthor}
        showCategory={showCategory}
        showReadingTime={showReadingTime}
        sectionStyle={sectionStyle}
        locale={i18n.language}
        onBack={() => navigate({ to: listPath as never })}
      />
    );
  }

  return (
    <BlogList
      heading={heading}
      subheading={subheading}
      layout={layout}
      columns={columns}
      pageSize={pageSize}
      category={category}
      showCoverImage={showCoverImage}
      showExcerpt={showExcerpt}
      showDate={showDate}
      showAuthor={showAuthor}
      showCategory={showCategory}
      showReadingTime={showReadingTime}
      showCategoryFilter={showCategoryFilter}
      readMoreLabel={readMoreLabel || t("blog.readMore")}
      emptyMessage={emptyMessage || t("blog.empty")}
      sectionStyle={sectionStyle}
      instituteId={instituteId}
      listPath={listPath}
      postPath={postPath}
      isPreviewMode={isPreviewMode}
      onHome={onHome}
      locale={i18n.language}
    />
  );
};

/* ─── List ─────────────────────────────────────────────────────────────── */

interface BlogListProps {
  heading?: string;
  subheading?: string;
  layout: "grid" | "list";
  columns: 2 | 3;
  pageSize: number;
  category: string;
  showCoverImage: boolean;
  showExcerpt: boolean;
  showDate: boolean;
  showAuthor: boolean;
  showCategory: boolean;
  showReadingTime: boolean;
  showCategoryFilter: boolean;
  readMoreLabel: string;
  emptyMessage: string;
  sectionStyle?: React.CSSProperties;
  instituteId: string;
  listPath: string;
  postPath: (slug: string) => string;
  isPreviewMode: boolean;
  onHome: boolean;
  locale: string;
}

const BlogList: React.FC<BlogListProps> = ({
  heading, subheading, layout, columns, pageSize, category,
  showCoverImage, showExcerpt, showDate, showAuthor, showCategory, showReadingTime, showCategoryFilter,
  readMoreLabel, emptyMessage, sectionStyle, instituteId, listPath, postPath, isPreviewMode, onHome, locale,
}) => {
  const { t } = useTranslation("coursePlayerB");
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  // The chip a visitor picked; the authored `category` prop is the fixed
  // filter underneath it (a chip list only appears when the prop is empty).
  const [pickedCategory, setPickedCategory] = useState("");
  const [data, setData] = useState<BlogPostPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const effectiveCategory = category || pickedCategory;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    BlogService.listPosts(instituteId, { page, size: pageSize, category: effectiveCategory })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [instituteId, page, pageSize, effectiveCategory]);

  const posts = data?.content || [];
  const totalPages = data?.total_pages || 0;
  const categories = data?.categories || [];

  const gridClass =
    layout === "list"
      ? "flex flex-col gap-6"
      : columns === 2
        ? "grid grid-cols-1 gap-6 sm:grid-cols-2"
        : "catalogue-grid-cards";

  const open = (slug: string) => {
    // pagePath() already applied the root-mount rule. The home-page form is a
    // search param, which the router wants as an object, not in `to`.
    if (onHome) {
      navigate({ to: listPath as never, search: { post: slug } as never });
      return;
    }
    navigate({ to: postPath(slug) as never });
  };

  return (
    <section className="catalogue-section bg-catalogue-bg" style={sectionStyle} data-blog-section>
      <div className="catalogue-shell">
        {(heading || subheading) && (
          <div className="catalogue-section-header text-center">
            {heading && <h2 className="catalogue-h2 text-catalogue-text-primary">{heading}</h2>}
            {subheading && (
              <p className="catalogue-lead catalogue-measure text-catalogue-text-muted">{subheading}</p>
            )}
          </div>
        )}

        {isPreviewMode && onHome && (
          <p className="mb-6 rounded-catalogue-md border border-dashed border-warning-400 bg-warning-50 px-4 py-3 text-center text-xs text-catalogue-text-secondary">
            {t("blog.homePageHint")}
          </p>
        )}

        {showCategoryFilter && !category && categories.length > 1 && (
          <div className="mb-8 flex flex-wrap justify-center gap-2" role="tablist" aria-label={t("blog.categories")}>
            {["", ...categories].map((c) => {
              const active = c === pickedCategory;
              return (
                <button
                  key={c || "__all"}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setPickedCategory(c);
                    setPage(0);
                  }}
                  className={`catalogue-btn catalogue-btn-sm ${active ? "catalogue-btn-primary" : "catalogue-btn-secondary"}`}
                >
                  {c || t("blog.allCategories")}
                </button>
              );
            })}
          </div>
        )}

        {loading && !data ? (
          <div className={gridClass} aria-busy="true">
            {Array.from({ length: Math.min(pageSize, 6) }).map((_, i) => (
              <div key={i} className="catalogue-card overflow-hidden">
                {showCoverImage && <div className="catalogue-skeleton catalogue-aspect-video w-full rounded-none" />}
                <div className="space-y-3 p-5">
                  <div className="catalogue-skeleton catalogue-skeleton-title w-3/4" />
                  <div className="catalogue-skeleton catalogue-skeleton-text w-full" />
                  <div className="catalogue-skeleton catalogue-skeleton-text w-5/6" />
                </div>
              </div>
            ))}
          </div>
        ) : failed ? (
          <p className="text-center text-sm text-catalogue-text-muted">{t("blog.loadFailed")}</p>
        ) : posts.length === 0 ? (
          <div className="catalogue-card rounded-catalogue-lg border border-dashed border-catalogue-border p-8 text-center text-sm text-catalogue-text-muted">
            {isPreviewMode ? t("blog.emptyGuidance") : emptyMessage}
          </div>
        ) : (
          <div className={gridClass}>
            {posts.map((post) => (
              <BlogCard
                key={post.id}
                post={post}
                horizontal={layout === "list"}
                href={postPath(post.slug)}
                onOpen={() => open(post.slug)}
                showCoverImage={showCoverImage}
                showExcerpt={showExcerpt}
                showDate={showDate}
                showAuthor={showAuthor}
                showCategory={showCategory}
                showReadingTime={showReadingTime}
                readMoreLabel={readMoreLabel}
                locale={locale}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-3" aria-label={t("blog.pagination")}>
            <button
              type="button"
              className="catalogue-btn catalogue-btn-secondary catalogue-btn-sm"
              disabled={page === 0 || loading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ArrowLeft size={14} aria-hidden="true" /> {t("blog.newer")}
            </button>
            <span className="text-xs text-catalogue-text-muted">
              {t("blog.pageOf", { page: page + 1, total: totalPages })}
            </span>
            <button
              type="button"
              className="catalogue-btn catalogue-btn-secondary catalogue-btn-sm"
              disabled={page >= totalPages - 1 || loading}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              {t("blog.older")} <ArrowRight size={14} aria-hidden="true" />
            </button>
          </nav>
        )}
      </div>
    </section>
  );
};

/* ─── Card ─────────────────────────────────────────────────────────────── */

interface BlogCardProps {
  post: BlogPostSummary;
  horizontal: boolean;
  href: string;
  onOpen: () => void;
  showCoverImage: boolean;
  showExcerpt: boolean;
  showDate: boolean;
  showAuthor: boolean;
  showCategory: boolean;
  showReadingTime: boolean;
  readMoreLabel: string;
  locale: string;
}

const BlogCard: React.FC<BlogCardProps> = ({
  post, horizontal, href, onOpen, showCoverImage, showExcerpt, showDate, showAuthor, showCategory,
  showReadingTime, readMoreLabel, locale,
}) => {
  const { t } = useTranslation("coursePlayerB");
  const excerpt = post.excerpt || "";
  const date = showDate ? formatDate(post.published_at, locale) : "";
  const cover = showCoverImage && post.cover_image_url;

  return (
    <article
      className={`catalogue-card-elevated group flex overflow-hidden ${horizontal ? "flex-col sm:flex-row" : "flex-col"}`}
    >
      {cover && (
        <a
          href={href}
          onClick={(e) => {
            e.preventDefault();
            onOpen();
          }}
          className={`catalogue-img-zoom block shrink-0 overflow-hidden ${horizontal ? "sm:w-2/5" : "w-full"}`}
          tabIndex={-1}
          aria-hidden="true"
        >
          <img
            src={post.cover_image_url as string}
            alt=""
            loading="lazy"
            className={`h-full w-full object-cover ${horizontal ? "aspect-video sm:aspect-auto" : "aspect-video"}`}
          />
        </a>
      )}
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {(showCategory && post.category) || date ? (
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-catalogue-text-muted">
            {showCategory && post.category && <span className="catalogue-badge catalogue-badge-primary">{post.category}</span>}
            {date && (
              <time dateTime={post.published_at || undefined} className="inline-flex items-center gap-1">
                <CalendarBlank size={13} aria-hidden="true" /> {date}
              </time>
            )}
          </div>
        ) : null}
        <h3 className="catalogue-blog-card-title catalogue-h3 text-catalogue-text-primary">
          <a
            href={href}
            onClick={(e) => {
              e.preventDefault();
              onOpen();
            }}
            className="hover:underline"
          >
            {post.title}
          </a>
        </h3>
        {showExcerpt && excerpt && (
          <p className="catalogue-blog-card-excerpt mt-2 text-sm leading-relaxed text-catalogue-text-secondary">{excerpt}</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs text-catalogue-text-muted">
          <span className="inline-flex min-w-0 items-center gap-3">
            {showAuthor && post.author_name && (
              <span className="inline-flex items-center gap-1 truncate">
                <UserCircle size={14} aria-hidden="true" /> {post.author_name}
              </span>
            )}
            {showReadingTime && post.reading_minutes ? (
              <span className="inline-flex items-center gap-1">
                <Clock size={14} aria-hidden="true" /> {t("blog.minRead", { minutes: post.reading_minutes })}
              </span>
            ) : null}
          </span>
          <a
            href={href}
            onClick={(e) => {
              e.preventDefault();
              onOpen();
            }}
            className="catalogue-link inline-flex shrink-0 items-center gap-1 font-medium"
          >
            {readMoreLabel} <ArrowRight size={14} aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>
  );
};

/* ─── Post ─────────────────────────────────────────────────────────────── */

interface BlogPostProps {
  slug: string;
  instituteId: string;
  listPath: string;
  backLabel: string;
  showDate: boolean;
  showAuthor: boolean;
  showCategory: boolean;
  showReadingTime: boolean;
  sectionStyle?: React.CSSProperties;
  locale: string;
  onBack: () => void;
}

const BlogPost: React.FC<BlogPostProps> = ({
  slug, instituteId, listPath, backLabel, showDate, showAuthor, showCategory, showReadingTime, sectionStyle, locale, onBack,
}) => {
  const { t } = useTranslation("coursePlayerB");
  const [post, setPost] = useState<BlogPostSummary | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPost(undefined);
    BlogService.getPost(instituteId, slug)
      .then((p) => {
        if (!cancelled) setPost(p);
      })
      .catch(() => {
        if (!cancelled) setPost(null);
      });
    return () => {
      cancelled = true;
    };
  }, [instituteId, slug]);

  // A fresh article starts at the top, not wherever the list was scrolled to.
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }, [slug]);

  const bodyHtml = useMemo(() => (post?.content_html ? sanitizeBlogHtml(post.content_html) : ""), [post?.content_html]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — nothing to do */
    }
  };

  const back = (
    <a
      href={listPath}
      onClick={(e) => {
        e.preventDefault();
        onBack();
      }}
      className="catalogue-link inline-flex items-center gap-1.5 text-sm font-medium"
    >
      <ArrowLeft size={16} aria-hidden="true" /> {backLabel}
    </a>
  );

  if (post === undefined) {
    return (
      <section className="catalogue-section bg-catalogue-bg" style={sectionStyle} aria-busy="true">
        <div className="catalogue-shell-prose space-y-4">
          <div className="catalogue-skeleton h-4 w-24" />
          <div className="catalogue-skeleton catalogue-skeleton-title w-3/4" />
          <div className="catalogue-skeleton catalogue-aspect-video w-full" />
          <div className="catalogue-skeleton catalogue-skeleton-text w-full" />
          <div className="catalogue-skeleton catalogue-skeleton-text w-11/12" />
          <div className="catalogue-skeleton catalogue-skeleton-text w-4/5" />
        </div>
      </section>
    );
  }

  if (post === null) {
    return (
      <section className="catalogue-section bg-catalogue-bg" style={sectionStyle}>
        <div className="catalogue-shell-prose text-center">
          <h1 className="catalogue-h2 text-catalogue-text-primary">{t("blog.notFoundTitle")}</h1>
          <p className="mt-2 text-sm text-catalogue-text-muted">{t("blog.notFoundBody")}</p>
          <div className="mt-6">{back}</div>
        </div>
      </section>
    );
  }

  const date = showDate ? formatDate(post.published_at, locale) : "";
  const description = post.seo_description || post.excerpt || blogPlainText(post.content_html || "", 160);

  return (
    <article className="catalogue-section bg-catalogue-bg" style={sectionStyle}>
      <Helmet>
        <title>{post.seo_title || post.title}</title>
        <meta name="description" content={description} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={post.seo_title || post.title} />
        <meta property="og:description" content={description} />
        {post.cover_image_url && <meta property="og:image" content={post.cover_image_url} />}
        {post.published_at && <meta property="article:published_time" content={post.published_at} />}
      </Helmet>
      <div className="catalogue-shell-prose">
        <div className="mb-6">{back}</div>
        <header className="mb-8">
          {showCategory && post.category && <p className="catalogue-eyebrow mb-3">{post.category}</p>}
          <h1 className="catalogue-h1 text-catalogue-text-primary">{post.title}</h1>
          {(showAuthor && post.author_name) || date || (showReadingTime && post.reading_minutes) ? (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-catalogue-text-muted">
              {showAuthor && post.author_name && (
                <span className="inline-flex items-center gap-1.5">
                  <UserCircle size={16} aria-hidden="true" /> {post.author_name}
                </span>
              )}
              {date && (
                <time dateTime={post.published_at || undefined} className="inline-flex items-center gap-1.5">
                  <CalendarBlank size={16} aria-hidden="true" /> {date}
                </time>
              )}
              {showReadingTime && post.reading_minutes ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={16} aria-hidden="true" /> {t("blog.minRead", { minutes: post.reading_minutes })}
                </span>
              ) : null}
            </div>
          ) : null}
        </header>
        {post.cover_image_url && (
          <img
            src={post.cover_image_url}
            alt=""
            className="mb-8 w-full rounded-catalogue-lg object-cover"
          />
        )}
        <div className="catalogue-rich-text catalogue-blog-article" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        {post.tags && post.tags.length > 0 && (
          <ul className="mt-10 flex flex-wrap gap-2" aria-label={t("blog.tags")}>
            {post.tags.map((tag) => (
              <li key={tag} className="catalogue-badge">
                #{tag}
              </li>
            ))}
          </ul>
        )}
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-catalogue-border pt-6">
          {back}
          <button type="button" onClick={copyLink} className="catalogue-btn catalogue-btn-secondary catalogue-btn-sm">
            <LinkSimple size={14} aria-hidden="true" /> {copied ? t("blog.linkCopied") : t("blog.copyLink")}
          </button>
        </footer>
      </div>
    </article>
  );
};

export default BlogComponent;
