import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  COURSE_CATALOG_SORT_OPTIONS,
  CourseCatalogProps,
  CourseCatalogSortOption,
  DEFAULT_COURSE_CATALOG_SORT,
} from "../../-types/course-catalogue-types";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import {
  clearCourseFinderOptions,
  publishCourseFinderOptions,
} from "../../-utils/course-finder-bus";
import { urlCourseDetails } from "@/constants/urls";
import axios from "axios";
import { Button } from "@/components/ui/button";
import {
  Funnel,
  CaretDown,
  CaretUp,
  CaretLeft,
  CaretRight,
  MagnifyingGlass,
  SortAscending,
  ShoppingCart,
  Plus,
  Minus,
  BookOpen,
  X,
  Clock,
  ChartBarHorizontal,
} from "@phosphor-icons/react";
import { cn, toTitleCase, compareByNameNatural } from "@/lib/utils";
import { useCartStore, CartItem } from "../../-stores/cart-store";
import { toast } from "sonner";
import {
  getTerminology,
  getTerminologyPlural,
} from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, RoleTerms, SystemTerms } from "@/types/naming-settings";
import { OfferBadge, PriceWithMrp } from "@/components/common/price-with-mrp";
import { resolveInviteAvailability } from "@/lib/invite-availability";

// The catalogue JSON is authored by hand and by the AI page builder, so treat
// defaultSort as untrusted: anything outside the known sort modes would leave
// the dropdown showing a value the sort switch never matches, silently
// disabling sorting. Unknown values fall back to the historic default.
const resolveDefaultSort = (value?: string): CourseCatalogSortOption =>
  COURSE_CATALOG_SORT_OPTIONS.includes(value as CourseCatalogSortOption)
    ? (value as CourseCatalogSortOption)
    : DEFAULT_COURSE_CATALOG_SORT;

// Compact, scaling page list with ellipsis. Always keeps a consistent number
// of controls (~6-7) no matter how many pages there are — so the catalogue can
// grow to hundreds of pages without the pagination ever overflowing.
//   near start:  [1, 2, 3, 4, …, 50]
//   middle:      [1, …, 24, 25, 26, …, 50]
//   near end:    [1, …, 47, 48, 49, 50]
const getPageNumbers = (current: number, total: number): (number | "...")[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, "...", total];
  if (current >= total - 2)
    return [1, "...", total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
};
// EnrollmentPaymentDialog import removed - not used in catalog

type PriceRangeState = { min?: number; max?: number } | null;

// Backend sometimes stores sentinel level names (e.g. "default") that must not
// surface as a UI badge. Hide sentinels; title-case genuine values.
const SENTINEL_LEVEL_NAMES = new Set([
  "default",
  "none",
  "null",
  "undefined",
  "",
]);
const displayLevelName = (raw?: string | null): string => {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (SENTINEL_LEVEL_NAMES.has(trimmed.toLowerCase())) return "";
  return toTitleCase(trimmed);
};

// CourseImage component that handles image resolution like study library
interface CourseImageProps {
  previewImageUrl: string;
  alt: string;
  className?: string;
}

const CoursePlaceholder: React.FC<{ title: string }> = ({ title }) => (
  <div className="aspect-video w-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
    <BookOpen size={40} className="text-primary/60" />
    <span className="text-xs font-medium text-primary/70 px-3 text-center line-clamp-1">
      {title}
    </span>
  </div>
);

const CourseImage: React.FC<CourseImageProps> = ({
  previewImageUrl,
  alt,
  className,
}) => {
  const isPlaceholder =
    !previewImageUrl ||
    previewImageUrl.includes("/api/placeholder/") ||
    previewImageUrl.trim() === "" ||
    previewImageUrl === "null" ||
    previewImageUrl === "undefined";

  if (isPlaceholder) {
    return <CoursePlaceholder title={alt} />;
  }

  return (
    <CourseImageWithState
      previewImageUrl={previewImageUrl}
      alt={alt}
      className={className}
    />
  );
};

