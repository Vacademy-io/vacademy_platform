import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CourseCatalogProps } from "../../-types/course-catalogue-types";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { urlCourseDetails } from "@/constants/urls";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Filter, ChevronDown, ChevronUp, Search, SortAsc } from "lucide-react";
import { toTitleCase } from "@/lib/utils";
// EnrollmentPaymentDialog import removed - not used in catalog

// CourseImage component that handles image resolution like study library
interface CourseImageProps {
  previewImageUrl: string;
  alt: string;
  className?: string;
}

const CourseImage: React.FC<CourseImageProps> = ({ previewImageUrl, alt, className }) => {
  const [courseImageUrl, setCourseImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      console.log("[CourseImage] Loading image with previewImageUrl:", previewImageUrl);
      
      if (!previewImageUrl || previewImageUrl.includes('/api/placeholder/')) {
        console.log("[CourseImage] Using placeholder - no valid previewImageUrl");
        if (isMounted) {
          setLoadingImage(false);
          setCourseImageUrl("/api/placeholder/300/200");
        }
        return;
      }

      setLoadingImage(true);
      try {
        console.log("[CourseImage] Calling getPublicUrlWithoutLogin with:", previewImageUrl);
        const url = await getPublicUrlWithoutLogin(previewImageUrl);
        console.log("[CourseImage] Got URL from API:", url);
        if (isMounted) {
          const next = url || null;
          setCourseImageUrl((prev) => (prev === next ? prev : next));
        }
      } catch (error) {
        console.error("[CourseImage] Error getting public URL:", error);
        if (isMounted) {
          setCourseImageUrl((prev) => (prev === null ? prev : null));
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

  return (
    <div className="aspect-w-16 aspect-h-9">
      {loadingImage ? (
        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
          <div className="text-gray-400 text-sm">Loading...</div>
        </div>
      ) : courseImageUrl ? (
        <img
          src={courseImageUrl}
          alt={alt}
          className={className}
          loading="lazy"
          onError={(e) => {
            if (e.currentTarget) {
              e.currentTarget.src = "/api/placeholder/300/200";
            }
          }}
          onLoad={(e) => {
            // Ensure the image is properly loaded
            e.currentTarget.style.opacity = '1';
          }}
          style={{ 
            opacity: 1, 
            transition: 'opacity 0.3s ease'
          }}
        />
      ) : (
        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
          <div className="text-gray-400 text-sm">No Image</div>
        </div>
      )}
    </div>
  );
};

interface CourseCatalogComponentProps extends CourseCatalogProps {
  instituteId: string;
  tagName: string;
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

export const CourseCatalogComponent: React.FC<CourseCatalogComponentProps> = ({
  title,
  showFilters,
  filtersConfig,
  render,
  instituteId,
  tagName,
}) => {
  const navigate = useNavigate();
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

  // Fetch courses from API
  useEffect(() => {
    const fetchCourses = async () => {
      setIsLoading(true);
      try {
        console.log("[CourseCatalogComponent] Fetching courses for institute:", instituteId);
        
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

        console.log("[CourseCatalogComponent] API response:", response.data);
        
        // Transform API response to Course interface
        const apiCourses = response.data?.content || response.data || [];
        
        // Debug: Check for enroll_invite_id in the first course
        if (apiCourses.length > 0) {
          console.log("[CourseCatalogComponent] First course data:", {
            id: apiCourses[0].id,
            package_name: apiCourses[0].package_name,
            enroll_invite_id: apiCourses[0].enroll_invite_id,
            package_session_id: apiCourses[0].package_session_id,
            min_plan_actual_price: apiCourses[0].min_plan_actual_price,
            payment_options_id: apiCourses[0].payment_options_id
          });
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
            
            // Debug: Log the pricing decision
            console.log("[CourseCatalogComponent] Pricing from search API:", {
              courseName: course.package_name,
              min_plan_actual_price: course.min_plan_actual_price,
              payment_options_id: course.payment_options_id,
              enroll_invite_id: course.enroll_invite_id,
              isFree,
              finalPrice,
              note: "Using min_plan_actual_price from search API (should be minimum from all plans)"
            });

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

        console.log("[CourseCatalogComponent] Transformed courses:", transformedCourses);
        
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
        const courseTags = course.comma_separeted_tags?.split(',').map(tag => tag.trim()) || [];
        return selectedTags.some(tag => courseTags.includes(tag));
      });
    }

    // Apply instructor filter
    if (selectedInstructors.length > 0) {
      filtered = filtered.filter(course => selectedInstructors.includes(course.instructor));
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
  }, [courses, searchTerm, selectedLevels, selectedTags, selectedInstructors, sortOption]);

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
  };

  const onApplyFilters = () => {
    // Filters are applied automatically via useEffect
    setIsMobileFilterExpanded(false);
  };

  const handleCourseClick = (course: Course) => {
    console.log('[CourseCatalogComponent] Course clicked:', {
      id: course.id,
      title: course.title,
      price: course.price,
      enrollInviteId: course.enrollInviteId,
      packageSessionId: course.packageSessionId
    });
    
    // All courses navigate to details page with enroll_invite_id
    console.log('[CourseCatalogComponent] Navigating to course details for all courses', {
      isFree: course.price === 0,
      price: course.price,
      hasEnrollInviteId: !!course.enrollInviteId,
      enrollInviteId: course.enrollInviteId
    });
    
    // Pass enroll_invite_id and banner image as search params so details page can use them
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
    
    navigate({ 
      to: `/${tagName}/${course.id}`,
      search: searchParams.toString() ? { 
        enrollInviteId: course.enrollInviteId, 
        packageSessionId: course.packageSessionId,
        bannerImage: course.bannerImage
      } : {}
    });
  };


  // Get unique values for filters
  const levels = [...new Set(courses.map(course => course.level))].map(level => ({
    id: level,
    name: toTitleCase(level)
  }));

  const tags = [...new Set(courses.flatMap(course => 
    course.comma_separeted_tags?.split(',').map(tag => tag.trim()) || []
  ))].map(tag => ({
    id: tag,
    name: tag
  }));

  const instructors = [...new Set(courses.map(course => course.instructor))].map(instructor => ({
    id: instructor,
    name: instructor
  }));

  const hasActiveFilters = selectedLevels.length > 0 || selectedTags.length > 0 || selectedInstructors.length > 0;

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

        <div className="flex flex-col lg:flex-row p-2 sm:p-4 lg:p-8 bg-gray-50 min-h-screen">
          {/* Filter Panel - Full width on mobile, sidebar on desktop */}
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
                          {selectedLevels.length + selectedTags.length + selectedInstructors.length}
                        </span>
                      )}
                    </div>
                    <ChevronDown 
                      size={16} 
                      className={`text-gray-500 transition-transform ${isMobileFilterExpanded ? 'rotate-180' : ''}`} 
                    />
                  </button>
                </div>

                {/* Filter Content - Hidden on mobile when collapsed */}
                <div className={`lg:block ${isMobileFilterExpanded ? 'block' : 'hidden'}`}>
                  {/* Desktop Header */}
                  <div className="hidden lg:flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">Filters</h2>
                    <div className="flex gap-1">
                      <Button
                        onClick={clearAllFilters}
                        disabled={!hasActiveFilters}
                        className={`px-2 py-1 h-fit transition text-xs mt-[1px]`}
                      >
                        Clear All
                      </Button>
                      <Button
                        onClick={onApplyFilters}
                        disabled={!hasActiveFilters}
                        className={`px-2 py-1 h-fit transition text-xs mt-[1px]`}
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
                        className={`px-2 py-1 h-fit transition text-xs mt-[1px]`}
                      >
                        Clear All
                      </Button>
                      <Button
                        onClick={onApplyFilters}
                        disabled={!hasActiveFilters}
                        className={`px-2 py-1 h-fit transition text-xs mt-[1px]`}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>

                  <FilterSection
                    title="Level"
                    items={levels}
                    selectedItems={selectedLevels}
                    handleChange={(id) => toggleItem(id, selectedLevels, setSelectedLevels)}
                    disabled={levels.length === 0}
                  />

                  <FilterSection
                    title="Popular Tags"
                    items={tags}
                    selectedItems={selectedTags}
                    handleChange={(id) => toggleItem(id, selectedTags, setSelectedTags)}
                    disabled={tags.length === 0}
                  />

                  <FilterSection
                    title="Authors"
                    items={instructors}
                    selectedItems={selectedInstructors}
                    handleChange={(id) => toggleItem(id, selectedInstructors, setSelectedInstructors)}
                    disabled={instructors.length === 0}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="w-full lg:w-3/4 order-2">
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
                  <CourseImage 
                    previewImageUrl={course.thumbnail}
                    alt={course.title}
                    className="w-full h-48 object-cover"
                  />
                  
                  <div className="p-4 sm:p-6">
                    {/* Course Title */}
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 line-clamp-2">
                      {course.title}
                    </h3>
                    
                    {/* Course Description */}
                    <p className="text-sm sm:text-base text-gray-600 mb-4 line-clamp-2 sm:line-clamp-3">
                      {course.description}
                    </p>
                    
                    {/* Course Info */}
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                      {/* Price */}
                      <span className="text-xl sm:text-2xl font-bold text-primary-600">
                        {course.price === 0 ? "Free" : `$${course.price}`}
                      </span>
                      
                      {/* Badges */}
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-1 bg-primary-100 text-primary-800 text-xs sm:text-sm rounded-full">
                          {course.level}
                        </span>
                        {course.rating > 0 && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs sm:text-sm rounded-full">
                            ⭐ {course.rating.toFixed(1)}
                          </span>
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

      {/* Enrollment dialog removed - all enrollment happens on course details page */}
    </div>
  );
};
