import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { urlCourseDetails } from "@/constants/urls";
import axios from "axios";
import { Button } from "@/components/ui/button";
import {
  Search,
  ShoppingCart,
  Filter,
  ChevronUp,
  ChevronDown,
  X,
  Plus,
  Minus,
  ShoppingBag,
} from "lucide-react";
import { toTitleCase } from "@/lib/utils";
import { useCartStore, CartItem } from "../../-stores/cart-store";
import { toast } from "sonner";

interface BookCatalogueProps {
  title: string;
  showFilters: boolean;
  filtersConfig: any[];
  cartButtonConfig?: {
    enabled?: boolean;
    showAddToCartButton?: boolean;
    showQuantitySelector?: boolean;
    quantityMin?: number;
  };
  render: {
    layout: string;
    cardFields: string[];
    styles?: any;
  };
  instituteId: string;
  tagName: string;
  globalSettings?: any;
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
  // normalized/search helpers
  package_name?: string;
  textContent?: string;
  comma_separeted_tags?: string;
  enrollInviteId?: string;
  packageSessionId?: string;
  available_slots?: number;
  [key: string]: any;
}

// Reusing CourseImage components for consistency
const CourseImage: React.FC<{
  previewImageUrl: string;
  alt: string;
  className?: string;
}> = ({ previewImageUrl, alt, className }) => {
  const isPlaceholder =
    !previewImageUrl ||
    previewImageUrl.includes("/api/placeholder/") ||
    previewImageUrl === "null" ||
    previewImageUrl.trim() === "" ||
    previewImageUrl === "undefined";

  if (isPlaceholder) return null;
  return (
    <CourseImageWithState
      previewImageUrl={previewImageUrl}
      alt={alt}
      className={className}
    />
  );
};

const CourseImageWithState: React.FC<{
  previewImageUrl: string;
  alt: string;
  className?: string;
}> = ({ previewImageUrl, alt, className }) => {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const u = await getPublicUrlWithoutLogin(previewImageUrl);
        if (mounted && u) setUrl(u);
      } catch (err) {
        // ignore, show placeholder pulse
      }
    })();
    return () => {
      mounted = false;
    };
  }, [previewImageUrl]);
  if (!url) return <div className="w-full h-full bg-gray-200 animate-pulse" />;
  return <img src={url} alt={alt} className={className} loading="lazy" />;
};

