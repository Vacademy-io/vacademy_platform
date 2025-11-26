import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CourseCatalogProps } from "../../-types/course-catalogue-types";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { urlCourseDetails } from "@/constants/urls";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Filter, ChevronDown, ChevronUp, Search, SortAsc, ShoppingCart, Plus, Minus } from "lucide-react";
import { toTitleCase } from "@/lib/utils";
import { useCartStore, CartItem } from "@/stores/cart-store";
import { toast } from "sonner";
// EnrollmentPaymentDialog import removed - not used in catalog

type PriceRangeState = { min?: number; max?: number } | null;

// CourseImage component that handles image resolution like study library
interface CourseImageProps {
  previewImageUrl: string;
  alt: string;
  className?: string;
}

const CourseImage: React.FC<CourseImageProps> = ({ previewImageUrl, alt, className }) => {
  // Check if this is a placeholder or invalid URL
  const isPlaceholder = !previewImageUrl || 
    previewImageUrl === null || 
    previewImageUrl === undefined ||
    previewImageUrl.includes('/api/placeholder/') || 
    previewImageUrl.trim() === '' ||
    previewImageUrl === 'null' ||
    previewImageUrl === 'undefined';

  // Don't render anything if it's a placeholder or invalid URL
  if (isPlaceholder) {
    return null;
  }

  // For valid URLs, use the full component with state management
  return <CourseImageWithState previewImageUrl={previewImageUrl} alt={alt} className={className} />;
};

