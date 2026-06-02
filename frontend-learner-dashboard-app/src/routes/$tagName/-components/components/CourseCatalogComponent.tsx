import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CourseCatalogProps } from "../../-types/course-catalogue-types";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { urlCourseDetails } from "@/constants/urls";
import axios from "axios";
import { Button } from "@/components/ui/button";
import {
  Funnel,
  CaretDown,
  CaretUp,
  MagnifyingGlass,
  SortAscending,
  ShoppingCart,
  Plus,
  Minus,
  BookOpen,
} from "@phosphor-icons/react";
import { toTitleCase } from "@/lib/utils";
import { useCartStore, CartItem } from "../../-stores/cart-store";
import { toast } from "sonner";
import {
  getTerminology,
  getTerminologyPlural,
} from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import { OfferBadge, PriceWithMrp } from "@/components/common/price-with-mrp";
// EnrollmentPaymentDialog import removed - not used in catalog

type PriceRangeState = { min?: number; max?: number } | null;

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
            Loading...
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
  const [isExpanded, setIsExpanded] = useState(false);
  const initialDisplayCount = 3;
  const canExpand = items.length > initialDisplayCount;
  const itemsToDisplay =
    canExpand && !isExpanded ? items.slice(0, initialDisplayCount) : items;

  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium text-gray-800 mb-2">{title}</h3>
      <div className="space-y-1.5">
        {items.length === 0 && !disabled && (
          <p className="text-xs text-gray-500">
            No {title.toLowerCase()} available.
          </p>
        )}
        {disabled && (
          <p className="text-xs text-gray-500">
            {title} filters are currently unavailable.
          </p>
        )}
        {itemsToDisplay.map((item) => (
          <label
            key={item.id}
            className={`flex items-center text-gray-600 hover:text-gray-900 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          >
            <input
              type="checkbox"
              className="form-checkbox h-3.5 w-3.5 text-primary-600 border-gray-300 rounded focus:ring-primary-500 mr-2"
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
          className={`text-xs mt-1.5 flex items-center gap-1 ${
            disabled
              ? "text-gray-400 cursor-not-allowed"
              : "text-primary-600 hover:text-primary-700"
          }`}
        >
          {isExpanded ? (
            <>
              Show Less
              <CaretUp size={12} />
            </>
          ) : (
            <>
              Show More
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
      <div className="flex items-center gap-1 border border-catalogue-border rounded-md px-1 py-0.5 bg-white">
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
                toast.success(`${course.title} removed from cart`);
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
          className="h-6 w-6 p-0 hover:bg-gray-100"
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
            toast.error("Cannot add item to cart: missing enroll invite ID");
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
          toast.success(`${course.title} added to cart!`);
        }}
        className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-md px-2.5 py-1 flex items-center justify-center gap-1.5"
        size="sm"
      >
        <ShoppingCart className="h-3.5 w-3.5" />
        <span>Add</span>
      </Button>
    );
  }

  // Don't render anything if both are disabled
  return null;
};

// ─── New course card (image + name + description + price + View/Add buttons) ──

interface CourseCardProps {
  course: Course;
  globalSettings?: any;
  showCartControls: boolean;
  displayTitle: boolean;
  displayDescription: boolean;
  displayImage: boolean;
  displayPrice: boolean;
  displayLevel: boolean;
  roundedEdges: boolean;
  onView: () => void;
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (enrollInviteId: string) => void;
  getItemByEnrollInviteId: (id: string) => CartItem | undefined;
}

const CourseCard: React.FC<CourseCardProps> = ({
  course,
  globalSettings,
  showCartControls,
  displayTitle,
  displayDescription,
  displayImage,
  displayPrice,
  displayLevel,
  roundedEdges,
  onView,
  addItem,
  removeItem,
  getItemByEnrollInviteId,
}) => {
  const cartItem = course.enrollInviteId
    ? getItemByEnrollInviteId(course.enrollInviteId)
    : undefined;
  const isInCart = !!cartItem;

  return (
    <div
      className={`flex flex-col bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 ${
        roundedEdges ? "rounded-xl" : "rounded-none"
      }`}
    >
      {/* Image with inner card border */}
      {displayImage && (
        <div className="p-3 pb-2">
          <div className="overflow-hidden rounded-lg border border-gray-100">
            <CourseImage
              previewImageUrl={course.thumbnail}
              alt={course.title}
              className="w-full object-cover"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col flex-1 px-4 pb-4 pt-1">
        {/* Level badge */}
        {displayLevel && course.level && (
          <span className="inline-block self-start px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-md mb-2">
            {course.level}
          </span>
        )}

        {/* Name */}
        {displayTitle && (
          <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 mb-1.5">
            {course.title}
          </h3>
        )}

        {/* Description */}
        {displayDescription &&
          course.description &&
          course.description !== "No description available" && (
            <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-2 flex-1">
              {course.description}
            </p>
          )}

        {/* Price */}
        {displayPrice && globalSettings?.payment?.enabled !== false && (
          <PriceWithMrp
            actual={course.price}
            elevated={course.elevatedPrice}
            currency={course.currency}
            size="md"
            className="text-primary-600"
          />
        )}

        {/* Action buttons */}
        <div className="flex gap-2 mt-auto">
          <button
            type="button"
            onClick={onView}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors"
          >
            View
          </button>
          {showCartControls &&
            course.enrollInviteId &&
            (isInCart ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeItem(course.enrollInviteId!);
                  toast.success(`${course.title} removed from cart`);
                }}
                className="flex-1 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 hover:border-red-400 transition-colors"
              >
                Remove
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!course.enrollInviteId) {
                    toast.error(
                      "Cannot add item to cart: missing enroll invite ID",
                    );
                    return;
                  }
                  addItem({
                    id: course.id,
                    title: course.title,
                    price: course.price,
                    image: course.thumbnail,
                    level: course.level,
                    packageSessionId: course.packageSessionId,
                    enrollInviteId: course.enrollInviteId,
                    levelId: course.levelId,
                    courseId: course.courseId,
                  });
                  toast.success(`${course.title} added to cart!`);
                }}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors"
              >
                Add
              </button>
            ))}
        </div>
      </div>
    </div>
  );
};

export const CourseCatalogComponent: React.FC<CourseCatalogComponentProps> = ({
  title,
  showFilters,
  filtersConfig,
  cartButtonConfig,
  render,
  instituteId,
  tagName,
  globalSettings,
}) => {
  const navigate = useNavigate();
  const {
    addItem,
    getItemByEnrollInviteId,
    updateQuantity,
    removeItem,
    getItemCount,
  } = useCartStore();

  // Debug: Log cartButtonConfig to help diagnose issues
  useEffect(() => {
    console.log("[CourseCatalogComponent] cartButtonConfig:", cartButtonConfig);
    console.log(
      "[CourseCatalogComponent] render.cardFields:",
      render?.cardFields,
    );
  }, [cartButtonConfig, render?.cardFields]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState("Newest");
  const [totalApiElements, setTotalApiElements] = useState(0);

  // Filter states
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedInstructors, setSelectedInstructors] = useState<string[]>([]);

  // Mobile filter state
  const [isMobileFilterExpanded, setIsMobileFilterExpanded] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  // Derive filter options from loaded courses (before shouldShow* checks)
  const levels = useMemo(
    () =>
      [...new Set(courses.map((c) => c.level).filter(Boolean))].map(
        (level) => ({ id: level, name: toTitleCase(level) }),
      ),
    [courses],
  );
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
  const displayRating = isCardFieldEnabled("rating");
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
  const shouldShowLevelFilter =
    filtersEnabled &&
    (defaultToAllFilters || filterIds.has("level")) &&
    levels.length > 1;
  const shouldShowTagsFilter =
    filtersEnabled &&
    (defaultToAllFilters || filterIds.has("tags")) &&
    tags.length > 0;
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
              size: 50,
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
            title: course.package_name || "Untitled Course",
            description:
              parseHtmlContent(course.course_html_description_html) ||
              "No description available",
            thumbnail: thumbnailUrl,
            bannerImage: thumbnailUrl, // Use the same image as banner for details page
            price: finalPrice,
            elevatedPrice,
            currency: course.currency,
            type: course.package_type || course.type || "General",
            level: course.level_name || "Beginner",
            instructor:
              course.instructors?.[0]?.full_name || "Unknown Instructor",
            duration:
              course.estimated_duration ||
              course.duration ||
              "Unknown Duration",
            rating: course.rating || 0,
            packageSessionId: course.package_session_id,
            enrollInviteId: course.enroll_invite_id, // Use real enroll_invite_id from API
            sessionId: course.session_id,
            sessionName: course.session_name,
            // Add all other fields from the API response for dynamic filtering
            ...course,
          };
        });

        setTotalApiElements(
          response.data?.totalElements || transformedCourses.length,
        );
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
    selectedTags.length +
    selectedInstructors.length +
    (shouldShowPriceFilter && isPriceFilterActive ? 1 : 0);
  const hasActiveFilters = filterBadgeCount > 0;

  if (isLoading) {
    return (
      <div className="py-6 w-full">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-6 bg-catalogue-bg-muted rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-catalogue-bg-muted rounded-lg h-56"
                ></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="py-6 bg-catalogue-bg-subtle w-full"
    >
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl sm:text-2xl font-bold text-catalogue-text-primary mb-4">
          {title}
        </h2>

        <div
          className={`flex flex-col ${shouldRenderFiltersPanel ? "lg:flex-row" : ""} gap-4 lg:gap-6`}
        >
          {shouldRenderFiltersPanel && (
            <div className="w-full lg:w-64 lg:flex-shrink-0 order-1">
              <div className="lg:sticky lg:top-20">
                <div className="bg-white p-3 sm:p-4 rounded-lg border border-catalogue-border-subtle">
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
                          Filters
                        </span>
                        {hasActiveFilters && (
                          <span className="bg-primary-100 text-primary-700 text-xs font-medium px-1.5 py-0.5 rounded-full">
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
                      <h2 className="text-xl font-bold text-gray-800">
                        Filters
                      </h2>
                      <div className="flex gap-1">
                        <Button
                          onClick={clearAllFilters}
                          disabled={!hasActiveFilters}
                          className="px-2 py-1 h-fit transition text-xs mt-px"
                        >
                          Clear All
                        </Button>
                        <Button
                          onClick={onApplyFilters}
                          disabled={!hasActiveFilters}
                          className="px-2 py-1 h-fit transition text-xs mt-px"
                        >
                          Apply
                        </Button>
                      </div>
                    </div>

                    {/* Mobile Header */}
                    <div className="lg:hidden flex justify-between items-center mb-4">
                      <h2 className="text-lg font-bold text-gray-800">
                        Filters
                      </h2>
                      <div className="flex gap-1">
                        <Button
                          onClick={clearAllFilters}
                          disabled={!hasActiveFilters}
                          className="px-2 py-1 h-fit transition text-xs mt-px"
                        >
                          Clear All
                        </Button>
                        <Button
                          onClick={onApplyFilters}
                          disabled={!hasActiveFilters}
                          className="px-2 py-1 h-fit transition text-xs mt-px"
                        >
                          Apply
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
                          )?.label ?? "Authors"
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
                      <div className="mb-4 sm:mb-6">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-2 sm:mb-3">
                          {priceFilterConfig?.label ?? "Price Range"}
                        </h3>
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <label className="block text-xs text-gray-500 mb-1">
                                Min
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={priceRange?.min ?? ""}
                                onChange={(e) =>
                                  handlePriceInputChange("min", e.target.value)
                                }
                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </div>
                            <span className="text-gray-500 mt-6">-</span>
                            <div className="flex-1">
                              <label className="block text-xs text-gray-500 mb-1">
                                Max
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={priceRange?.max ?? ""}
                                onChange={(e) =>
                                  handlePriceInputChange("max", e.target.value)
                                }
                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </div>
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
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow mb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <MagnifyingGlass
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                      size={20}
                    />
                    <input
                      type="text"
                      placeholder="Search courses..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Sort */}
                <div className="sm:w-48">
                  <div className="relative">
                    <SortAscending
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                      size={20}
                    />
                    <select
                      value={sortOption}
                      onChange={(e) => setSortOption(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
                    >
                      <option value="Newest">Newest</option>
                      <option value="Oldest">Oldest</option>
                      <option value="Price: Low to High">
                        Price: Low to High
                      </option>
                      <option value="Price: High to Low">
                        Price: High to Low
                      </option>
                      <option value="Rating">Rating</option>
                      <option value="Name A-Z">Name A-Z</option>
                      <option value="Name Z-A">Name Z-A</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Course Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {paginatedCourses.map((course, index) => (
                <div
                  key={`${course.id}-${index}-${currentPage}`}
                  className={`bg-white overflow-hidden cursor-pointer transition-colors duration-200 border border-gray-200 hover:border-gray-300 ${
                    render?.styles?.roundedEdges !== false
                      ? "rounded-lg"
                      : "rounded-none"
                  }`}
                  onClick={() => handleCourseClick(course)}
                >
                  {/* Course Thumbnail */}
                  {displayImage && (
                    <div className="relative">
                      <CourseImage
                        previewImageUrl={course.thumbnail}
                        alt={course.title}
                        className="w-full h-40 object-cover"
                      />
                      <div className="absolute top-2 left-2">
                        <OfferBadge
                          actual={course.price}
                          elevated={course.elevatedPrice}
                        />
                      </div>
                    </div>
                  )}

                  <div className="p-3">
                    {/* Course Title */}
                    {displayTitle && (
                      <h3 className="text-base font-semibold text-gray-900 mb-1.5 line-clamp-2">
                        {course.title}
                      </h3>
                    )}

                    {/* Course Description */}
                    {displayDescription && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {course.description}
                      </p>
                    )}

                    {/* Course Info */}
                    <div className="flex flex-col gap-2">
                      {/* Price */}
                      {displayPrice &&
                        globalSettings?.payment?.enabled !== false && (
                          <PriceWithMrp
                            actual={course.price}
                            elevated={course.elevatedPrice}
                            currency={course.currency}
                            size="md"
                            className="text-primary-600"
                          />
                        )}

                      {/* Badges and Cart */}
                      {(displayLevel ||
                        displayRating ||
                        shouldShowCartControls) && (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {displayLevel && (
                              <span className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-md">
                                {course.level}
                              </span>
                            )}
                            {displayRating && course.rating > 0 && (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-md">
                                ⭐ {course.rating.toFixed(1)}
                              </span>
                            )}
                          </div>

                          {/* Add to Cart Button or Quantity Controls */}
                          {shouldShowCartControls && (
                            <CartControls
                              course={course}
                              globalSettings={globalSettings}
                              cartButtonConfig={cartButtonConfig}
                              addItem={addItem}
                              getItemByEnrollInviteId={getItemByEnrollInviteId}
                              updateQuantity={updateQuantity}
                              removeItem={removeItem}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* No Results */}
            {filteredCourses.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500 text-base">
                  No courses found matching your criteria.
                </p>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    disabled={currentPage === 1}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i + 1}
                      type="button"
                      onClick={() => setCurrentPage(i + 1)}
                      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                        currentPage === i + 1
                          ? "border-primary-600 bg-primary-600 text-white"
                          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                    disabled={currentPage === totalPages}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                {totalApiElements > courses.length && (
                  <p className="text-xs text-gray-400">
                    Showing {courses.length} of {totalApiElements} courses
                  </p>
                )}
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