export const BookCatalogueComponent: React.FC<BookCatalogueProps> = ({
  title,
  showFilters,
  filtersConfig,
  cartButtonConfig,
  render,
  instituteId,
  tagName,
  globalSettings,
}) => {
  console.log("tagname is :", tagName);
  const navigate = useNavigate();
  const location = useLocation();
  const { addItem, getItemByEnrollInviteId, updateQuantity, getCartMode, syncCart } =
    useCartStore();

  // Get current cart mode
  const [cartMode, setCartMode] = useState<'buy' | 'rent'>(() => getCartMode());

  // Sync cart when levelFilter changes
  useEffect(() => {
    const checkLevelFilter = () => {
      const levelFilter = sessionStorage.getItem('levelFilter') || '';
      const newMode = levelFilter.toLowerCase().includes('rent') ? 'rent' : 'buy';
      if (newMode !== cartMode) {
        setCartMode(newMode);
        syncCart();
      }
    };

    checkLevelFilter();
    const interval = setInterval(checkLevelFilter, 500); // Check every 500ms

    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'levelFilter') {
        checkLevelFilter();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Listen for custom events
    const handleLevelFilterChange = () => {
      checkLevelFilter();
    };
    window.addEventListener('levelFilterChanged', handleLevelFilterChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('levelFilterChanged', handleLevelFilterChange);
    };
  }, [cartMode, syncCart]);

  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<{ min?: number; max?: number } | null>(null);
  const [togle, settogle] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus when search bar opens
  useEffect(() => {
    if (togle && searchInputRef.current) {
      // Small timeout to ensure the transition has started/element is visible
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [togle]);

  // Listen for search bar toggle events from HeaderComponent
  useEffect(() => {
    // Check sessionStorage on mount
    const storedState = sessionStorage.getItem('searchBarOpen');
    if (storedState === 'true') {
      settogle(true);
    }

    // Listen for custom event from HeaderComponent
    const handleToggleSearchBar = (event: CustomEvent) => {
      const isOpen = event.detail?.isOpen ?? false;
      settogle(isOpen);
    };

    window.addEventListener('toggleSearchBar', handleToggleSearchBar as EventListener);

    return () => {
      window.removeEventListener('toggleSearchBar', handleToggleSearchBar as EventListener);
    };
  }, []);

  // Infinite scroll state
  const [displayedCount, setDisplayedCount] = useState(20); // Initial load
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const ITEMS_PER_LOAD = 20; // Load 20 items at a time

  // --- SEARCH SYNC WITH HEADER & OTHER TABS ---
  // We listen for:
  // 1) a custom "search-updated" event dispatched in same tab by Header component
  // 2) native "storage" events (other tabs)
  // On mount we'll also read sessionStorage if header placed a term there.
  useEffect(() => {
    const applySessionSearch = () => {
      const term = sessionStorage.getItem("searchTerm") || "";
      // do not remove it here — allow Header/back-navigation to keep it if needed
      if (term && term !== searchTerm) {
        setSearchTerm(term);
      }
    };

    // run once on mount (and when route changes)
    applySessionSearch();

    const onCustom = () => {
      applySessionSearch();
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === "searchTerm") {
        // e.newValue may be null if cleared
        const t = e.newValue || "";
        if (t !== searchTerm) setSearchTerm(t);
      }
    };

    window.addEventListener("search-updated", onCustom);
    window.addEventListener("storage", onStorage);
    // Also handle focus (user returns)
    const onFocus = () => applySessionSearch();
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("search-updated", onCustom);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]); // re-run when route changes so new searchTerms on route apply

  // Extract Genre (Tag) config for the top UI
  const genreConfig = useMemo(() => filtersConfig?.find((f) => f.id === "tag"), [filtersConfig]);
  const genres = genreConfig?.options || [];

  // Fetch Logic
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
            params: { instituteId: instituteId, page: 0, size: 50, sort: "createdAt,desc" },
            headers: { "Content-Type": "application/json" },
          }
        );

        const transformed = (response.data?.content || []).map((c: any) => {
          const htmlContent = c.course_html_description_html || "";
          const textContent = htmlContent
            .replace(/<[^>]*>/g, "")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim()
            .toLowerCase();

          return {
            id: c.id || c.packageId,
            title: c.package_name || "Untitled Book",
            description: textContent,
            dataset: c,
            thumbnail: c.course_banner_media_id || "/api/placeholder/300/400",
            price: c.min_plan_actual_price || 0,
            type: c.package_type || "Book",
            level: c.level_name || "General",
            instructor: c.instructors?.[0]?.full_name,
            duration: c.estimated_duration,
            rating: c.rating || 0,
            packageSessionId: c.package_session_id,
            enrollInviteId: c.enroll_invite_id,
            comma_separeted_tags: c.comma_separeted_tags,
            package_name: (c.package_name || "").toLowerCase(),
            course_html_description_html: c.course_html_description_html,
            textContent: textContent,
            authorName: (c.instructors?.[0]?.full_name || c.instructor || "").toLowerCase(),
            ...c,
            // Must be AFTER ...c spread to avoid being overwritten
            available_slots: c.availableSlots !== undefined ? c.availableSlots : c.available_slots,
          } as Course;
        });

        // Debug: log first item to check available_slots and tagName
        if (transformed.length > 0) {
          console.log("[Stock Debug] tagName:", tagName);
          console.log("[Stock Debug] First book available_slots:", transformed[0].available_slots, "| raw availableSlots:", transformed[0].dataset?.availableSlots, "| raw available_slots:", transformed[0].dataset?.available_slots);
        }

        // Filter out duplicates based on ID
        const uniqueCourses = Array.from(
          new Map<string, Course>(
            transformed.map((item: Course) => [item.id, item] as [string, Course])
          ).values()
        );

        setCourses(uniqueCourses);
      } catch (e) {
        console.error("Error fetching books", e);
        setCourses([]);
      } finally {
        setIsLoading(false);
      }
    };
    if (instituteId) fetchCourses();
  }, [instituteId]);

  // Optimized Filtering Logic using useMemo for faster performance
  // Only searches in package_name and textContent (pre-processed from course_html_description_html)
  const filteredCourses = useMemo(() => {
    let result = [...courses];

    // Filter by package_type: Only show items with package_type === "COURSE"
    result = result.filter((c) => {
      const packageType = c.package_type || c.type || "";
      return packageType === "COURSE";
    });

    // Filter by level (Buy/Rent) based on cartMode
    result = result.filter((c) => {
      const levelName = (c.level_name || c.level || "").toLowerCase();
      return levelName === cartMode;
    });

    // Fast search: Search in package_name, author/instructor name, and textContent (pre-processed)
    if (searchTerm && searchTerm.trim()) {
      const searchLower = searchTerm.trim().toLowerCase();
      result = result.filter((c) => {
        // Search strictly in package_name and course_html_description_html (via textContent)
        // Ensure case-insensitivity because 'package_name' might be mixed case from API
        const packageName = (c.package_name || "").toLowerCase();
        // textContent is already lowercased during transformation
        const htmlDescription = c.textContent || "";

        return packageName.includes(searchLower) || htmlDescription.includes(searchLower);
      });
    }

    // Genre filter
    if (selectedGenres.length > 0) {
      result = result.filter((c) => {
        if (!c.comma_separeted_tags) return false;

        // Split, trim, lowercase, and remove empty tags from the book's tags
        const bookTags = c.comma_separeted_tags
          .split(",")
          .map((t: string) => t.trim().toLowerCase())
          .filter((t: string) => t.length > 0);

        // Check if any selected genre (normalized) exists in the book's tags
        return selectedGenres.some((g) => bookTags.includes(g.trim().toLowerCase()));
      });
    }

    // Price filter

    return result;
  }, [courses, searchTerm, selectedGenres, cartMode]);

  // Reset displayed count when filters change
  useEffect(() => {
    setDisplayedCount(20);
  }, [searchTerm, selectedGenres, priceRange]);

  // Calculate displayed courses for infinite scroll
  const displayedCourses = filteredCourses.slice(0, displayedCount);
  const hasMore = displayedCount < filteredCourses.length;

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !isLoadingMore) {
          setIsLoadingMore(true);
          // Simulate loading delay for better UX
          setTimeout(() => {
            setDisplayedCount((prev) => Math.min(prev + ITEMS_PER_LOAD, filteredCourses.length));
            setIsLoadingMore(false);
          }, 300);
        }
      },
      {
        root: null,
        rootMargin: '200px', // Start loading 200px before reaching the bottom
        threshold: 0.1,
      }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, isLoadingMore, filteredCourses.length, ITEMS_PER_LOAD]);

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) => (prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]));
  };

  const handleBookClick = (book: Course) => {
    const searchParams = new URLSearchParams();
    if (book.enrollInviteId) searchParams.set("enrollInviteId", book.enrollInviteId);
    if (book.packageSessionId) searchParams.set("packageSessionId", book.packageSessionId);
    if (book.thumbnail) searchParams.set("bannerImage", book.thumbnail);
    if (book.level) searchParams.set("level", book.level);
    if (book.price !== undefined && book.price !== null) searchParams.set("price", book.price.toString());
    if (book.available_slots !== undefined) searchParams.set("available_slots", book.available_slots.toString());

    navigate({
      to: `/${tagName}/${book.id}`,
      search: searchParams.toString() ? Object.fromEntries(searchParams) : {},
    });
  };

  // Helper: clear search (also notify header)
  const clearSearch = () => {
    setSearchTerm("");
    try {
      sessionStorage.removeItem("searchTerm");
      window.dispatchEvent(new Event("search-updated"));
    } catch {
      // ignore
    }
  };

  // Render
  return (
    <div className="w-full bg-gray-50 min-h-screen pb-20 pt-14">
      {/* 1. Header Section with Title and Search */}
      {/* 1. Header Section with Title and Search */}
      <div className="p-0 leading-none sticky top-14 z-40 bg-gray-50/95 backdrop-blur-sm shadow-sm transition-all duration-300">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-0 pt-0 border-b  border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-center ">
            <div className="w-full md:w-auto">
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            </div>

            {/* SEARCH BAR (added) */}
            <div className={`w-full overflow-hidden transition-all duration-300 ease-in-out px-2 origin-top ${togle ? "max-h-20 opacity-100 py-2" : "max-h-0 opacity-0 py-0"}`}>
              <div className="relative border-gray-400">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search books..."
                  value={searchTerm}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSearchTerm(v);
                    try {
                      // keep sessionStorage in sync so Header/back-navigation can work
                      if (v && v.trim()) sessionStorage.setItem("searchTerm", v);
                      else sessionStorage.removeItem("searchTerm");
                      // notify other same-tab listeners (Header)
                      window.dispatchEvent(new Event("search-updated"));
                    } catch {
                      // ignore storage errors (private mode etc)
                    }
                  }}
                  className="w-full pl-10 pr-10 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white shadow-lg"
                />
                {searchTerm && (
                  <button
                    onClick={clearSearch}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    type="button"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-gray-100 z-10 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-0">

          {/* 2. Enhanced Genres UI - Horizontal Scrollable Chips */}
          {genres.length > 0 && (
            <div className="mt-0">
              <div className="flex font-bold flex-col gap-1">
                <div className="flex items-center justify-between ">
                  <h2 className="text-lg font-bold text-gray-800 tracking-tight">Browse by Genre</h2>
                  {selectedGenres.length > 0 && (
                    <button
                      onClick={() => setSelectedGenres([])}
                      className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 pb-2">
                  {genres.map((genre: string) => {
                    const isSelected = selectedGenres.includes(genre);
                    return (
                      <button
                        key={genre}
                        onClick={() => toggleGenre(genre)}
                        style={{ touchAction: "manipulation" }}
                        className={`
                          group relative flex items-center gap-2 whitespace-nowrap 
                          px-3 py-2 rounded-xl text-sm font-bold transition-all duration-300 
                          border cursor-pointer text-black
                          ${isSelected
                            ? "bg-primary-600 border-primary-600 shadow-md text-black active:bg-primary-700 active:scale-95"
                            : "bg-white text-gray-700 border-gray-200 hover:bg-primary-600 hover:text-black hover:border-primary-600 hover:shadow-md active:bg-primary-600 active:text-black active:border-primary-600 active:shadow-md active:scale-95"
                          }
                        `}
                      >
                        <span>{genre}</span>
                        {isSelected && (
                          <span className="bg-white/20 rounded-full p-0.5 ml-1 hover:bg-white/30 active:bg-white/40 text-black transition-colors">
                            <X className="h-3 w-3" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Book Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="aspect-[9/16] bg-gray-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="text-gray-400 text-xl font-medium mb-4">No books found matching your criteria.</div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-y-4 gap-x-4">
              {displayedCourses.map((book) => {

                return (
                  <div
                    key={book.id}
                    className="group relative flex flex-col cursor-pointer perspective-1000   rounded-xl"

                    onClick={() => handleBookClick(book)}
                  >
                    {/* Book Cover */}
                    <div className="relative aspect-[9/16] rounded-xl overflow-hidden shadow-lg transition-all duration-500 ease-out md:group-hover:-translate-y-2 ring-1 ring-black/5">
                      <CourseImage previewImageUrl={book.thumbnail} alt={book.title} className="w-full h-full object-cover transform transition-transform duration-700 md:group-hover:scale-110" />

                      {/* Stock Indicator Overlay - Only for Read On Rent project */}
                      {window.location.hostname.includes("readonrent") && book.available_slots !== undefined && (
                        <div className="absolute top-2 left-2 z-20 px-2 py-1 rounded-lg text-[10px] font-bold bg-white/90 backdrop-blur-sm shadow-sm flex items-center gap-1.5 border border-white/20">
                          {book.available_slots > 5 ? (
                            <>
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                              <span className="text-green-700 uppercase tracking-wider">In Stock</span>
                            </>
                          ) : book.available_slots > 0 ? (
                            <>
                              <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                              <span className="text-orange-700 uppercase tracking-wider">Only {book.available_slots} Left</span>
                            </>
                          ) : (
                            <>
                              <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                              <span className="text-gray-600 uppercase tracking-wider">Out of Stock</span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Bottom Gradient Overlay - Only visible on hover */}
                      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/70 via-black/40 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-500 ease-in-out pointer-events-none" />

                      {/* Quick Action Overlay - Slides up from bottom on hover */}
                      {cartButtonConfig?.enabled !== false && (
                        <div className="cart-button-overlay absolute bottom-0 left-0 right-0 p-4 transform translate-y-0 md:translate-y-full md:group-hover:translate-y-0 transition-all duration-500 ease-out z-10">
                          {/* Add to Cart Logic */}
                          <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const existingItem = book.enrollInviteId ? getItemByEnrollInviteId(book.enrollInviteId) : null;
                              const isBuyMode = cartMode === 'buy';

                              // Show counter for Buy mode if item exists
                              if (isBuyMode && existingItem) {
                                return (
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 border border-gray-200 rounded-lg bg-white shadow-xl">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 hover:bg-gray-100 active:bg-gray-200 rounded-l-lg transition-all duration-150"
                                        onClick={async () => {
                                          if (book.enrollInviteId) {
                                            await updateQuantity(book.enrollInviteId, existingItem.quantity - 1);
                                            window.dispatchEvent(new CustomEvent('cartUpdated'));
                                          }
                                        }}
                                        disabled={!book.enrollInviteId}
                                      >
                                        <Minus className="h-3.5 w-3.5" />
                                      </Button>
                                      <span className="w-8 text-center text-xs font-semibold text-gray-700">{existingItem.quantity}</span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 hover:bg-gray-100 active:bg-gray-200 rounded-r-lg transition-all duration-150"
                                        onClick={async () => {
                                          if (book.enrollInviteId) {
                                            await updateQuantity(book.enrollInviteId, existingItem.quantity + 1);
                                            window.dispatchEvent(new CustomEvent('cartUpdated'));
                                          }
                                        }}
                                        disabled={!book.enrollInviteId || (window.location.hostname.includes("readonrent") && book.available_slots === 0)}
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                    {/* Go to Cart button */}
                                    <Button
                                      className="h-8 px-3 bg-primary-400 hover:bg-primary-500 text-white text-xs font-semibold rounded-lg shadow-md flex items-center gap-1.5 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                                      onClick={() => navigate({ to: `/${tagName}/cart` })}
                                    >
                                      <ShoppingBag className="h-3.5 w-3.5" />
                                      Cart
                                    </Button>
                                  </div>
                                );
                              }

                              // Show Add to Cart button
                              return (
                                <Button
                                  className="px-6 w-full bg-white text-gray-900 text-sm font-medium shadow-xl hover:bg-primary-50 hover:text-primary-700 active:bg-primary-100 active:scale-95 transition-all duration-300 transform py-2 rounded-lg border border-gray-200"
                                  onClick={async () => {
                                    if (book.enrollInviteId) {
                                      const existing = getItemByEnrollInviteId(book.enrollInviteId);
                                      if (existing && !isBuyMode) {
                                        toast.info("This item is already in the cart", { duration: 2000 });
                                      } else {
                                        await addItem({
                                          id: book.id,
                                          title: book.title,
                                          price: book.price,
                                          image: book.thumbnail,
                                          level: book.level,
                                          packageSessionId: book.packageSessionId,
                                          enrollInviteId: book.enrollInviteId,
                                          levelId: book.levelId,
                                          courseId: book.courseId,
                                        });
                                        // Dispatch event to update cart count in header
                                        window.dispatchEvent(new CustomEvent('cartUpdated'));
                                        toast.success("Added to cart", { duration: 2000 });
                                      }
                                    }
                                  }}
                                  disabled={!book.enrollInviteId || (window.location.hostname.includes("readonrent") && book.available_slots === 0)}
                                  style={{ touchAction: "manipulation" }}
                                >
                                  <ShoppingCart className="h-4 w-4 mr-2" />
                                  {window.location.hostname.includes("readonrent") && book.available_slots === 0 ? "Out of Stock" : "Add to Cart"}
                                </Button>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Book Info */}
                    <div className="mt-5 space-y-2 px-1">
                      <h3 className="text-base font-bold text-gray-800 line-clamp-2 leading-tight group-hover:text-primary-600 transition-colors duration-300">
                        {book.title}
                      </h3>
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 line-clamp-1">
                          {(() => {
                            const htmlContent = book.course_html_description_html || "";
                            if (!htmlContent) return "";
                            const textContent = htmlContent
                              .replace(/<[^>]*>/g, "")
                              .replace(/&nbsp;/g, " ")
                              .replace(/&amp;/g, "&")
                              .replace(/&lt;/g, "<")
                              .replace(/&gt;/g, ">")
                              .replace(/&quot;/g, '"')
                              .replace(/&#39;/g, "'")
                              .trim();
                            return textContent;
                          })()}
                        </span>
                        {render.cardFields.includes("price") && (
                          <div className="flex flex-col items-end gap-1">
                            {/* Tags display */}
                            {book.comma_separeted_tags && (
                              <div className="flex flex-wrap justify-end gap-1 max-w-[120px]">
                                {book.comma_separeted_tags.split(',').filter(t => t.trim()).slice(0, 2).map((tag, i) => (
                                  <span key={i} className="text-[10px] font-medium text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 line-clamp-1">
                                    {tag.trim()}
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* <div className="text-lg font-extrabold text-gray-900 tracking-tight">
                              {book.price === 0 ? <span className="text-green-600">Free</span> : `₹${book.price}`}
                            </div> */}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Infinite Scroll Loading Indicator */}
            <div ref={loadMoreRef} className="mt-8 flex justify-center items-center min-h-[100px]">
              {isLoadingMore && (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-3 h-3 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-3 h-3 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <p className="text-sm text-gray-500 font-medium">Loading more books...</p>
                </div>
              )}
              {!hasMore && filteredCourses.length > 20 && (
                <div className="text-center py-8">
                  <p className="text-gray-500 font-medium">You've reached the end of the catalogue</p>
                  <p className="text-sm text-gray-400 mt-1">Showing all {filteredCourses.length} books</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
