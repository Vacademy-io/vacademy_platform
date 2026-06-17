import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CaretLeft, CaretRight, Clock, ChalkboardTeacher } from "@phosphor-icons/react";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { cn } from "@/lib/utils";

interface HeroSectionProps {
  layout: "split" | "centered";
  backgroundImage?: string;
  backgroundColor?: string;
  left?: {
    title?: string;
    description?: string;
    button?: {
      text: string;
      action: string;
      target: string;
      enabled?: boolean;
      backgroundColor?: string;
    };
  };
  right?: {
    image?: string;
    alt?: string;
    /** Optional extra images. When 2+ are provided, the hero media area
     *  renders an auto-advancing carousel instead of a single image.
     *  (1 image → single image; 0 → nothing.) Backward compatible: if this
     *  is empty the single `image` above is used. */
    images?: Array<{ image?: string; alt?: string }>;
  };
  styles?: {
    padding?: string;
    backgroundColor?: string;
    roundedEdges?: boolean;
    textAlign?: "left" | "center" | "right";
  };
  courseData?: {
    title?: string;
    description?: string | null;
    previewImage?: string;
    bannerImage?: string;
    duration?: string;
    instructor?: string;
    tags?: string[];
  };
}

// Small pill row rendered above the hero title. Kept as a local helper so
// both the placeholder and image-backed hero variants style tags identically.
const HeroTags: React.FC<{ tags?: string[]; textAlign: "left" | "center" | "right" }> = ({
  tags,
  textAlign,
}) => {
  if (!tags || tags.length === 0) return null;
  const justify =
    textAlign === "center"
      ? "justify-center"
      : textAlign === "right"
      ? "justify-end"
      : "justify-start";
  return (
    <div className={`flex flex-wrap gap-2 ${justify}`}>
      {tags.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="catalogue-badge catalogue-badge-primary rounded-full uppercase tracking-wide"
        >
          {tag}
        </span>
      ))}
    </div>
  );
};

// Hero description with a built-in "View more / View less" toggle. The
// description can be long HTML; we clamp at 4 lines by default and only
// surface the toggle once the content is tall enough to actually be cut off
// (measured via scrollHeight vs clientHeight). Used by both the placeholder
// and state-backed hero variants so behavior stays consistent.
const HeroDescription: React.FC<{ html: string }> = ({ html }) => {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [html, expanded]);

  if (!html) return null;
  return (
    <div>
      <div
        ref={ref}
        className={`text-lg sm:text-xl text-catalogue-text-secondary leading-relaxed ${
          expanded ? "" : "line-clamp-4"
        }`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {(clamped || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-sm font-semibold text-primary-500 hover:underline focus:outline-none"
        >
          {expanded ? "View less" : "View more"}
        </button>
      )}
    </div>
  );
};

// Small "meta" row: duration + instructor. Renders only when at least one value
// is present. Keeps styling light so it doesn't compete with the title.
const HeroMeta: React.FC<{ duration?: string; instructor?: string }> = ({
  duration,
  instructor,
}) => {
  if (!duration && !instructor) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-subtitle text-muted-foreground">
      {duration && (
        <span className="flex items-center gap-1.5">
          <Clock size={16} weight="regular" className="shrink-0 text-primary-400" />
          {duration}
        </span>
      )}
      {instructor && (
        <span className="flex items-center gap-1.5">
          <ChalkboardTeacher size={16} weight="regular" className="shrink-0 text-primary-400" />
          {instructor}
        </span>
      )}
    </div>
  );
};

// Centralized enabled check - defaults to false if not provided
const isHeroButtonEnabled = (button?: { enabled?: boolean | string | number }) => {
  if (!button) return false;
  const { enabled } = button;
  if (enabled === undefined || enabled === null) return false;
  if (typeof enabled === "string") return enabled.toLowerCase() === "true";
  if (typeof enabled === "number") return enabled !== 0;
  return enabled === true;
};