// Separate component for handling actual image loading
const CourseImageWithState: React.FC<CourseImageProps> = ({
  previewImageUrl,
  alt,
  className,
}) => {
  const { t } = useTranslation("coursePlayerB");
  const [courseImageUrl, setCourseImageUrl] = useState<string>("");
  const [loadingImage, setLoadingImage] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoadingImage(true);
      setImageError(false);

      try {
        // console.log("[CourseImage] Calling getPublicUrlWithoutLogin with:", previewImageUrl);
        const url = await getPublicUrlWithoutLogin(previewImageUrl);
        // console.log("[CourseImage] Got URL from API:", url);
        if (isMounted) {
          if (url) {
            setCourseImageUrl(url);
            setImageError(false);
          } else {
            setImageError(true);
            setCourseImageUrl("");
          }
        }
      } catch (error) {
        console.error("[CourseImage] Error getting public URL:", error);
        if (isMounted) {
          setImageError(true);
          setCourseImageUrl("");
        }
      } finally {
        if (isMounted) {
          setLoadingImage(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [previewImageUrl]);

  if (imageError || (!loadingImage && !courseImageUrl)) {
    return <CoursePlaceholder title={alt} />;
  }

  // Show loading placeholder while loading
  if (loadingImage && !courseImageUrl) {
    return (
      <div className="aspect-video">
        <div className="w-full h-full bg-catalogue-bg-muted animate-pulse rounded-md flex items-center justify-center">
          <div className="text-catalogue-text-muted text-xs">
            {t("courseCatalog.loadingImage")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-video">
      <img
        src={courseImageUrl}
        alt={alt}
        className={className}
        loading="lazy"
        onError={() => {
          setImageError(true);
          setCourseImageUrl("");
        }}
        onLoad={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        style={{
          opacity: 1,
          transition: "opacity 0.2s ease",
        }}
      />
    </div>
  );
};

interface CourseCatalogComponentProps extends CourseCatalogProps {
  instituteId: string;
  tagName: string;
  globalSettings?: any;
  cartButtonConfig?: {
    enabled?: boolean;
    showAddToCartButton?: boolean;
    showQuantitySelector?: boolean;
    quantityMin?: number;
  };
}

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  price: number;
  elevatedPrice?: number;
  type: string;
  level: string;
  instructor: string;
  duration: string;
  rating: number;
  // Allow any additional fields from API response
  currency?: string;
  [key: string]: any;
}

interface FilterSectionProps {
  title: string;
  items: { id: string; name: string }[];
  selectedItems: string[];
  handleChange: (itemId: string) => void;
  disabled?: boolean;
}

const FilterSection: React.FC<FilterSectionProps> = ({
  title,
  items,
  selectedItems,
  handleChange,
  disabled,
}) => {
  const { t } = useTranslation("coursePlayerB");
  const [isExpanded, setIsExpanded] = useState(false);
  const initialDisplayCount = 3;
  const canExpand = items.length > initialDisplayCount;
  const itemsToDisplay =
    canExpand && !isExpanded ? items.slice(0, initialDisplayCount) : items;

  return (
    <div className="mb-5">
      <h3 className="text-sm font-semibold text-catalogue-text-primary mb-2.5">{title}</h3>
      <div className="space-y-1.5">
        {items.length === 0 && !disabled && (
          <p className="text-xs text-catalogue-text-muted">
            {t("courseCatalog.noItemsAvailable", { title: title.toLowerCase() })}
          </p>
        )}
        {disabled && (
          <p className="text-xs text-catalogue-text-muted">
            {t("courseCatalog.filtersUnavailable", { title })}
          </p>
        )}
        {itemsToDisplay.map((item) => (
          <label
            key={item.id}
            className={`flex items-center text-catalogue-text-secondary hover:text-catalogue-text-primary transition-colors ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          >
            <input
              type="checkbox"
              className="form-checkbox h-3.5 w-3.5 text-primary-500 border-catalogue-border rounded focus:ring-primary-400 me-2"
              checked={selectedItems.includes(item.id)}
              onChange={() => handleChange(item.id)}
              disabled={disabled}
            />
            <span className="text-sm">{item.name}</span>
          </label>
        ))}
      </div>

      {canExpand && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={disabled}
          className={`text-xs mt-2 flex items-center gap-1 font-medium ${
            disabled
              ? "text-catalogue-text-muted cursor-not-allowed"
              : "text-primary-500 hover:text-primary-400"
          }`}
        >
          {isExpanded ? (
            <>
              {t("courseCatalog.showLess")}
              <CaretUp size={12} />
            </>
          ) : (
            <>
              {t("courseCatalog.showMore")}
              <CaretDown size={12} />
            </>
          )}
        </button>
      )}
    </div>
  );
};

// Helper component for cart button/quantity controls
const CartControls: React.FC<{
  course: Course;
  globalSettings?: any;
  cartButtonConfig?: {
    enabled?: boolean;
    showAddToCartButton?: boolean;
    showQuantitySelector?: boolean;
    quantityMin?: number;
  };
  addItem: (item: Omit<CartItem, "quantity">) => void;
  getItemByEnrollInviteId: (enrollInviteId: string) => CartItem | undefined;
  updateQuantity: (enrollInviteId: string, quantity: number) => void;
  removeItem: (enrollInviteId: string) => void;
}> = ({
  course,
  globalSettings,
  cartButtonConfig,
  addItem,
  getItemByEnrollInviteId,
  updateQuantity,
  removeItem,
}) => {
  const { t } = useTranslation("coursePlayerB");
  const cartItem = course.enrollInviteId
    ? getItemByEnrollInviteId(course.enrollInviteId)
    : undefined;
  const quantityMin = cartButtonConfig?.quantityMin ?? 1;
  const showAddToCartButton = cartButtonConfig?.showAddToCartButton !== false;
  const showQuantitySelector = cartButtonConfig?.showQuantitySelector !== false;

  // Only hide if payment is explicitly disabled AND cartButtonConfig is not provided
  // If cartButtonConfig is provided, always show the button (even for free courses)
  if (
    !cartButtonConfig &&
    (globalSettings?.payment?.enabled === false || course.price <= 0)
  ) {
    return null;
  }

  if (cartItem && showQuantitySelector) {
    return (
      <div className="flex items-center gap-1 border border-catalogue-border rounded-md px-1 py-0.5 bg-catalogue-bg-elevated">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-catalogue-interactive-hover"
          onClick={(e) => {
            e.stopPropagation();
            if (cartItem && course.enrollInviteId) {
              if (cartItem.quantity > quantityMin) {
                updateQuantity(course.enrollInviteId, cartItem.quantity - 1);
              } else {
                removeItem(course.enrollInviteId);
                toast.success(t("courseCatalog.removedFromCart", { title: course.title }));
              }
            }
          }}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="min-w-6 text-center font-medium text-catalogue-text-primary text-xs">
          {cartItem.quantity}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-catalogue-interactive-hover"
          onClick={(e) => {
            e.stopPropagation();
            if (cartItem && course.enrollInviteId) {
              updateQuantity(course.enrollInviteId, cartItem.quantity + 1);
            }
          }}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    );
  } else if (!cartItem && showAddToCartButton) {
    return (
      <Button
        onClick={(e) => {
          e.stopPropagation();
          if (!course.enrollInviteId) {
            toast.error(t("courseCatalog.missingEnrollInvite"));
            return;
          }
          addItem({
            id: course.id,
            title: course.title,
            price: course.price,
            elevatedPrice: course.elevatedPrice,
            currency: course.currency,
            image: course.thumbnail,
            level: course.level,
            packageSessionId: course.packageSessionId,
            enrollInviteId: course.enrollInviteId,
            levelId: course.levelId,
            sessionId: course.sessionId,
            sessionName: course.sessionName,
            courseId: course.courseId,
          });
          toast.success(t("courseCatalog.addedToCart", { title: course.title }));
        }}
        className="bg-primary-500 hover:bg-primary-400 text-white text-xs font-medium rounded-md px-2.5 py-1 flex items-center justify-center gap-1.5"
        size="sm"
      >
        <ShoppingCart className="h-3.5 w-3.5" />
        <span>{t("courseCatalog.add")}</span>
      </Button>
    );
  }

  // Don't render anything if both are disabled
  return null;
};

// ─── Category color palette (deterministic, JIT-safe literal strings) ────────
const CATEGORY_PALETTE = [
  { band: "from-violet-100 to-violet-50", text: "text-violet-600", icon: "text-violet-400" },
  { band: "from-teal-100 to-teal-50",    text: "text-teal-600",   icon: "text-teal-400"   },
  { band: "from-amber-100 to-amber-50",  text: "text-amber-600",  icon: "text-amber-400"  },
  { band: "from-pink-100 to-pink-50",    text: "text-pink-600",   icon: "text-pink-400"   },
  { band: "from-blue-100 to-blue-50",    text: "text-blue-600",   icon: "text-blue-400"   },
  { band: "from-emerald-100 to-emerald-50", text: "text-emerald-600", icon: "text-emerald-400" },
  { band: "from-orange-100 to-orange-50", text: "text-orange-600", icon: "text-orange-400" },
  { band: "from-indigo-100 to-indigo-50", text: "text-indigo-600", icon: "text-indigo-400" },
] as const;

function getCategoryStyle(key: string) {
  if (!key) return CATEGORY_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
}
// ─────────────────────────────────────────────────────────────────────────────

export const CourseCatalogComponent: React.FC<CourseCatalogComponentProps> = ({
  title,
  showFilters,
  filtersConfig,
  cartButtonConfig,
  render,
  defaultSort,
  instituteId,
  tagName,
  globalSettings,
}) => {
  const { t } = useTranslation("coursePlayerB");
  const navigate = useNavigate();
  const {
    addItem,
    getItemByEnrollInviteId,
    updateQuantity,
    removeItem,
    getItemCount,
  } = useCartStore();

  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  // Opening sort comes from the catalogue JSON so each institute picks its own
  // (e.g. "Price: Low to High" leads with free courses, since price 0 sorts
  // first). Sorting runs before pagination, so the choice holds across the
  // whole catalogue rather than just the visible page.
  const [sortOption, setSortOption] = useState<CourseCatalogSortOption>(() =>
    resolveDefaultSort(defaultSort),
  );

  // The page-builder preview pushes config updates into a mounted tree, so the
  // initial state above would never see a newly picked default. Re-seed only
  // when the configured value itself changes — a learner's own dropdown choice
  // is never clobbered, since re-renders carry the same string.
  useEffect(() => {
    setSortOption(resolveDefaultSort(defaultSort));
  }, [defaultSort]);

  // Filter states
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedInstructors, setSelectedInstructors] = useState<string[]>([]);

  // Mobile filter state
  const [isMobileFilterExpanded, setIsMobileFilterExpanded] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Derive filter options from loaded courses (before shouldShow* checks)
  const levels = useMemo(
    () =>
      [...new Set(courses.map((c) => c.level).filter(Boolean))]
        .filter((level) => displayLevelName(level))
        .map((level) => ({ id: level, name: displayLevelName(level) }))
        // Sort naturally so the filter list is stable and reads sensibly
        // (Class 6, 7, 8 … 12, then non-numeric levels) regardless of the
        // order courses arrive from the API.
        .sort(compareByNameNatural),
    [courses],
  );
  const sessions = useMemo(() => {
    const byId = new Map<string, string>();
    courses.forEach((c) => {
      if (c.sessionId && !byId.has(c.sessionId)) {
        byId.set(c.sessionId, c.sessionName || c.sessionId);
      }
    });
    return Array.from(byId.entries())
      .map(([id, name]) => ({ id, name: toTitleCase(name) }))
      .sort(compareByNameNatural);
  }, [courses]);
  const tags = useMemo(
    () =>
      [
        ...new Set(
          courses
            .flatMap(
              (c) =>
                c.comma_separeted_tags
                  ?.split(",")
                  .map((t: string) => t.trim()) || [],
            )
            .filter(Boolean),
        ),
      ].map((tag) => ({ id: tag, name: tag })),
    [courses],
  );
  const instructors = useMemo(
    () =>
      [...new Set(courses.map((c) => c.instructor).filter(Boolean))].map(
        (instructor) => ({ id: instructor, name: instructor }),
      ),
    [courses],
  );

  // Broadcast this block's own filter options up to the page-level Course
  // Finder wizard (CourseCataloguePage), and apply whatever the wizard picks
  // back into local filter state. Cross-tree communication uses the same
  // window-event pattern as openLeadCollection/openAudienceForm elsewhere in
  // this route — the wizard lives outside the JsonRenderer tree, so props
  // can't reach it directly. Sourcing options from THIS component's own
  // levels/sessions/tags (rather than a separate institute-wide fetch) keeps
  // the wizard's picks guaranteed compatible with this component's own id/name
  // conventions (levels match by name, tags are raw case-sensitive strings).
  useEffect(() => {
    if (courses.length === 0) return;
    publishCourseFinderOptions({ levels, sessions, tags });
  }, [courses.length, levels, sessions, tags]);

  // Drop the retained payload when this grid goes away, so a different
  // catalogue page never opens its wizard on this one's levels.
  useEffect(() => clearCourseFinderOptions, []);

  useEffect(() => {
    const handleApplied = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setSelectedLevels(Array.isArray(detail.levels) ? detail.levels : []);
      setSelectedSessions(Array.isArray(detail.sessions) ? detail.sessions : []);
      setSelectedTags(Array.isArray(detail.tags) ? detail.tags : []);
    };
    window.addEventListener("courseFinderApplied", handleApplied);
    return () => window.removeEventListener("courseFinderApplied", handleApplied);
  }, []);

  // Enrollment dialog state
  // Removed enrollment dialog state - all enrollment happens on details page

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const cardFieldsSet = useMemo(
    () =>
      new Set((render?.cardFields ?? []).map((field) => field.toLowerCase())),
    [render?.cardFields],
  );

  const isCardFieldEnabled = (field: string) =>
    cardFieldsSet.size === 0 || cardFieldsSet.has(field.toLowerCase());

  const displayTitle = isCardFieldEnabled("package_name");
  const displayDescription = isCardFieldEnabled("course_html_description_html");
  const displayImage = isCardFieldEnabled("course_preview_image_media_id");
  const displayLevel = isCardFieldEnabled("level_name");
  const displayPrice = isCardFieldEnabled("price");
  const displayQuantity = isCardFieldEnabled("quantity");
  const displayCartActions = isCardFieldEnabled("cart_actions");

  // Determine if cart controls should be shown
  const shouldShowCartControls = useMemo(() => {
    // Priority 1: If cartButtonConfig is explicitly disabled, don't show
    if (cartButtonConfig?.enabled === false) {
      return false;
    }

    // Priority 2: If "cart_actions" is in cardFields, always show (highest priority)
    if (displayCartActions) {
      return true;
    }

    // Priority 3: If cartButtonConfig exists (even if enabled is not explicitly set), show it
    if (cartButtonConfig) {
      return true;
    }

    // Priority 4: If "quantity" is in cardFields (backward compatibility), show it
    if (displayQuantity) {
      return true;
    }

    // Default: don't show if nothing is configured
    return false;
  }, [cartButtonConfig, displayCartActions, displayQuantity]);

  const filtersEnabled = showFilters !== false;
  const filterIds = useMemo(
    () => new Set((filtersConfig ?? []).map((filter) => filter.id)),
    [filtersConfig],
  );
  const defaultToAllFilters = filterIds.size === 0;

  // How a course preview image sits in the card's image band. `cover` (default)
  // fills it but crops — fine for photos, destructive for wide marketing
  // banners whose edges carry the logo and headline. `contain` shows the whole
  // artwork. Authored per catalogue so institutes with banner-style artwork can
  // opt in without changing anyone else's grid.
  const imageFit: "cover" | "contain" =
    (render?.styles as { imageFit?: "cover" | "contain" } | undefined)
      ?.imageFit === "contain"
      ? "contain"
      : "cover";
  const shouldShowLevelFilter =
    filtersEnabled &&
    (defaultToAllFilters || filterIds.has("level")) &&
    levels.length > 1;
  const shouldShowSessionFilter =
    filtersEnabled &&
    (defaultToAllFilters || filterIds.has("session")) &&
    sessions.length > 1;
  // Tags are intentionally NOT gated on filtersConfig: the page-builder default
  // template ships filtersConfig=[{level}] and there is no admin UI to add a
  // "tags" entry yet, so gating would hide tags on every catalogue. Show the Tags
  // filter whenever filters are enabled and the loaded courses carry any tags.
  const shouldShowTagsFilter = filtersEnabled && tags.length > 0;
  const shouldShowInstructorFilter =
    filtersEnabled &&
    (defaultToAllFilters ||
      filterIds.has("instructors") ||
      filterIds.has("authors")) &&
    instructors.length > 1;
  const priceFilterConfig = useMemo(
    () =>
      filtersEnabled
        ? (filtersConfig ?? []).find(
            (filter) => filter.type === "range" && filter.field === "price",
          )
        : undefined,
    [filtersConfig, filtersEnabled],
  );
  const shouldShowPriceFilter = filtersEnabled && Boolean(priceFilterConfig);
  const hasFiltersToShow =
    shouldShowLevelFilter ||
    shouldShowSessionFilter ||
    shouldShowTagsFilter ||
    shouldShowInstructorFilter ||
    shouldShowPriceFilter;
  const shouldRenderFiltersPanel = filtersEnabled && hasFiltersToShow;

  const defaultPriceRange = useMemo<PriceRangeState>(() => {
    if (!priceFilterConfig?.default) {
      return null;
    }
    const { min, max } = priceFilterConfig.default;
    const normalized: PriceRangeState = {};
    if (typeof min === "number") {
      normalized.min = min;
    }
    if (typeof max === "number") {
      normalized.max = max;
    }
    return normalized.min !== undefined || normalized.max !== undefined
      ? normalized
      : null;
  }, [priceFilterConfig]);

  const [priceRange, setPriceRange] =
    useState<PriceRangeState>(defaultPriceRange);

  useEffect(() => {
    setPriceRange(defaultPriceRange);
  }, [defaultPriceRange]);

  const handlePriceInputChange = (key: "min" | "max", value: string) => {
    setPriceRange((prev) => {
      const numericValue = value === "" ? undefined : Number(value);
      const updated: { min?: number; max?: number } = { ...(prev || {}) };
      if (numericValue === undefined || Number.isNaN(numericValue)) {
        delete updated[key];
      } else {
        updated[key] = numericValue;
      }
      return updated.min === undefined && updated.max === undefined
        ? null
        : updated;
    });
  };

  const isPriceFilterActive = useMemo(() => {
    if (!priceRange) {
      return false;
    }
    if (!defaultPriceRange) {
      return priceRange.min !== undefined || priceRange.max !== undefined;
    }
    return (
      priceRange.min !== defaultPriceRange.min ||
      priceRange.max !== defaultPriceRange.max
    );
  }, [priceRange, defaultPriceRange]);

  // Check for level filter from sessionStorage on mount
  useEffect(() => {
    const levelFilter = sessionStorage.getItem("levelFilter");
    if (levelFilter) {
      // Set the level filter and clear it from sessionStorage after use
      console.log(
        "[CourseCatalogComponent] Applying level filter from sessionStorage:",
        levelFilter,
      );
      // Normalize the filter value to match the case in course data
      // We'll find the actual case from the courses once they load
      setSelectedLevels([levelFilter]);
      sessionStorage.removeItem("levelFilter");
    }
  }, []);

  // Normalize selectedLevels to match actual level values from courses (case-insensitive matching)
  useEffect(() => {
    if (courses.length > 0 && selectedLevels.length > 0) {
      const actualLevels = [...new Set(courses.map((course) => course.level))];
      const normalizedLevels = selectedLevels.map((selected) => {
        // Find the actual level value that matches (case-insensitive)
        const matched = actualLevels.find(
          (actual) => actual?.toLowerCase() === selected?.toLowerCase(),
        );
        return matched || selected; // Use matched value or keep original
      });

      // Only update if there's a difference (to avoid infinite loop)
      if (
        normalizedLevels.some((level, idx) => level !== selectedLevels[idx])
      ) {
        setSelectedLevels(normalizedLevels);
      }
    }
  }, [courses, selectedLevels.length]); // Only run when courses load or selectedLevels count changes

  // Fetch courses from API
  useEffect(() => {
    const fetchCourses = async () => {
      setIsLoading(true);
      try {
        const response = await axios.post(
          urlCourseDetails,
          {
            status: [],
            level_ids: [],
            faculty_ids: [],
            search_by_name: "",
            tag: [],
            min_percentage_completed: 0,
            max_percentage_completed: 0,
          },
          {
            params: {
              instituteId: instituteId,
              page: 0,
              // Load the full catalogue so client-side filters, search and
              // pagination span every course. The API is server-paginated;
              // fetching a single 50-item page previously capped the UI at ~6
              // pages even when the institute had many more courses.
              // TODO: move to true server-side pagination + facets.
              size: 1000,
              sort: "createdAt,desc",
            },
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        // Transform API response to Course interface
        const apiCourses = response.data?.content || response.data || [];

        if (apiCourses.length > 0) {
          // Check for enroll_invite_id in the first course
        }
        const transformedCourses: Course[] = apiCourses.map((course: any) => {
          // Get the raw media ID (same priority as study library)
          const thumbnailField =
            course.course_preview_image_media_id ||
            course.course_banner_media_id ||
            course.thumbnail_file_id;
          const thumbnailUrl = thumbnailField || "/api/placeholder/300/200";

          // Parse HTML content safely
          const parseHtmlContent = (htmlString: string) => {
            if (!htmlString) return "";
            return htmlString
              .replace(/<[^>]*>/g, "")
              .replace(/&nbsp;/g, " ")
              .trim();
          };

          // Get pricing from search API response
          // For course catalog, we use min_plan_actual_price from search API
          // This should already be the minimum price from all available plans
          const finalPrice = course.min_plan_actual_price || 0;
          const elevatedPrice =
            typeof course.min_plan_elevated_price === "number"
              ? course.min_plan_elevated_price
              : undefined;
          const isFree = finalPrice === 0;

          return {
            id: course.id || course.packageId,
            title:
              course.package_name ||
              t("courseCatalog.untitledCourse", {
                course: getTerminology(ContentTerms.Course, SystemTerms.Course),
              }),
            description:
              parseHtmlContent(course.course_html_description_html) ||
              t("courseCatalog.noDescriptionAvailable"),
            thumbnail: thumbnailUrl,
            bannerImage: thumbnailUrl, // Use the same image as banner for details page
            price: finalPrice,
            elevatedPrice,
            currency: course.currency,
            type: course.package_type || course.type || "General",
            level: course.level_name || "Beginner",
            instructor:
              course.instructors?.[0]?.full_name ||
              t("courseCatalog.unknownInstructor", {
                teacher: getTerminology(RoleTerms.Teacher, SystemTerms.Teacher),
              }),
            duration:
              course.estimated_duration || course.duration || "",
            rating: course.rating || 0,
            packageSessionId: course.package_session_id,
            enrollInviteId: course.enroll_invite_id, // Use real enroll_invite_id from API
            sessionId: course.session_id,
            sessionName: course.session_name,
            // Add all other fields from the API response for dynamic filtering
            ...course,
          };
        });

        if (
          typeof response.data?.totalElements === "number" &&
          response.data.totalElements > transformedCourses.length
        ) {
          console.warn(
            `[CourseCatalogComponent] Loaded ${transformedCourses.length} of ${response.data.totalElements} courses — raise the fetch size for full pagination.`,
          );
        }
        setCourses(transformedCourses);
        setFilteredCourses(transformedCourses);
      } catch (error) {
        console.error(
          "[CourseCatalogComponent] Error fetching courses:",
          error,
        );
        setCourses([]);
        setFilteredCourses([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourses();
  }, [instituteId]);

  // Filter and sort courses
  useEffect(() => {
    let filtered = [...courses];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (course) =>
          course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          course.description.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Apply level filter
    if (selectedLevels.length > 0) {
      filtered = filtered.filter((course) => {
        // Check if any selected level matches the course's level field
        const matchesLevel = selectedLevels.includes(course.level);

        // For Buy/Rent filters, also check level_name field directly from API
        // since "Buy" and "Rent" might be stored in level_name
        const isBuyRentFilter = selectedLevels.some(
          (level) =>
            level?.toLowerCase() === "buy" || level?.toLowerCase() === "rent",
        );

        if (isBuyRentFilter) {
          // Check multiple possible fields where Buy/Rent might be stored
          const levelName = (course.level_name || course.level || "")
            .toString()
            .trim();
          const courseType = (course.type || course.package_type || "")
            .toString()
            .trim();

          const matchesBuyRent = selectedLevels.some((level) => {
            const filterValue = level.toString().trim();
            return (
              levelName.toLowerCase() === filterValue.toLowerCase() ||
              courseType.toLowerCase() === filterValue.toLowerCase() ||
              // Also check if any field in the course object contains Buy/Rent
              Object.values(course).some(
                (val) =>
                  val &&
                  val.toString().toLowerCase() === filterValue.toLowerCase(),
              )
            );
          });

          if (matchesBuyRent) {
            return true;
          }
        }

        return matchesLevel;
      });
    }

    // Apply session filter
    if (selectedSessions.length > 0) {
      filtered = filtered.filter(
        (course) => course.sessionId && selectedSessions.includes(course.sessionId),
      );
    }

    // Apply tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter((course) => {
        const courseTags =
          course.comma_separeted_tags
            ?.split(",")
            .map((tag: string) => tag.trim()) || [];
        return selectedTags.some((tag) => courseTags.includes(tag));
      });
    }

    // Apply instructor filter
    if (selectedInstructors.length > 0) {
      filtered = filtered.filter((course) =>
        selectedInstructors.includes(course.instructor),
      );
    }

    // Apply price range filter
    if (
      shouldShowPriceFilter &&
      priceRange &&
      (priceRange.min !== undefined || priceRange.max !== undefined)
    ) {
      filtered = filtered.filter((course) => {
        const coursePrice =
          typeof course.price === "number"
            ? course.price
            : Number(course.price) || 0;
        const meetsMin =
          priceRange.min !== undefined ? coursePrice >= priceRange.min : true;
        const meetsMax =
          priceRange.max !== undefined ? coursePrice <= priceRange.max : true;
        return meetsMin && meetsMax;
      });
    }

    // Apply sorting
    switch (sortOption) {
      case "Newest":
        filtered.sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        );
        break;
      case "Oldest":
        filtered.sort(
          (a, b) =>
            new Date(a.createdAt || 0).getTime() -
            new Date(b.createdAt || 0).getTime(),
        );
        break;
      case "Price: Low to High":
        filtered.sort((a, b) => a.price - b.price);
        break;
      case "Price: High to Low":
        filtered.sort((a, b) => b.price - a.price);
        break;
      case "Rating":
        filtered.sort((a, b) => b.rating - a.rating);
        break;
      case "Name A-Z":
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "Name Z-A":
        filtered.sort((a, b) => b.title.localeCompare(a.title));
        break;
    }

    setFilteredCourses(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [
    courses,
    searchTerm,
    selectedLevels,
    selectedSessions,
    selectedTags,
    selectedInstructors,
    sortOption,
    priceRange,
    shouldShowPriceFilter,
  ]);

  // Pagination
  const paginatedCourses = filteredCourses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );
  const totalPages = Math.ceil(filteredCourses.length / itemsPerPage);

  // Smooth scroll on page change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [currentPage]);

  // Helper function to toggle item in array
  const toggleItem = (
    itemId: string,
    list: string[],
    setter: (newList: string[]) => void,
  ) => {
    if (list.includes(itemId)) {
      setter(list.filter((i) => i !== itemId));
    } else {
      setter([...list, itemId]);
    }
  };

  const clearAllFilters = () => {
    setSelectedLevels([]);
    setSelectedSessions([]);
    setSelectedTags([]);
    setSelectedInstructors([]);
    setSearchTerm("");
    setPriceRange(defaultPriceRange);
  };

  const onApplyFilters = () => {
    // Filters are applied automatically via useEffect
    setIsMobileFilterExpanded(false);
  };

  const handleCourseClick = (course: Course) => {
    // All courses navigate to details page with enroll_invite_id
    // Pass enroll_invite_id, banner image, and level as search params so details page can use them
    const searchParams = new URLSearchParams();
    if (course.enrollInviteId) {
      searchParams.set("enrollInviteId", course.enrollInviteId);
    }
    if (course.packageSessionId) {
      searchParams.set("packageSessionId", course.packageSessionId);
    }
    if (course.bannerImage) {
      searchParams.set("bannerImage", course.bannerImage);
    }
    if (course.level) {
      searchParams.set("level", course.level);
    }

    navigate({
      to: `/${tagName}/${course.id}`,
      search: searchParams.toString()
        ? {
            enrollInviteId: course.enrollInviteId,
            packageSessionId: course.packageSessionId,
            bannerImage: course.bannerImage,
            level: course.level,
          }
        : {},
    });
  };

  const filterBadgeCount =
    selectedLevels.length +
    selectedSessions.length +
    selectedTags.length +
    selectedInstructors.length +
    (shouldShowPriceFilter && isPriceFilterActive ? 1 : 0);
  const hasActiveFilters = filterBadgeCount > 0;

  if (isLoading) {
    return (
      <div className="py-8 sm:py-10 w-full bg-catalogue-bg-subtle">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="catalogue-skeleton-shimmer h-8 w-48 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="catalogue-card-elevated overflow-hidden"
              >
                <div className="catalogue-skeleton-shimmer h-44 w-full rounded-none"></div>
                <div className="flex flex-col gap-2.5 p-4">
                  <div className="catalogue-skeleton-shimmer h-4 w-3/4"></div>
                  <div className="catalogue-skeleton-shimmer h-3 w-full"></div>
                  <div className="catalogue-skeleton-shimmer h-5 w-1/3 mt-1"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="py-8 sm:py-10 bg-catalogue-bg-subtle w-full"
    >
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="mb-3 h-1 w-12 rounded-full bg-primary-400" />
          <h2 className="catalogue-h2 text-catalogue-text-primary">
            {title}
          </h2>
          {(render as { subtitle?: string } | undefined)?.subtitle && (
            <p className="mt-2 max-w-2xl text-sm sm:text-base text-catalogue-text-secondary">
              {(render as { subtitle?: string }).subtitle}
            </p>
          )}
        </div>

        <div
          className={`flex flex-col ${shouldRenderFiltersPanel ? "lg:flex-row" : ""} gap-4 lg:gap-6`}
        >
          {shouldRenderFiltersPanel && (
            <div className="w-full lg:w-64 lg:flex-shrink-0 order-1">
              <div className="lg:sticky lg:top-20">
                <div className="catalogue-surface p-4 sm:p-5 rounded-xl border border-catalogue-border-subtle shadow-sm">
                  {/* Mobile Header */}
                  <div className="lg:hidden mb-3">
                    <button
                      onClick={() =>
                        setIsMobileFilterExpanded(!isMobileFilterExpanded)
                      }
                      className="w-full flex items-center justify-between p-2 bg-catalogue-bg-subtle rounded-md hover:bg-catalogue-interactive-hover transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Funnel
                          size={16}
                          className="text-catalogue-text-secondary"
                        />
                        <span className="text-sm font-medium text-catalogue-text-primary">
                          {t("courseCatalog.filters")}
                        </span>
                        {hasActiveFilters && (
                          <span className="catalogue-badge catalogue-badge-primary rounded-full">
                            {filterBadgeCount}
                          </span>
                        )}
                      </div>
                      <CaretDown
                        size={14}
                        className={`text-catalogue-text-muted transition-transform ${isMobileFilterExpanded ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>

                  {/* Filter Content - Hidden on mobile when collapsed */}
                  <div
                    className={`lg:block ${isMobileFilterExpanded ? "block" : "hidden"}`}
                  >
                    {/* Desktop Header */}
                    <div className="hidden lg:flex justify-between items-center mb-6">
                      <h2 className="text-lg font-semibold text-catalogue-text-primary">
                        {t("courseCatalog.filters")}
                      </h2>
                      <div className="flex gap-1">
                        {/* Filters apply live on desktop, so no "Apply" button is needed. */}
                        <Button
                          onClick={clearAllFilters}
                          disabled={!hasActiveFilters}
                          className="px-2 py-1 h-fit transition text-xs mt-px"
                        >
                          {t("courseCatalog.clearAll")}
                        </Button>
                      </div>
                    </div>

                    {/* Mobile Header */}
                    <div className="lg:hidden flex justify-between items-center mb-4">
                      <h2 className="text-lg font-semibold text-catalogue-text-primary">
                        {t("courseCatalog.filters")}
                      </h2>
                      <div className="flex gap-1">
                        <Button
                          onClick={clearAllFilters}
                          disabled={!hasActiveFilters}
                          className="px-2 py-1 h-fit transition text-xs mt-px"
                        >
                          {t("courseCatalog.clearAll")}
                        </Button>
                        <Button
                          onClick={onApplyFilters}
                          className="px-2 py-1 h-fit transition text-xs mt-px"
                        >
                          {t("courseCatalog.showResults")}
                        </Button>
                      </div>
                    </div>

                    {shouldShowLevelFilter && (
                      <FilterSection
                        title={
                          filtersConfig?.find((filter) => filter.id === "level")
                            ?.label ??
                          getTerminology(ContentTerms.Level, SystemTerms.Level)
                        }
                        items={levels}
                        selectedItems={selectedLevels}
                        handleChange={(id) =>
                          toggleItem(id, selectedLevels, setSelectedLevels)
                        }
                        disabled={levels.length === 0}
                      />
                    )}

                    {shouldShowSessionFilter && (
                      <FilterSection
                        title={
                          filtersConfig?.find((filter) => filter.id === "session")
                            ?.label ??
                          getTerminology(ContentTerms.Session, SystemTerms.Session)
                        }
                        items={sessions}
                        selectedItems={selectedSessions}
                        handleChange={(id) =>
                          toggleItem(id, selectedSessions, setSelectedSessions)
                        }
                        disabled={sessions.length === 0}
                      />
                    )}

                    {shouldShowTagsFilter && (
                      <FilterSection
                        title={
                          filtersConfig?.find((filter) => filter.id === "tags")
                            ?.label ??
                          getTerminologyPlural(
                            ContentTerms.PopularTag,
                            SystemTerms.PopularTag,
                          )
                        }
                        items={tags}
                        selectedItems={selectedTags}
                        handleChange={(id) =>
                          toggleItem(id, selectedTags, setSelectedTags)
                        }
                        disabled={tags.length === 0}
                      />
                    )}

                    {shouldShowInstructorFilter && (
                      <FilterSection
                        title={
                          filtersConfig?.find(
                            (filter) =>
                              filter.id === "instructors" ||
                              filter.id === "authors",
                          )?.label ?? t("courseCatalog.authors")
                        }
                        items={instructors}
                        selectedItems={selectedInstructors}
                        handleChange={(id) =>
                          toggleItem(
                            id,
                            selectedInstructors,
                            setSelectedInstructors,
                          )
                        }
                        disabled={instructors.length === 0}
                      />
                    )}

                    {shouldShowPriceFilter && (
                      <div className="mb-5">
                        <h3 className="text-sm font-semibold text-catalogue-text-primary mb-2.5">
                          {priceFilterConfig?.label ?? t("courseCatalog.priceRange")}
                        </h3>
                        <div className="flex items-end gap-2 rounded-lg bg-catalogue-bg-subtle p-3">
                          <div className="flex-1">
                            <label className="block text-xs text-catalogue-text-secondary mb-1">
                              {t("courseCatalog.min")}
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={priceRange?.min ?? ""}
                              onChange={(e) =>
                                handlePriceInputChange("min", e.target.value)
                              }
                              className="w-full border border-catalogue-border rounded-md bg-catalogue-bg px-3 py-2 text-sm text-catalogue-text-primary focus:outline-none focus:ring-2 focus:ring-primary-400"
                            />
                          </div>
                          <span className="pb-2 text-catalogue-text-muted">–</span>
                          <div className="flex-1">
                            <label className="block text-xs text-catalogue-text-secondary mb-1">
                              {t("courseCatalog.max")}
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={priceRange?.max ?? ""}
                              onChange={(e) =>
                                handlePriceInputChange("max", e.target.value)
                              }
                              className="w-full border border-catalogue-border rounded-md bg-catalogue-bg px-3 py-2 text-sm text-catalogue-text-primary focus:outline-none focus:ring-2 focus:ring-primary-400"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <div
            className={
              shouldRenderFiltersPanel ? "w-full lg:w-3/4 order-2" : "w-full"
            }
          >
            {/* Search and Sort Bar */}
            <div className="catalogue-toolbar p-3 sm:p-4 mb-6">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <MagnifyingGlass
                      className="absolute start-3 top-1/2 transform -translate-y-1/2 text-catalogue-text-muted"
                      size={20}
                    />
                    <input
                      type="text"
                      placeholder={t("courseCatalog.searchPlaceholder", {
                        courses: getTerminologyPlural(ContentTerms.Course, SystemTerms.Course).toLowerCase(),
                      })}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      aria-label={t("courseCatalog.searchAriaLabel", {
                        courses: getTerminologyPlural(ContentTerms.Course, SystemTerms.Course).toLowerCase(),
                      })}
                      className="w-full ps-10 pe-9 py-2.5 border border-catalogue-border rounded-lg bg-catalogue-bg text-catalogue-text-primary focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm("")}
                        aria-label={t("common.clearSearch")}
                        className="absolute end-3 top-1/2 -translate-y-1/2 text-catalogue-text-muted hover:text-catalogue-text-primary"
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Sort */}
                <div className="sm:w-48">
                  <div className="relative">
                    <SortAscending
                      className="absolute start-3 top-1/2 transform -translate-y-1/2 text-catalogue-text-muted"
                      size={20}
                    />
                    <select
                      value={sortOption}
                      onChange={(e) =>
                        setSortOption(
                          e.target.value as CourseCatalogSortOption,
                        )
                      }
                      className="w-full ps-10 pe-4 py-2.5 border border-catalogue-border rounded-lg bg-catalogue-bg text-catalogue-text-primary focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent appearance-none"
                    >
                      {COURSE_CATALOG_SORT_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Course Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {paginatedCourses.map((course, index) => {
                // Compute category label: first tag > non-General type > level
                // (level goes through displayLevelName so backend sentinels
                // like "default" never surface as a category chip)
                const category =
                  course.tags?.[0] ||
                  (course.type && course.type !== "General" ? course.type : "") ||
                  displayLevelName(course.level) ||
                  "";
                const categoryStyle = getCategoryStyle(category);
                const courseTerm = getTerminology(
                  ContentTerms.Course,
                  SystemTerms.Course,
                );
                const levelLabel = displayLevelName(course.level);

                // Determine whether the course has a real image to display
                const hasRealImage =
                  displayImage &&
                  course.thumbnail &&
                  !course.thumbnail.includes("/api/placeholder/") &&
                  course.thumbnail.trim() !== "" &&
                  course.thumbnail !== "null" &&
                  course.thumbnail !== "undefined";

                return (
                  <div
                    key={
                      course.enrollInviteId ??
                      `${course.id}-${course.packageSessionId ?? ""}-${index}`
                    }
                    className={cn(
                      "bg-catalogue-bg-elevated flex flex-col cursor-pointer border border-catalogue-border-subtle",
                      "transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
                      render?.styles?.roundedEdges !== false
                        ? "rounded-xl overflow-hidden"
                        : "rounded-none overflow-hidden",
                    )}
                    onClick={() => handleCourseClick(course)}
                  >
                    {/* ── Header band (image or gradient fallback) ── */}
                    {displayImage && (
                      <div
                        className={cn(
                          "relative h-44 overflow-hidden flex-shrink-0",
                          // `contain` letterboxes, so give the band a surface
                          // rather than leaving a bare gap beside the artwork.
                          imageFit === "contain" && "bg-catalogue-bg-subtle",
                        )}
                      >
                        {hasRealImage ? (
                          /* Real image: fill the band */
                          <div className="w-full h-full">
                            <CourseImage
                              previewImageUrl={course.thumbnail}
                              alt={course.title}
                              className={cn(
                                "w-full h-full",
                                imageFit === "contain"
                                  ? "object-contain"
                                  : "object-cover",
                              )}
                            />
                          </div>
                        ) : (
                          /* No image: pastel gradient + centered icon */
                          <div
                            className={cn(
                              "w-full h-full flex items-center justify-center",
                              "bg-gradient-to-br",
                              categoryStyle.band,
                            )}
                          >
                            <BookOpen
                              size={56}
                              weight="duotone"
                              className={categoryStyle.icon}
                            />
                          </div>
                        )}
                        {/* Offer badge: top-left overlay */}
                        <div className="absolute top-3 start-3">
                          <OfferBadge
                            actual={course.price}
                            elevated={course.elevatedPrice}
                          />
                        </div>
                      </div>
                    )}

                    {/* ── Card body ── */}
                    <div className="flex flex-col flex-1 p-5 gap-2">
                      {/* Category label */}
                      {category && (
                        <span
                          className={cn(
                            "text-xs font-bold uppercase tracking-wide",
                            categoryStyle.text,
                          )}
                        >
                          {category}
                        </span>
                      )}

                      {/* Title */}
                      {displayTitle && (
                        <h3 className="font-bold text-lg text-gray-900 line-clamp-2 leading-snug">
                          {course.title}
                        </h3>
                      )}

                      {/* Description — guard against placeholder text */}
                      {displayDescription &&
                        course.description &&
                        course.description !== t("courseCatalog.noDescriptionAvailable") && (
                          <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
                            {course.description}
                          </p>
                        )}

                      {/* Spacer pushes meta row to the bottom */}
                      <div className="flex-1" />

                      {/* ── Meta footer row ── */}
                      <div className="border-t border-gray-100 pt-3 flex items-center justify-between gap-2">
                        {/* Left: duration + level */}
                        <div className="flex items-center gap-3 text-xs text-gray-500 min-w-0">
                          {course.duration && (
                            <span className="flex items-center gap-1 shrink-0">
                              <Clock size={13} weight="bold" aria-hidden="true" />
                              {course.duration}
                            </span>
                          )}
                          {displayLevel && levelLabel && (
                            <span className="flex items-center gap-1 truncate">
                              <ChartBarHorizontal size={13} weight="bold" aria-hidden="true" />
                              {levelLabel}
                            </span>
                          )}
                        </div>

                        {/* Right: price (or closed/opens-soon when the invite window is not open) */}
                        {displayPrice &&
                          globalSettings?.payment?.enabled !== false &&
                          (() => {
                            const availability = resolveInviteAvailability(
                              course.enroll_invite_availability,
                            );
                            if (availability !== "AVAILABLE") {
                              return (
                                <div className="shrink-0">
                                  <span className="text-xs font-semibold text-orange-600">
                                    {availability === "NOT_STARTED"
                                      ? t("courseCatalog.openSoon")
                                      : t("courseCatalog.enrollmentClosed")}
                                  </span>
                                </div>
                              );
                            }
                            return (
                              <div className="shrink-0">
                                {course.price === 0 ? (
                                  <span className="text-xs font-bold text-green-600">
                                    {t("courseCatalog.freeLabel")}
                                  </span>
                                ) : (
                                  <PriceWithMrp
                                    actual={course.price}
                                    elevated={course.elevatedPrice}
                                    currency={course.currency}
                                    size="sm"
                                    layout="inline"
                                    hideBadge
                                  />
                                )}
                              </div>
                            );
                          })()}
                      </div>

                      {/* Cart controls */}
                      {shouldShowCartControls && (
                        <div
                          className="mt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <CartControls
                            course={course}
                            globalSettings={globalSettings}
                            cartButtonConfig={cartButtonConfig}
                            addItem={addItem}
                            getItemByEnrollInviteId={getItemByEnrollInviteId}
                            updateQuantity={updateQuantity}
                            removeItem={removeItem}
                          />
                        </div>
                      )}

                      {/* Keyboard-focusable CTA — also the accessible action for
                          the whole-card mouse click above. */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCourseClick(course);
                        }}
                        className="catalogue-btn catalogue-btn-primary mt-2 w-full"
                        aria-label={t("courseCatalog.viewCourse", { course: courseTerm })}
                      >
                        {t("courseCatalog.viewCourse", { course: courseTerm })}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* No Results */}
            {filteredCourses.length === 0 && (
              <div className="catalogue-card flex flex-col items-center gap-3 py-12 px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-500">
                  <MagnifyingGlass size={26} />
                </div>
                <p className="text-base font-semibold text-catalogue-text-primary">
                  {t("courseCatalog.noResultsFound", {
                    courses: getTerminologyPlural(ContentTerms.Course, SystemTerms.Course).toLowerCase(),
                  })}
                </p>
                <p className="max-w-sm text-sm text-catalogue-text-secondary">
                  {t("courseCatalog.noResultsHint")}
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="catalogue-btn catalogue-btn-secondary catalogue-btn-sm mt-1"
                  >
                    {t("courseCatalog.clearAllFilters")}
                  </button>
                )}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex flex-col items-center gap-4">
                <nav
                  aria-label={t("courseCatalog.paginationAriaLabel")}
                  className="flex flex-wrap items-center justify-center gap-1.5"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    disabled={currentPage === 1}
                    aria-label={t("common.previousPage")}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-catalogue-border bg-catalogue-bg-elevated px-3 text-sm font-medium text-catalogue-text-secondary transition-colors hover:border-catalogue-border-strong hover:bg-catalogue-bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <CaretLeft size={15} weight="bold" />
                    <span className="hidden sm:inline">{t("courseCatalog.previous")}</span>
                  </button>

                  {getPageNumbers(currentPage, totalPages).map((p, i) =>
                    p === "..." ? (
                      <span
                        key={`dots-${i}`}
                        className="select-none px-1.5 text-gray-400"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCurrentPage(p as number)}
                        aria-current={currentPage === p ? "page" : undefined}
                        className={cn(
                          "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2.5 text-sm font-medium transition-colors",
                          currentPage === p
                            ? "border-primary-500 bg-primary-500 text-white shadow-sm"
                            : "border-catalogue-border bg-catalogue-bg-elevated text-catalogue-text-primary hover:border-catalogue-border-strong hover:bg-catalogue-bg-subtle",
                        )}
                      >
                        {p}
                      </button>
                    ),
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                    disabled={currentPage === totalPages}
                    aria-label={t("common.nextPage")}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-catalogue-border bg-catalogue-bg-elevated px-3 text-sm font-medium text-catalogue-text-secondary transition-colors hover:border-catalogue-border-strong hover:bg-catalogue-bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="hidden sm:inline">{t("courseCatalog.next")}</span>
                    <CaretRight size={15} weight="bold" />
                  </button>
                </nav>

                <p className="text-sm text-catalogue-text-secondary">
                  {t("courseCatalog.showingRange", {
                    from: (currentPage - 1) * itemsPerPage + 1,
                    to: Math.min(currentPage * itemsPerPage, filteredCourses.length),
                    total: filteredCourses.length,
                    courses: getTerminologyPlural(ContentTerms.Course, SystemTerms.Course).toLowerCase(),
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Cart Button - Fixed at bottom right */}
      {/* {cartButtonConfig?.enabled && <div className="fixed bottom-14 right-3 z-50">
        <Button
          onClick={() => navigate({ to: `/${tagName}/cart` })}
          className="h-12 w-12 rounded-full bg-primary hover:bg-primary-700 text-white shadow-lg flex items-center justify-center relative"
          size="sm"
        >
          <ShoppingCart className="h-5 w-5" />
          {getItemCount() > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center text-caption">
              {getItemCount()}
            </span>
          )}
        </Button>
      </div>} */}

      {/* Enrollment dialog removed - all enrollment happens on course details page */}
    </div>
  );
};