// Separate component for handling actual image loading
const CourseImageWithState: React.FC<CourseImageProps> = ({ previewImageUrl, alt, className }) => {
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

  // Don't render anything if there's an error or no valid image
  if (imageError || (!loadingImage && !courseImageUrl)) {
    return null;
  }

  // Show loading placeholder while loading
  if (loadingImage && !courseImageUrl) {
    return (
      <div className="aspect-w-16 aspect-h-9">
        <div className="w-full h-full bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
          <div className="text-gray-400 text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-w-16 aspect-h-9">
        <img
        src={courseImageUrl}
          alt={alt}
          className={className}
          loading="lazy"
          onError={() => {
            // Don't show placeholder on error, just hide the component
            setImageError(true);
            setCourseImageUrl("");
          }}
          onLoad={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
          style={{ 
            opacity: 1, 
            transition: 'opacity 0.3s ease'
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
  type: string;
  level: string;
  instructor: string;
  duration: string;
  rating: number;
  // Allow any additional fields from API response
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
    <div className="mb-4 sm:mb-6">
      <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-2 sm:mb-3">{title}</h3>
      <div className="space-y-2">
        {items.length === 0 && !disabled && (
          <p className="text-sm text-gray-500">
            No {title.toLowerCase()} available.
          </p>
        )}
        {disabled && (
          <p className="text-sm text-gray-500">
            {title} filters are currently unavailable.
          </p>
        )}
        {itemsToDisplay.map((item) => (
          <label
            key={item.id}
            className={`flex items-center text-gray-600 hover:text-gray-800 ${
              disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            }`}
          >
            <input
              type="checkbox"
              className="form-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
              checked={selectedItems.includes(item.id)}
              onChange={() => handleChange(item.id)}
              disabled={disabled}
            />
            <span className="text-sm sm:text-base">{item.name}</span>
          </label>
        ))}
      </div>

      {canExpand && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={disabled}
          className={`text-sm mt-2 flex items-center gap-1 ${
            disabled
              ? "text-gray-400 cursor-not-allowed"
              : "text-blue-600 hover:text-blue-800"
          }`}
        >
          {isExpanded ? (
            <>
              Show Less
              <ChevronUp size={14} />
            </>
          ) : (
            <>
              Show More
              <ChevronDown size={14} />
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
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  getItemByEnrollInviteId: (enrollInviteId: string) => CartItem | undefined;
  updateQuantity: (enrollInviteId: string, quantity: number) => void;
  removeItem: (enrollInviteId: string) => void;
}> = ({ course, globalSettings, cartButtonConfig, addItem, getItemByEnrollInviteId, updateQuantity, removeItem }) => {
  const cartItem = course.enrollInviteId ? getItemByEnrollInviteId(course.enrollInviteId) : undefined;
  const quantityMin = cartButtonConfig?.quantityMin ?? 1;
  const showAddToCartButton = cartButtonConfig?.showAddToCartButton !== false;
  const showQuantitySelector = cartButtonConfig?.showQuantitySelector !== false;

  // Only hide if payment is explicitly disabled AND cartButtonConfig is not provided
  // If cartButtonConfig is provided, always show the button (even for free courses)
  if (!cartButtonConfig && (globalSettings?.payment?.enabled === false || course.price <= 0)) {
    return null;
  }

  if (cartItem && showQuantitySelector) {
    // Show quantity controls if item is in cart and quantity selector is enabled
    return (
      <div className="flex items-center gap-1.5 border border-gray-300 rounded-md px-1.5 py-1 bg-white">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-gray-100"
          onClick={(e) => {
            e.stopPropagation();
            if (cartItem && course.enrollInviteId) {
              if (cartItem.quantity > quantityMin) {
                updateQuantity(course.enrollInviteId, cartItem.quantity - 1);
              } else {
                // Remove from cart if quantity reaches minimum
                removeItem(course.enrollInviteId);
                toast.success(`${course.title} removed from cart`);
              }
            }
          }}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="min-w-[32px] text-center font-medium text-gray-900 text-sm">
          {cartItem.quantity}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-gray-100"
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
    // Show Add to Cart button if item is not in cart and button is enabled
    return (
      <Button
        onClick={(e) => {
          e.stopPropagation(); // Prevent card click
          if (!course.enrollInviteId) {
            toast.error('Cannot add item to cart: missing enroll invite ID');
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
        className="bg-blue-900 hover:bg-primary-700 text-white text-sm font-medium rounded-md px-3 py-1.5 flex items-center justify-center gap-2 shadow-sm"
        size="sm"
      >
        <ShoppingCart className="h-4 w-4" />
        <span>Add to Cart</span>
      </Button>
    );
  }
  
  // Don't render anything if both are disabled
  return null;
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
  const { addItem, getItemByEnrollInviteId, updateQuantity, removeItem, getItemCount } = useCartStore();
  
  // Debug: Log cartButtonConfig to help diagnose issues
  useEffect(() => {
    console.log('[CourseCatalogComponent] cartButtonConfig:', cartButtonConfig);
    console.log('[CourseCatalogComponent] render.cardFields:', render?.cardFields);
  }, [cartButtonConfig, render?.cardFields]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState("Newest");
  
  // Filter states
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedInstructors, setSelectedInstructors] = useState<string[]>([]);
  
  // Mobile filter state
  const [isMobileFilterExpanded, setIsMobileFilterExpanded] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  
  // Enrollment dialog state
  // Removed enrollment dialog state - all enrollment happens on details page
  
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const cardFieldsSet = useMemo(
    () => new Set((render?.cardFields ?? []).map((field) => field.toLowerCase())),
    [render?.cardFields]
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
    [filtersConfig]
  );
  const defaultToAllFilters = filterIds.size === 0;
  const shouldShowLevelFilter = filtersEnabled && (defaultToAllFilters || filterIds.has("level"));
  const shouldShowTagsFilter = filtersEnabled && (defaultToAllFilters || filterIds.has("tags"));
  const shouldShowInstructorFilter =
    filtersEnabled && (defaultToAllFilters || filterIds.has("instructors") || filterIds.has("authors"));
  const priceFilterConfig = useMemo(
    () =>
      filtersEnabled
        ? (filtersConfig ?? []).find((filter) => filter.type === "range" && filter.field === "price")
        : undefined,
    [filtersConfig, filtersEnabled]
  );
  const shouldShowPriceFilter = filtersEnabled && Boolean(priceFilterConfig);
  const hasFiltersToShow =
    shouldShowLevelFilter || shouldShowTagsFilter || shouldShowInstructorFilter || shouldShowPriceFilter;
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
    return normalized.min !== undefined || normalized.max !== undefined ? normalized : null;
  }, [priceFilterConfig]);

  const [priceRange, setPriceRange] = useState<PriceRangeState>(defaultPriceRange);

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
      return updated.min === undefined && updated.max === undefined ? null : updated;
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

  // Fetch courses from API
  useEffect(() => {
    const fetchCourses = async () => {
      setIsLoading(true);
      try {
        const response = await axios.post(urlCourseDetails, {
          status: [],
          level_ids: [],
          faculty_ids: [],
          search_by_name: "",
          tag: [],
          min_percentage_completed: 0,
          max_percentage_completed: 0,
        }, {
          params: {
            instituteId: instituteId,
            page: 0,
            size: 20, // Reasonable size for course catalog
            sort: "createdAt,desc"
          },
          headers: {
            "Content-Type": "application/json",
          },
        });

        // Transform API response to Course interface
        const apiCourses = response.data?.content || response.data || [];
        
        if (apiCourses.length > 0) {
          // Check for enroll_invite_id in the first course
        }
        const transformedCourses: Course[] = apiCourses.map((course: any) => {
            // Get the raw media ID (same priority as study library)
            const thumbnailField = course.course_preview_image_media_id || course.course_banner_media_id || course.thumbnail_file_id;
            const thumbnailUrl = thumbnailField || "/api/placeholder/300/200";

            // Parse HTML content safely
            const parseHtmlContent = (htmlString: string) => {
              if (!htmlString) return "";
              return htmlString.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
            };

            // Get pricing from search API response
            // For course catalog, we use min_plan_actual_price from search API
            // This should already be the minimum price from all available plans
            const finalPrice = course.min_plan_actual_price || 0;
            const isFree = finalPrice === 0;
            

            return {
              id: course.id || course.packageId,
              title: course.package_name || "Untitled Course",
              description: parseHtmlContent(course.course_html_description_html) || "No description available",
              thumbnail: thumbnailUrl,
              bannerImage: thumbnailUrl, // Use the same image as banner for details page
              price: finalPrice,
              type: course.package_type || course.type || "General",
              level: course.level_name || "Beginner",
              instructor: course.instructors?.[0]?.full_name || "Unknown Instructor",
              duration: course.estimated_duration || course.duration || "Unknown Duration",
              rating: course.rating || 0,
              packageSessionId: course.package_session_id,
              enrollInviteId: course.enroll_invite_id, // Use real enroll_invite_id from API
              // Add all other fields from the API response for dynamic filtering
              ...course
            };
          });

        setCourses(transformedCourses);
        setFilteredCourses(transformedCourses);
      } catch (error) {
        console.error("[CourseCatalogComponent] Error fetching courses:", error);
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
          course.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply level filter
    if (selectedLevels.length > 0) {
      filtered = filtered.filter(course => selectedLevels.includes(course.level));
    }

    // Apply tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(course => {
        const courseTags = course.comma_separeted_tags?.split(',').map((tag: string) => tag.trim()) || [];
        return selectedTags.some(tag => courseTags.includes(tag));
      });
    }

    // Apply instructor filter
    if (selectedInstructors.length > 0) {
      filtered = filtered.filter(course => selectedInstructors.includes(course.instructor));
    }

    // Apply price range filter
    if (shouldShowPriceFilter && priceRange && (priceRange.min !== undefined || priceRange.max !== undefined)) {
      filtered = filtered.filter((course) => {
        const coursePrice = typeof course.price === "number" ? course.price : Number(course.price) || 0;
        const meetsMin = priceRange.min !== undefined ? coursePrice >= priceRange.min : true;
        const meetsMax = priceRange.max !== undefined ? coursePrice <= priceRange.max : true;
        return meetsMin && meetsMax;
      });
    }

    // Apply sorting
    switch (sortOption) {
      case "Newest":
        filtered.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        break;
      case "Oldest":
        filtered.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
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
  }, [courses, searchTerm, selectedLevels, selectedTags, selectedInstructors, sortOption, priceRange, shouldShowPriceFilter]);

  // Pagination
  const paginatedCourses = filteredCourses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
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
    setter: (newList: string[]) => void
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
      searchParams.set('enrollInviteId', course.enrollInviteId);
    }
    if (course.packageSessionId) {
      searchParams.set('packageSessionId', course.packageSessionId);
    }
    if (course.bannerImage) {
      searchParams.set('bannerImage', course.bannerImage);
    }
    if (course.level) {
      searchParams.set('level', course.level);
    }
    
    navigate({ 
      to: `/${tagName}/${course.id}`,
      search: searchParams.toString() ? { 
        enrollInviteId: course.enrollInviteId, 
        packageSessionId: course.packageSessionId,
        bannerImage: course.bannerImage,
        level: course.level
      } : {}
    });
  };


  // Get unique values for filters
  const levels = [...new Set(courses.map(course => course.level))].map(level => ({
    id: level,
    name: toTitleCase(level)
  }));

  const tags = [...new Set(courses.flatMap(course => 
    course.comma_separeted_tags?.split(',').map((tag :string)=> tag.trim()) || []
  ))].map(tag => ({
    id: tag,
    name: tag
  }));

  const instructors = [...new Set(courses.map(course => course.instructor))].map(instructor => ({
    id: instructor,
    name: instructor
  }));

  const filterBadgeCount =
    selectedLevels.length +
    selectedTags.length +
    selectedInstructors.length +
    (shouldShowPriceFilter && isPriceFilterActive ? 1 : 0);
  const hasActiveFilters = filterBadgeCount > 0;

  if (isLoading) {
    return (
      <div className="py-12 w-full">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-gray-200 rounded-lg h-64"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="py-12 bg-gray-50 w-full">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">{title}</h2>

        <div
          className={`flex flex-col ${shouldRenderFiltersPanel ? "lg:flex-row" : ""} p-2 sm:p-4 lg:p-8 bg-gray-50 min-h-screen`}
        >
          {/* Filter Panel - Full width on mobile, sidebar on desktop */}
          {shouldRenderFiltersPanel && (
            <div className="w-full lg:w-1/4 lg:pr-8 mb-6 lg:mb-0 order-1">
              <div className="lg:sticky lg:top-8">
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
                  {/* Mobile Header - Only visible on mobile */}
                  <div className="lg:hidden mb-4">
                    <button
                      onClick={() => setIsMobileFilterExpanded(!isMobileFilterExpanded)}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <Filter size={18} className="text-gray-600" />
                        <span className="text-sm font-semibold text-gray-900">Filters</span>
                        {hasActiveFilters && (
                          <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded-full">
                            {filterBadgeCount}
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        size={16}
                        className={`text-gray-500 transition-transform ${isMobileFilterExpanded ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>

                  {/* Filter Content - Hidden on mobile when collapsed */}
                  <div className={`lg:block ${isMobileFilterExpanded ? "block" : "hidden"}`}>
                    {/* Desktop Header */}
                    <div className="hidden lg:flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold text-gray-800">Filters</h2>
                      <div className="flex gap-1">
                        <Button
                          onClick={clearAllFilters}
                          disabled={!hasActiveFilters}
                          className="px-2 py-1 h-fit transition text-xs mt-[1px]"
                        >
                          Clear All
                        </Button>
                        <Button
                          onClick={onApplyFilters}
                          disabled={!hasActiveFilters}
                          className="px-2 py-1 h-fit transition text-xs mt-[1px]"
                        >
                          Apply
                        </Button>
                      </div>
                    </div>

                    {/* Mobile Header */}
                    <div className="lg:hidden flex justify-between items-center mb-4">
                      <h2 className="text-lg font-bold text-gray-800">Filters</h2>
                      <div className="flex gap-1">
                        <Button
                          onClick={clearAllFilters}
                          disabled={!hasActiveFilters}
                          className="px-2 py-1 h-fit transition text-xs mt-[1px]"
                        >
                          Clear All
                        </Button>
                        <Button
                          onClick={onApplyFilters}
                          disabled={!hasActiveFilters}
                          className="px-2 py-1 h-fit transition text-xs mt-[1px]"
                        >
                          Apply
                        </Button>
                      </div>
                    </div>

                    {shouldShowLevelFilter && (
                      <FilterSection
                        title={filtersConfig?.find((filter) => filter.id === "level")?.label ?? "Level"}
                        items={levels}
                        selectedItems={selectedLevels}
                        handleChange={(id) => toggleItem(id, selectedLevels, setSelectedLevels)}
                        disabled={levels.length === 0}
                      />
                    )}

                    {shouldShowTagsFilter && (
                      <FilterSection
                        title={filtersConfig?.find((filter) => filter.id === "tags")?.label ?? "Popular Tags"}
                        items={tags}
                        selectedItems={selectedTags}
                        handleChange={(id) => toggleItem(id, selectedTags, setSelectedTags)}
                        disabled={tags.length === 0}
                      />
                    )}

                    {shouldShowInstructorFilter && (
                      <FilterSection
                        title={
                          filtersConfig?.find((filter) => filter.id === "instructors" || filter.id === "authors")
                            ?.label ?? "Authors"
                        }
                        items={instructors}
                        selectedItems={selectedInstructors}
                        handleChange={(id) => toggleItem(id, selectedInstructors, setSelectedInstructors)}
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
                              <label className="block text-xs text-gray-500 mb-1">Min</label>
                              <input
                                type="number"
                                min={0}
                                value={priceRange?.min ?? ""}
                                onChange={(e) => handlePriceInputChange("min", e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </div>
                            <span className="text-gray-500 mt-6">-</span>
                            <div className="flex-1">
                              <label className="block text-xs text-gray-500 mb-1">Max</label>
                              <input
                                type="number"
                                min={0}
                                value={priceRange?.max ?? ""}
                                onChange={(e) => handlePriceInputChange("max", e.target.value)}
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
          <div className={shouldRenderFiltersPanel ? "w-full lg:w-3/4 order-2" : "w-full"}>
            {/* Search and Sort Bar */}
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow mb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
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
                    <SortAsc className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <select
                      value={sortOption}
                      onChange={(e) => setSortOption(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
                    >
                      <option value="Newest">Newest</option>
                      <option value="Oldest">Oldest</option>
                      <option value="Price: Low to High">Price: Low to High</option>
                      <option value="Price: High to Low">Price: High to Low</option>
                      <option value="Rating">Rating</option>
                      <option value="Name A-Z">Name A-Z</option>
                      <option value="Name Z-A">Name Z-A</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Course Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {paginatedCourses.map((course, index) => (
                <div
                  key={`${course.id}-${index}-${currentPage}`}
                  className={`bg-white rounded-lg shadow-md overflow-hidden cursor-pointer transition-all duration-300 ${
                    render?.styles?.hoverEffect === 'scale' 
                      ? 'hover:scale-105 hover:shadow-lg' 
                      : render?.styles?.hoverEffect === 'shadow' 
                      ? 'hover:shadow-lg' 
                      : 'hover:shadow-lg'
                  } ${
                    render?.styles?.roundedEdges ? 'rounded-lg' : 'rounded-none'
                  }`}
                  style={{
                    backgroundColor: render?.styles?.backgroundColor || '#ffffff'
                  }}
                  onClick={() => handleCourseClick(course)}
                >
                  {/* Course Thumbnail */}
                  {displayImage && (
                    <CourseImage 
                      previewImageUrl={course.thumbnail}
                      alt={course.title}
                      className="w-full h-48 object-cover"
                    />
                  )}
                  
                  <div className="p-4 sm:p-6">
                    {/* Course Title */}
                    {displayTitle && (
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 line-clamp-2">
                        {course.title}
                      </h3>
                    )}
                    
                    {/* Course Description */}
                    {displayDescription && (
                      <p className="text-sm sm:text-base text-gray-600 mb-4 line-clamp-2 sm:line-clamp-3">
                        {course.description}
                      </p>
                    )}
                    
                    {/* Course Info */}
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          {/* Price - Only show if payment is enabled */}
                          {displayPrice && globalSettings?.payment?.enabled !== false && (
                            <span className="text-xl sm:text-2xl font-bold text-primary-600">
                              {course.price === 0 ? "Free" : `₹${course.price.toFixed(2)}`}
                            </span>
                          )}

                          {/* Add to Cart Button or Quantity Controls */}
                          {shouldShowCartControls && (
                            <div className="flex-shrink-0">
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
                        </div>

                        {/* Badges */}
                        {(displayLevel || displayRating) && (
                          <div className="flex flex-wrap gap-2">
                            {displayLevel && (
                              <span className="px-2 py-1 bg-primary-100 text-primary-800 text-xs sm:text-sm rounded-full">
                                {course.level}
                              </span>
                            )}
                            {displayRating && course.rating > 0 && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs sm:text-sm rounded-full">
                                ⭐ {course.rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* No Results */}
            {filteredCourses.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No courses found matching your criteria.</p>
              </div>
            )}

            {/* Pagination - Only show if there are multiple pages */}
            {totalPages > 1 && (
              <div className="flex justify-center">
                <div className="flex space-x-2">
                  <Button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2"
                  >
                    Previous
                  </Button>
                  
                  {[...Array(totalPages)].map((_, i) => (
                    <Button
                      key={i + 1}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`px-3 py-2 ${
                        currentPage === i + 1 
                          ? 'bg-primary-600 text-white' 
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {i + 1}
                    </Button>
                  ))}
                  
                  <Button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Cart Button - Fixed at bottom right */}
      {cartButtonConfig?.enabled && <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => navigate({ to: `/${tagName}/cart` })}
          className="h-12 w-12 rounded-full bg-blue-600 hover:bg-primary-700 text-white shadow-lg flex items-center justify-center relative"
          size="sm"
        >
          <ShoppingCart className="h-5 w-5" />
          {getItemCount() > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center text-[10px]">
              {getItemCount()}
            </span>
          )}
        </Button>
      </div>}

      {/* Enrollment dialog removed - all enrollment happens on course details page */}
    </div>
  );
};