// Check if image URL is a placeholder or invalid
const isPlaceholderImage = (imageUrl?: string | null): boolean => {
  if (!imageUrl) return true;
  const trimmed = imageUrl.trim();
  if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return true;
  if (trimmed.includes('/api/placeholder/')) return true;
  if (['course_banner_media_id', 'course_preview_image_media_id', 'thumbnail_file_id'].includes(trimmed)) return true;
  // Raw media ID check (contains underscores, no http/https, no slashes)
  if (trimmed.includes('_') && !trimmed.includes('http') && !trimmed.includes('/')) return true;
  return false;
};

// JSON templates sometimes ship raw field-name tokens (e.g. "about_the_course_html")
// as placeholder text that should be swapped out with backend content. When the
// backend value is missing we must not render the raw token to the user.
const PLACEHOLDER_TEXT_TOKENS = new Set([
  "about_the_course",
  "about_the_course_html",
  "course_html_description",
  "course_html_description_html",
  "who_should_learn",
  "why_learn",
  "package_name",
  "course_name",
  "course_title",
  "title",
  "description",
]);

const sanitizePlaceholderText = (text?: string | null): string => {
  if (!text) return "";
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (PLACEHOLDER_TEXT_TOKENS.has(trimmed)) return "";
  // Catch untagged snake_case / SCREAMING_SNAKE_CASE tokens that look like
  // raw field identifiers (e.g. "SOME_HTML_FIELD") with no spaces and underscores.
  if (/^[a-z0-9]+(?:_[a-z0-9]+)+$/i.test(trimmed) && !/\s/.test(trimmed)) {
    return "";
  }
  return trimmed;
};

export const HeroSectionComponent: React.FC<HeroSectionProps> = ({
  layout,
  backgroundImage,
  backgroundColor,
  left,
  right,
  styles = {},
  courseData,
}) => {
  const { roundedEdges = false, textAlign = "left" } = styles;

  return useMemo(() => {
    const sanitizedCourseTitle = sanitizePlaceholderText(courseData?.title);
    const sanitizedLeftTitle = sanitizePlaceholderText(left?.title);
    const heroTitle = sanitizedCourseTitle || sanitizedLeftTitle || "";

    const sanitizedCourseDescription = sanitizePlaceholderText(courseData?.description ?? undefined);
    const sanitizedLeftDescription = sanitizePlaceholderText(left?.description);
    const heroDescription = sanitizedCourseDescription || sanitizedLeftDescription || "";

    const heroImage = courseData?.previewImage || courseData?.bannerImage || right?.image || "";
    const heroImageAlt = right?.alt || sanitizedCourseTitle || "Course preview";
    const isHeroImagePlaceholder = isPlaceholderImage(heroImage);
    const isBackgroundImagePlaceholder = isPlaceholderImage(backgroundImage);
    // Carousel images can carry the hero media even when no single image is set.
    const hasCarouselImages = (right?.images || []).some(
      (im) => im?.image && !isPlaceholderImage(im.image),
    );

    const commonProps = {
      layout,
      left,
      right,
      courseData,
      heroTitle,
      heroDescription,
      heroImageAlt,
      roundedEdges,
      textAlign,
      backgroundColor,
    };

    if (isHeroImagePlaceholder && !hasCarouselImages) {
      return <HeroSectionPlaceholder {...commonProps} />;
    }

    return (
      <HeroSectionWithState 
        {...commonProps}
        heroImage={heroImage}
        heroBackgroundImage={backgroundImage}
        isHeroImagePlaceholder={isHeroImagePlaceholder}
        isBackgroundImagePlaceholder={isBackgroundImagePlaceholder}
      />
    );
  }, [layout, backgroundImage, left, right, courseData, roundedEdges, textAlign]);
};

// Placeholder component - no state management
const HeroSectionPlaceholder: React.FC<{
  layout: "split" | "centered";
  left?: HeroSectionProps['left'];
  heroTitle: string;
  heroDescription: string;
  heroImageAlt: string;
  roundedEdges: boolean;
  textAlign: "left" | "center" | "right";
  right?: HeroSectionProps['right'];
  courseData?: HeroSectionProps['courseData'];
  backgroundColor?: string;
}> = ({
  layout,
  left,
  courseData,
  heroTitle,
  heroDescription,
  roundedEdges,
  textAlign,
  backgroundColor,
}) => {
  const navigate = useNavigate();

  const handleButtonClick = (button: { action: string; target: string }) => {
    if (button.action === "navigate" && button.target) {
      navigate({ to: button.target });
    } else if (button.action === "openLeadCollection") {
      window.dispatchEvent(new CustomEvent('openLeadCollection', { detail: { source: 'heroSection' } }));
    }
  };

  return (
    <section
      className={cn("catalogue-hero-surface w-full overflow-hidden py-14 md:py-24", roundedEdges && "rounded-lg")}
      style={{ textAlign, ...(backgroundColor ? { backgroundColor } : {}) }} // design-lint-ignore: dynamic admin alignment + colour
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {layout === "split" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Content */}
            {(left || courseData) && (
              <div className="space-y-5">
                <HeroTags tags={courseData?.tags} textAlign={textAlign} />
                {heroTitle && (
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-catalogue-text-primary leading-tight tracking-tight">
                    {heroTitle}
                  </h1>
                )}
                <HeroDescription html={heroDescription} />
                {isHeroButtonEnabled(left?.button) && left?.button && (
                  <button
                    onClick={() => handleButtonClick(left.button!)}
                    className="catalogue-btn catalogue-btn-primary catalogue-btn-lg mt-4 shadow-lg transition-transform hover:-translate-y-0.5"
                    style={left.button.backgroundColor ? { backgroundColor: left.button.backgroundColor } : undefined}
                  >
                    {left.button.text}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Centered Layout */
          <div className="text-center space-y-5 max-w-3xl mx-auto">
            {(left || courseData) && (
              <>
                <HeroTags tags={courseData?.tags} textAlign={textAlign} />
                {heroTitle && (
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-catalogue-text-primary leading-tight tracking-tight">
                    {heroTitle}
                  </h1>
                )}
                <HeroMeta duration={courseData?.duration} instructor={courseData?.instructor} />
                <HeroDescription html={heroDescription} />
                {isHeroButtonEnabled(left?.button) && left?.button && (
                  <button
                    onClick={() => handleButtonClick(left.button!)}
                    className="catalogue-btn catalogue-btn-primary catalogue-btn-lg mt-4 shadow-lg transition-transform hover:-translate-y-0.5"
                    style={left.button.backgroundColor ? { backgroundColor: left.button.backgroundColor } : undefined}
                  >
                    {left.button.text}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

// Hero media — renders a single image, or an auto-advancing carousel when 2+
// images are configured. Resolves media IDs (non-http strings) to public URLs.
const HeroCarousel: React.FC<{
  images: Array<{ src: string; alt: string }>;
}> = ({ images }) => {
  const [resolved, setResolved] = useState<string[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let active = true;
    const resolveOne = async (src: string) => {
      if (!src || src.includes("/api/placeholder/") || src.startsWith("http")) {
        return src;
      }
      try {
        return await getPublicUrlWithoutLogin(src);
      } catch {
        return src;
      }
    };
    Promise.all(images.map((i) => resolveOne(i.src))).then((urls) => {
      if (active) setResolved(urls);
    });
    return () => {
      active = false;
    };
  }, [images]);

  const reduceMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (images.length <= 1 || reduceMotion) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % images.length),
      4500,
    );
    return () => clearInterval(id);
  }, [images.length, reduceMotion]);

  if (images.length === 0) return null;
  const srcs = images.map((img, i) => resolved[i] || img.src);

  if (images.length === 1) {
    return (
      <img
        src={srcs[0]}
        alt={images[0].alt}
        className="h-auto max-h-96 w-full rounded-xl object-contain shadow-md"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }

  return (
    <div className="group relative w-full overflow-hidden rounded-xl shadow-md">
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }} // design-lint-ignore: dynamic carousel offset
      >
        {srcs.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={images[i].alt}
            className="h-auto max-h-96 w-full shrink-0 object-contain"
          />
        ))}
      </div>

      {/* Dots */}
      <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={cn(
              "h-2 rounded-full bg-white transition-all duration-300",
              i === index ? "w-5" : "w-2 bg-white/60 hover:bg-white/80",
            )}
          />
        ))}
      </div>

      {/* Arrows (appear on hover) */}
      <button
        type="button"
        onClick={() =>
          setIndex((i) => (i - 1 + images.length) % images.length)
        }
        aria-label="Previous slide"
        className="absolute left-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-gray-700 opacity-0 shadow-sm transition hover:bg-white group-hover:opacity-100"
      >
        <CaretLeft size={16} weight="bold" />
      </button>
      <button
        type="button"
        onClick={() => setIndex((i) => (i + 1) % images.length)}
        aria-label="Next slide"
        className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-gray-700 opacity-0 shadow-sm transition hover:bg-white group-hover:opacity-100"
      >
        <CaretRight size={16} weight="bold" />
      </button>
    </div>
  );
};

// State management component - for valid images
const HeroSectionWithState: React.FC<{
  layout: "split" | "centered";
  left?: HeroSectionProps['left'];
  right?: HeroSectionProps['right'];
  courseData?: HeroSectionProps['courseData'];
  heroImage: string;
  heroImageAlt: string;
  heroBackgroundImage?: string;
  isHeroImagePlaceholder: boolean;
  isBackgroundImagePlaceholder: boolean;
  roundedEdges: boolean;
  textAlign: "left" | "center" | "right";
  heroTitle: string;
  heroDescription: string;
  backgroundColor?: string;
}> = ({
  layout,
  left,
  right,
  courseData,
  heroImage,
  heroImageAlt,
  isHeroImagePlaceholder,
  isBackgroundImagePlaceholder,
  heroBackgroundImage,
  roundedEdges,
  textAlign,
  heroTitle,
  heroDescription,
  backgroundColor,
}) => {
  const navigate = useNavigate();
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string>(heroImage);
  const [resolvedBgUrl, setResolvedBgUrl] = useState<string | null>(heroBackgroundImage || null);

  // Resolve image URLs
  useEffect(() => {
    if (isHeroImagePlaceholder && isBackgroundImagePlaceholder) return;

    let isMounted = true;
    
    const resolveImageUrl = async (imageUrl: string) => {
      if (!imageUrl || imageUrl.includes('/api/placeholder/') || imageUrl.includes('http')) {
        return imageUrl;
      }
      try {
        const resolvedUrl = await getPublicUrlWithoutLogin(imageUrl);
        return resolvedUrl || imageUrl;
      } catch {
        return imageUrl;
      }
    };

    const loadImages = async () => {
      if (!isHeroImagePlaceholder) {
        const resolvedUrl = await resolveImageUrl(heroImage);
        if (isMounted) setResolvedImageUrl(resolvedUrl);
      }
      if (!isBackgroundImagePlaceholder && heroBackgroundImage) {
        const resolvedBg = await resolveImageUrl(heroBackgroundImage);
        if (isMounted) setResolvedBgUrl(resolvedBg);
      }
    };

    loadImages();
    return () => { isMounted = false; };
  }, [heroImage, heroBackgroundImage, isHeroImagePlaceholder, isBackgroundImagePlaceholder]);

  const handleButtonClick = (button: { action: string; target: string }) => {
    if (button.action === "navigate" && button.target) {
      navigate({ to: button.target });
    } else if (button.action === "openLeadCollection") {
      window.dispatchEvent(new CustomEvent('openLeadCollection', { detail: { source: 'heroSection' } }));
    }
  };

  const hasBgImage = !!(resolvedBgUrl && !isBackgroundImagePlaceholder);

  // Build the hero media list: explicit carousel images (2+ → carousel) or
  // fall back to the single resolved image. 0 → no media slot.
  const carouselImages = (right?.images || [])
    .map((im) => ({ src: im.image || "", alt: im.alt || heroImageAlt }))
    .filter((im) => im.src && !isPlaceholderImage(im.src));
  const heroMedia =
    carouselImages.length > 0
      ? carouselImages
      : heroImage && !isHeroImagePlaceholder
        ? [{ src: resolvedImageUrl || heroImage, alt: heroImageAlt }]
        : [];

  // Course-details hero (gets courseData) uses the new wider 5/7 split + meta.
  // The homepage / landing hero (no courseData) keeps the original 50/50 split.
  const isCourseDetail = !!courseData;

  return (
    <section
      className={cn("catalogue-hero-surface w-full overflow-hidden py-14 md:py-24", roundedEdges && "rounded-lg")}
      style={{ // design-lint-ignore: dynamic admin alignment + background image/colour
        textAlign,
        backgroundColor: !hasBgImage && backgroundColor ? backgroundColor : undefined,
        ...(hasBgImage ? {
          backgroundImage: `url(${resolvedBgUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : {}),
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {layout === "split" ? (
          /* Course-details: 12-col grid (content 5 / banner 7). Homepage: 50/50. */
          <div
            className={cn(
              "grid grid-cols-1 gap-8 lg:gap-12 items-center",
              isCourseDetail ? "lg:grid-cols-12" : "lg:grid-cols-2",
            )}
          >
            {/* Left Content — 5/12 on desktop */}
            {(left || courseData) && (
              <div className={cn("space-y-4", isCourseDetail ? (heroMedia.length > 0 ? "lg:col-span-5" : "lg:col-span-12") : "")}>
                <HeroTags tags={courseData?.tags} textAlign={textAlign} />
                {heroTitle && (
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-catalogue-text-primary leading-tight tracking-tight">
                    {heroTitle}
                  </h1>
                )}
                <HeroMeta duration={courseData?.duration} instructor={courseData?.instructor} />
                <HeroDescription html={heroDescription} />
                {isHeroButtonEnabled(left?.button) && left?.button && (
                  <button
                    onClick={() => handleButtonClick(left.button!)}
                    className="catalogue-btn catalogue-btn-primary catalogue-btn-lg mt-4 shadow-lg transition-transform hover:-translate-y-0.5"
                    style={left.button.backgroundColor ? { backgroundColor: left.button.backgroundColor } : undefined}
                  >
                    {left.button.text}
                  </button>
                )}
              </div>
            )}

            {/* Right Content — 7/12 on desktop: wider column gives the banner more room */}
            {heroMedia.length > 0 && (
              <div className={cn("flex w-full items-center justify-center lg:justify-end", isCourseDetail && "lg:col-span-7")}>
                <HeroCarousel images={heroMedia} />
              </div>
            )}
          </div>
        ) : (
          /* Centered Layout */
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            {(left || courseData) && (
              <>
                <HeroTags tags={courseData?.tags} textAlign={textAlign} />
                {heroTitle && (
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-catalogue-text-primary leading-tight tracking-tight">
                    {heroTitle}
                  </h1>
                )}
                <HeroMeta duration={courseData?.duration} instructor={courseData?.instructor} />
                <HeroDescription html={heroDescription} />
                {isHeroButtonEnabled(left?.button) && left?.button && (
                  <button
                    onClick={() => handleButtonClick(left.button!)}
                    className="catalogue-btn catalogue-btn-primary catalogue-btn-lg mt-4 shadow-lg transition-transform hover:-translate-y-0.5"
                    style={left.button.backgroundColor ? { backgroundColor: left.button.backgroundColor } : undefined}
                  >
                    {left.button.text}
                  </button>
                )}
              </>
            )}
            {/* Centered media — image or carousel below the text */}
            {heroMedia.length > 0 && (
              <div className="mx-auto mt-8 w-full max-w-2xl">
                <HeroCarousel images={heroMedia} />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
