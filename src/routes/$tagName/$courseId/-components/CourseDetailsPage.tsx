import React, { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { LeadCollectionModal } from "../../-components/LeadCollectionModal";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import axios from "axios";
import { JsonRenderer } from "../../-components/JsonRenderer";
import { CourseCatalogueService } from "../../-services/course-catalogue-service";
import { CourseCatalogueData } from "../../-types/course-catalogue-types";
import { CourseStructureDetails } from "../../-components/CourseStructureDetails"; // Course structure component
import { EnrollmentPaymentDialog } from "../../-components/EnrollmentPaymentDialog";
import { getBackendCourseDuration, formatMinutesHuman } from "@/utils/courseTime";


interface CourseDetailsPageProps {
  courseId: string;
  tagName: string;
  instituteId: string;
  instituteThemeCode?: string | null;
  enrollInviteId?: string;
  packageSessionId?: string;
  bannerImage?: string;
  level?: string;
}

interface CourseData {
  id: string;
  title: string;
  description: string | null;
  duration: string | null;
  instructor: string | null;
  price: number;
  type: string;
  level: string;
  thumbnail: string;
  previewImage?: string;
  bannerImage?: string;
  fullDescription: string;
  learningOutcomes: string[];
  requirements: string[];
  whoShouldLearn: string;
  whyLearn: string;
  aboutCourse: string | null;
  instructors: Array<{
    name: string;
    email: string;
  }>;
  rating: number;
  tags: string[];
  curriculum: Array<{
    week: number;
    title: string;
    topics: string[];
  }>;
  courseDepth: number;
  packageSessionId: string;
  enrollInviteId?: string;
  levelId?: string;
  courseId?: string;
}

export const CourseDetailsPage: React.FC<CourseDetailsPageProps> = ({
  courseId,
  tagName,
  instituteId,
  instituteThemeCode,
  enrollInviteId,
  packageSessionId,
  bannerImage,
  level,
}) => {
  console.log("=== CourseDetailsPage RENDERED ===");
  const navigate = useNavigate();
  const domainRouting = useDomainRouting();
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debug logging for image data
  useEffect(() => {
    if (courseData) {
      console.log("[CourseDetailsPage] Course data updated:", {
        thumbnail: courseData.thumbnail,
        title: courseData.title,
        bannerImage: bannerImage
      });
    }
  }, [courseData, bannerImage]);


  const getCardStyling = () => {
    if (!catalogueData?.globalSettings) {
      return {
        hover: { shadow: true, scale: 1.05 }
      };
    }

    const globalSettings = catalogueData.globalSettings as any;
    
    // Find course details page styling
    const detailsPage = globalSettings.pages?.find((page: any) => page.id === "details");
    return detailsPage?.components?.[0]?.style?.card || { hover: { shadow: true, scale: 1.05 } };
  };
  const [showLeadCollection, setShowLeadCollection] = useState(false);
  const [catalogueData, setCatalogueData] = useState<CourseCatalogueData | null>(null);
  
  // Debug catalogue data changes
  useEffect(() => {
    console.log("[CourseDetailsPage] Catalogue data loaded:", !!catalogueData);
  }, [catalogueData]);
  const [enrollmentDialogOpen, setEnrollmentDialogOpen] = useState(false);

  // Fetch catalogue data for header and footer
  useEffect(() => {
    const fetchCatalogueData = async () => {
      try {
        console.log("[CourseDetailsPage] Fetching catalogue data for:", { instituteId, tagName });
        const data = await CourseCatalogueService.getCourseCatalogueByTag(instituteId, tagName);
        console.log("[CourseDetailsPage] Catalogue data received:", data);
        setCatalogueData(data);
      } catch (error) {
        console.error("[CourseDetailsPage] Failed to fetch catalogue data:", error);
        console.error("[CourseDetailsPage] Error details:", {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          response: (error as any)?.response?.data
        });
        // Set empty catalogue data as fallback
        setCatalogueData({
          globalSettings: {
            mode: "light",
            compactness: "medium",
            audience: "all",
            leadCollection: {
              enabled: false,
              mandatory: false,
              inviteLink: null,
              formStyle: {
                type: "single",
                showProgress: false,
                progressType: "bar",
                transition: "slide"
              },
              fields: []
            },
            enrquiry: {
              enabled: true,
              requirePayment: false
            },
            payment: {
              enabled: true,
              provider: "razorpay",
              fields: []
            }
          },
          pages: []
        });
      }
    };

    if (instituteId && tagName) {
      fetchCatalogueData();
    }
  }, [instituteId, tagName]);

  // Fetch course details
  useEffect(() => {
    const fetchCourseDetails = async () => {
      try {
        setIsLoading(true);
        console.log("[CourseDetailsPage] Fetching course details for:", { courseId, tagName, instituteId });
        
        // First, fetch course details from /init API to get full course information
        const initResponse = await axios.get(`${import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || "https://backend-stage.vacademy.io"}/admin-core-service/open/v1/learner-study-library/init`, {
          params: {
            instituteId: instituteId,
            packageId: courseId,
          },
          headers: {
            "Content-Type": "application/json",
          },
        });

        console.log("[CourseDetailsPage] Init API response:", initResponse.data);

        // Find the course in the init response
        const initData = initResponse.data;
        const courseResponse = initData.find((item: any) => item.course.id === courseId);
        
        if (!courseResponse) {
          console.log("[CourseDetailsPage] Course not found in init response");
          setError("Course not found.");
          return;
        }

        const course = courseResponse.course;

        // Check if course is published to catalogue
        if (course.is_course_published_to_catalaouge !== true) {
          console.log("[CourseDetailsPage] Course is not published to catalogue, showing error");
          setError("This course is not available for public viewing.");
          return;
        }

        console.log("[CourseDetailsPage] Course details from init API:", {
          id: course.id,
          package_name: course.package_name,
          course_html_description: course.course_html_description,
          course_preview_image_media_id: course.course_preview_image_media_id,
          course_banner_media_id: course.course_banner_media_id,
          why_learn: course.why_learn,
          who_should_learn: course.who_should_learn,
          about_the_course: course.about_the_course,
          tags: course.tags,
          course_depth: course.course_depth,
          is_course_published_to_catalaouge: course.is_course_published_to_catalaouge
        });
        
        console.log("[CourseDetailsPage] Props from search API:", {
          enrollInviteId,
          packageSessionId
        });
        
        
        // Use banner image from props if available, otherwise use API fields (raw media IDs)
        let thumbnailUrl = "/api/placeholder/800/400";
        if (bannerImage) {
          thumbnailUrl = bannerImage;
          console.log("[CourseDetailsPage] Using banner image from props:", thumbnailUrl);
        } else {
          // Fallback to API fields (raw media IDs, same priority as course catalog)
          const thumbnailField = course.course_preview_image_media_id || course.course_banner_media_id || course.thumbnail_file_id;
          thumbnailUrl = thumbnailField || "/api/placeholder/800/400";
          console.log("[CourseDetailsPage] Using raw media ID from API:", thumbnailUrl);
        }

        // For now, set price to 0 (free) since init API doesn't have pricing info
        // TODO: Implement pricing logic if needed
        let finalPrice = 0;

        // Parse HTML content safely
        const parseHtmlContent = (htmlString: string) => {
          if (!htmlString) return "";
          // Remove HTML tags and decode entities for display
          return htmlString.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
        };

        // Extract learning outcomes from HTML content
        const extractLearningOutcomes = (htmlContent: string) => {
          if (!htmlContent) return ["Learn practical skills", "Apply knowledge in real projects", "Gain industry insights"];
          
          // Try to extract bullet points or list items
          const listItems = htmlContent.match(/<li[^>]*>(.*?)<\/li>/g);
          if (listItems && listItems.length > 0) {
            return listItems.map(item => parseHtmlContent(item));
          }
          
          // Try to extract content between <strong> tags
          const strongItems = htmlContent.match(/<strong[^>]*>(.*?)<\/strong>/g);
          if (strongItems && strongItems.length > 0) {
            return strongItems.map(item => parseHtmlContent(item));
          }
          
          // Fallback to splitting by sentences
          return parseHtmlContent(htmlContent).split('.').filter(s => s.trim().length > 10).slice(0, 5);
        };

        // Parse comma-separated tags
        const parseTags = (tagsString: string) => {
          if (!tagsString) return [];
          return tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        };



        // Debug logging for description fields
        console.log("[CourseDetailsPage] Description debug:", {
          course_html_description: course.course_html_description,
          parsed_html_description: parseHtmlContent(course.course_html_description),
          final_description: parseHtmlContent(course.course_html_description) || null
        });

        // Transform API response to CourseData interface
        const courseData: CourseData = {
          id: course.id || courseId,
          title: course.package_name || "Untitled Course",
          description: parseHtmlContent(course.course_html_description) || null,
          duration: courseResponse.sessions?.[0]?.level_with_details?.[0]?.read_time_in_minutes ? getBackendCourseDuration(courseResponse.sessions[0].level_with_details[0].read_time_in_minutes) : null,
          instructor: courseResponse.sessions?.[0]?.level_with_details?.[0]?.instructors?.[0]?.full_name || null,
          price: finalPrice,
          type: "Course", // Generic type since it's not specified in the API
          level: level || "Basic",
          thumbnail: thumbnailUrl,
          // Add fields for hero section - use placeholder if no valid image
          previewImage: (course.course_preview_image_media_id && course.course_preview_image_media_id !== null && course.course_preview_image_media_id !== 'null') ? course.course_preview_image_media_id : "/api/placeholder/400/300",
          bannerImage: (course.course_banner_media_id && course.course_banner_media_id !== null && course.course_banner_media_id !== 'null') ? course.course_banner_media_id : "/api/placeholder/400/300",
          fullDescription: parseHtmlContent(course.about_the_course) || parseHtmlContent(course.course_html_description) || "",
          learningOutcomes: extractLearningOutcomes(course.who_should_learn || course.why_learn),
          requirements: [
            "Basic computer skills",
            "Internet connection", 
            "Motivation to learn"
          ],
          whoShouldLearn: parseHtmlContent(course.who_should_learn) || "Anyone interested in learning this subject",
          whyLearn: parseHtmlContent(course.why_learn) || "Gain valuable skills and knowledge",
          aboutCourse: parseHtmlContent(course.about_the_course) || parseHtmlContent(course.course_html_description) || null,
          instructors: courseResponse.sessions?.[0]?.level_with_details?.[0]?.instructors?.map((inst: any) => ({
            name: inst.full_name || "Unknown Instructor",
            email: inst.email || "No email provided"
          })) || [{
            name: courseResponse.sessions?.[0]?.level_with_details?.[0]?.instructors?.[0]?.full_name || "Unknown Instructor",
            email: courseResponse.sessions?.[0]?.level_with_details?.[0]?.instructors?.[0]?.email || "No email provided"
          }],
          rating: course.rating || 0,
          tags: parseTags(course.tags || ""),
          curriculum: [], // No curriculum data available from API yet
          courseDepth: course.course_depth || 5, // Default to 5 to show full structure
          packageSessionId: packageSessionId || course.package_session_id || courseId, // Use passed packageSessionId or fallback to API response
          enrollInviteId: enrollInviteId || course.enroll_invite_id, // Use passed enrollInviteId or fallback to API response
          levelId: course.level_id, // Add levelId from API response
          courseId: course.course_id || courseId // Add courseId from API response or use the route param
        };
        
        setCourseData(courseData);
        
        // Debug: Log the courseData that was set
        console.log("[CourseDetailsPage] CourseData set with values:", {
          levelId: courseData.levelId,
          courseId: courseData.courseId,
          packageSessionId: courseData.packageSessionId,
          levelIdFromAPI: course.level_id,
          courseIdFromAPI: course.course_id
        });
        
        // Check if lead collection should be shown based on JSON configuration
        const globalSettings = catalogueData?.globalSettings as any;
        const leadCollectionConfig = globalSettings?.leadCollection;
        
        if (leadCollectionConfig?.enabled) {
          setTimeout(() => {
            setShowLeadCollection(true);
          }, 2000);
        }
      } catch (err) {
        console.error("Error fetching course details:", err);
        setError("Failed to load course details");
      } finally {
        setIsLoading(false);
      }
    };

    if (courseId && instituteId) {
      fetchCourseDetails();
    }
  }, [courseId, tagName, instituteId]);

  // Apply institute theme
  useEffect(() => {
    if (instituteThemeCode) {
      document.documentElement.setAttribute('data-theme', instituteThemeCode);
    }
  }, [instituteThemeCode]);

  // Listen for openLeadCollection event from HeaderComponent
  useEffect(() => {
    const handleOpenLeadCollection = () => {
      console.log("[CourseDetailsPage] Received openLeadCollection event from HeaderComponent");
      setShowLeadCollection(true);
    };

    window.addEventListener('openLeadCollection', handleOpenLeadCollection);
    
    return () => {
      window.removeEventListener('openLeadCollection', handleOpenLeadCollection);
    };
  }, []);

  const handleLeadCollectionClose = () => {
    console.log("[CourseDetailsPage] Closing lead collection modal, catalogueData:", catalogueData);
    setShowLeadCollection(false);
  };

  const handleLeadCollectionSubmit = () => {
    console.log("[CourseDetailsPage] Lead collection form submitted");
    setShowLeadCollection(false);
  };

  if (isLoading) {
    return <DashboardLoader />;
  }

  if (error || !courseData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            {error || "Course not found"}
          </h2>
          <p className="text-gray-600 mb-4">
            The requested course could not be loaded.
          </p>
          <button
            onClick={() => navigate({ to: `/${tagName}` })}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            Back to Catalog
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white w-full">
      {/* Debug Info */}
      {console.log("CourseDetailsPage render state:", {
        isLoading,
        catalogueData: !!catalogueData,
        showLeadCollection,
        enrollmentDialogOpen: enrollmentDialogOpen
      })}

      {/* Render header and footer - add them if not in JSON */}
      {!catalogueData && (
        <div className="container mx-auto p-8 text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Loading Course Catalogue...</h2>
          <p className="text-gray-600">Please wait while we load the course information.</p>
        </div>
      )}
      
      {catalogueData && (
        <>
          {/* Header from JSON globalSettings */}
          {(catalogueData.globalSettings as any).layout?.header && (catalogueData.globalSettings as any).layout?.header?.enabled !== false && (
            <JsonRenderer
              page={{
                id: "header",
                route: "header",
                title: "Header",
                components: [(catalogueData.globalSettings as any).layout.header]
              }}
              globalSettings={catalogueData.globalSettings}
              instituteId={instituteId}
              tagName={tagName}
            />
          )}
          
          {/* Render details page components from JSON */}
          {catalogueData.pages
            ?.filter(page => page.id === "details" || page.route === "course-details")
            ?.map((page) => (
              <JsonRenderer
                key={page.id}
                page={page}
                globalSettings={catalogueData.globalSettings}
                instituteId={instituteId}
                tagName={tagName}
                courseData={courseData}
              />
            ))}
        </>
      )}


      {/* Course Content */}
      <div className="py-8 sm:py-12 bg-gray-50 w-full">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-4">
              {/* Course Overview Card - Mobile First */}
              <div className="lg:hidden">
                <div
                  className="relative bg-white border border-gray-200 rounded-md shadow-sm hover:shadow-md transition-all duration-300 p-3 sm:p-4 group animate-fade-in-up"
                  style={{ animationDelay: "0.7s" }}
                >
                  {/* Background gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md"></div>

                  {/* Floating orb effect */}
                  <div className="absolute top-0 right-0 w-12 h-12 bg-primary-100/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 -translate-y-1 translate-x-3"></div>

                  <div className="relative">
                    {/* Header */}
                    <div className="flex items-center space-x-2 mb-4">
                      <div className="p-1.5 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg shadow-sm">
                        <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 2L3 7v11a1 1 0 001 1h12a1 1 0 001-1V7l-7-5zM8 15V9h4v6H8z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <h2 className="text-base font-bold text-gray-900">
                        Course Overview
                      </h2>
                    </div>

                    {/* Course Stats */}
                    <div className="space-y-3">
                      {/* Price - Only show if payment is enabled */}
                      {catalogueData?.globalSettings?.payment?.enabled !== false && (
                        <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg border border-primary-200">
                          <span className="text-xs font-medium text-primary-700">Price</span>
                          <span className="text-lg font-bold text-primary-800">
                            {courseData.price === 0 ? "Free" : `$${courseData.price}`}
                          </span>
                        </div>
                      )}

                      {/* Rating */}
                      <div className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg">
                        <span className="text-xs font-medium text-gray-700">Rating</span>
                        <div className="flex items-center space-x-1">
                          <div className="flex items-center">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <svg
                                key={star}
                                className={`w-3 h-3 ${
                                  star <= Math.floor(courseData.rating)
                                    ? "text-yellow-400"
                                    : "text-gray-300"
                                }`}
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                          <span className="text-xs font-bold text-gray-900">
                            {courseData.rating > 0 ? courseData.rating.toFixed(1) : "No rating"}
                          </span>
                        </div>
                      </div>

                      {/* Level */}
                      <div className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg">
                        <span className="text-xs font-medium text-gray-700">Level</span>
                        <span className="text-xs font-bold text-gray-900 bg-white px-2 py-0.5 rounded-md shadow-sm">
                          {courseData.level}
                        </span>
                      </div>

                      {/* Duration */}
                      {courseData.duration && (
                        <div className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg">
                          <span className="text-xs font-medium text-gray-700">Duration</span>
                          <span className="text-xs font-bold text-gray-900 bg-white px-2 py-0.5 rounded-md shadow-sm">
                            {courseData.duration}
                          </span>
                        </div>
                      )}

                      {/* Instructor */}
                      {courseData.instructor && (
                        <div className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg">
                          <span className="text-xs font-medium text-gray-700">Instructor</span>
                          <span className="text-xs font-bold text-gray-900 bg-white px-2 py-0.5 rounded-md shadow-sm">
                            {courseData.instructor}
                          </span>
                        </div>
                      )}

                      {/* Enroll Button */}
                      <button
                        onClick={() => {
                          console.log("[CourseDetailsPage] Enroll button clicked!");
                          // Check if payment is disabled and lead collection is enabled
                          const globalSettings = catalogueData?.globalSettings as any;
                          const leadCollectionConfig = globalSettings?.leadCollection;
                          const paymentConfig = globalSettings?.payment;
                          
                          // Check if payment is explicitly disabled (showPayment=false)
                          const showPayment = paymentConfig?.enabled === true;
                          const leadCollectionEnabled = leadCollectionConfig?.enabled;
                          
                          console.log("Payment config:", paymentConfig);
                          console.log("Lead collection config:", leadCollectionConfig);
                          console.log("Show payment:", showPayment);
                          console.log("Lead collection enabled:", leadCollectionEnabled);
                          
                          // Check if this is a "Get Started" button (when payment is disabled)
                          const isGetStartedButton = catalogueData?.globalSettings?.payment?.enabled === false;
                          
                          // If this is a "Get Started" button or payment is disabled, always open lead collection
                          if (isGetStartedButton || !showPayment) {
                            console.log("Get Started button clicked - opening lead collection modal!");
                            console.log("Setting showLeadCollection to true");
                            setShowLeadCollection(true);
                          } else {
                            console.log("Enroll button clicked - opening enrollment payment dialog!");
                            setEnrollmentDialogOpen(true);
                          }
                        }}
                        className="w-full text-white py-3 px-4 rounded-lg text-sm font-semibold transition-all duration-200 transform shadow-lg"
                        style={{
                          backgroundColor: domainRouting.instituteThemeCode ? 
                            `hsl(var(--primary))` : 
                            '#3b82f6'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
                        }}
                      >
                        {catalogueData?.globalSettings?.payment?.enabled !== false 
                          ? (courseData.price === 0 ? "Enroll for Free" : "Enroll Now")
                          : "Get Started"
                        }
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Course Structure */}
              <CourseStructureDetails
                courseDepth={courseData.courseDepth}
                courseId={courseData.courseId || courseId}
                instituteId={instituteId}
                packageSessionId={courseData.packageSessionId}
                levelId={courseData.levelId}
              />

              {/* Content Sections in Card Layout */}
              <div className="space-y-4">
                {/* What You'll Learn Section */}
                {courseData.whyLearn && (
                  <div
                    className="relative bg-white border border-gray-200 rounded-md shadow-sm hover:shadow-md transition-all duration-300 p-3 sm:p-4 group animate-fade-in-up"
                    style={{ animationDelay: "0.3s" }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-success-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md"></div>
                    <div className="relative">
                      <div className="flex items-center space-x-2 mb-3">
                        <div className="p-1.5 bg-gradient-to-br from-success-100 to-success-200 rounded-lg shadow-sm">
                          <svg className="w-4 h-4 text-success-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h2 className="text-base font-bold text-gray-900">
                          What you'll learn
                        </h2>
                      </div>
                      <div
                        className="text-sm text-gray-600 leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: courseData.whyLearn || "",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* About Course Section */}
                {courseData.aboutCourse && courseData.aboutCourse.trim() !== "" && (
                  <div
                    className="relative bg-white border border-gray-200 rounded-md shadow-sm hover:shadow-md transition-all duration-300 p-3 sm:p-4 group animate-fade-in-up"
                    style={{ animationDelay: "0.4s" }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md"></div>
                    <div className="relative">
                      <div className="flex items-center space-x-2 mb-3">
                        <div className="p-1.5 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg shadow-sm">
                          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <h2 className="text-base font-bold text-gray-900">
                          About this course
                        </h2>
                      </div>
                      <div
                        className="text-sm text-gray-600 leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: courseData.aboutCourse || "",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Who Should Learn Section */}
                {courseData.whoShouldLearn && (
                  <div
                    className="relative bg-white border border-gray-200 rounded-md shadow-sm hover:shadow-md transition-all duration-300 p-3 sm:p-4 group animate-fade-in-up"
                    style={{ animationDelay: "0.5s" }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md"></div>
                    <div className="relative">
                      <div className="flex items-center space-x-2 mb-3">
                        <div className="p-1.5 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg shadow-sm">
                          <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                          </svg>
                        </div>
                        <h2 className="text-base font-bold text-gray-900">
                          Who should learn
                        </h2>
                      </div>
                      <div
                        className="text-sm text-gray-600 leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: courseData.whoShouldLearn || "",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Instructors Section */}
                {courseData.instructors && courseData.instructors.length > 0 && (
                  <div
                    className="relative bg-white border border-gray-200 rounded-md shadow-sm hover:shadow-md transition-all duration-300 p-3 sm:p-4 group animate-fade-in-up"
                    style={{ animationDelay: "0.6s" }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md"></div>
                    <div className="relative">
                      <div className="flex items-center space-x-2 mb-3">
                        <div className="p-1.5 bg-gradient-to-br from-orange-100 to-orange-200 rounded-lg shadow-sm">
                          <svg className="w-4 h-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                          </svg>
                        </div>
                        <h2 className="text-base font-bold text-gray-900">
                          Instructors
                        </h2>
                      </div>
                      <div className="space-y-2">
                        {courseData.instructors.map((instructor, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-3 p-2.5 bg-gray-50/80 rounded-lg hover:bg-gray-100/80 transition-all duration-300"
                          >
                            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 text-white text-xs font-semibold rounded-full flex items-center justify-center">
                              {instructor.name ? instructor.name.charAt(0).toUpperCase() : 'I'}
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-gray-900">
                                {instructor.name || 'Instructor'}
                              </h3>
                              <p className="text-xs text-gray-600">
                                {instructor.email || 'No email provided'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tags Section */}
                {courseData.tags && courseData.tags.length > 0 && (
                  <div
                    className="relative bg-white border border-gray-200 rounded-md shadow-sm hover:shadow-md transition-all duration-300 p-3 sm:p-4 group animate-fade-in-up"
                    style={{ animationDelay: "0.7s" }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md"></div>
                    <div className="relative">
                      <div className="flex items-center space-x-2 mb-3">
                        <div className="p-1.5 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-lg shadow-sm">
                          <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <h2 className="text-base font-bold text-gray-900">
                          Course Tags
                        </h2>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {courseData.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-primary-100 text-primary-800 text-sm rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-4 space-y-4 lg:max-h-[calc(100vh-1rem)] overflow-y-auto">
                {/* Course Overview Card - Hidden on mobile, shown on desktop */}
                <div
                  className="hidden lg:block relative bg-white border border-gray-200 rounded-md shadow-sm hover:shadow-md transition-all duration-300 p-3 sm:p-4 group animate-fade-in-up"
                  style={{ animationDelay: "0.7s" }}
                >
                  {/* Background gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md"></div>

                  {/* Floating orb effect */}
                  <div className="absolute top-0 right-0 w-12 h-12 bg-primary-100/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 -translate-y-1 translate-x-3"></div>

                  <div className="relative">
                    {/* Header */}
                    <div className="flex items-center space-x-2 mb-4">
                      <div className="p-1.5 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg shadow-sm">
                        <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 2L3 7v11a1 1 0 001 1h12a1 1 0 001-1V7l-7-5zM8 15V9h4v6H8z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <h2 className="text-base font-bold text-gray-900">
                        Course Overview
                      </h2>
                    </div>

                    {/* Course Stats */}
                    <div className="space-y-3">
                      {/* Price - Only show if payment is enabled */}
                      {catalogueData?.globalSettings?.payment?.enabled !== false && (
                      <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg border border-primary-200">
                        <span className="text-xs font-medium text-primary-700">Price</span>
                        <span className="text-lg font-bold text-primary-800">
                          {courseData.price === 0 ? "Free" : `$${courseData.price}`}
                        </span>
                      </div>
                      )}

                      {/* Rating */}
                      <div className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg">
                        <span className="text-xs font-medium text-gray-700">Rating</span>
                        <div className="flex items-center space-x-1">
                          <div className="flex items-center">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <svg
                                key={star}
                                className={`w-3 h-3 ${
                                  star <= Math.floor(courseData.rating)
                                    ? "text-yellow-400"
                                    : "text-gray-300"
                                }`}
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                          <span className="text-xs font-bold text-gray-900">
                            {courseData.rating > 0 ? courseData.rating.toFixed(1) : "No rating"}
                          </span>
                        </div>
                      </div>

                      {/* Level */}
                      <div className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg">
                        <span className="text-xs font-medium text-gray-700">Level</span>
                        <span className="text-xs font-bold text-gray-900 bg-white px-2 py-0.5 rounded-md shadow-sm">
                          {courseData.level}
                        </span>
                      </div>

                      {/* Duration */}
                      {courseData.duration && (
                        <div className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg">
                          <span className="text-xs font-medium text-gray-700">Duration</span>
                          <span className="text-xs font-bold text-gray-900 bg-white px-2 py-0.5 rounded-md shadow-sm">
                            {courseData.duration}
                          </span>
                        </div>
                      )}

                      {/* Instructor */}
                      {courseData.instructor && (
                        <div className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg">
                          <span className="text-xs font-medium text-gray-700">Instructor</span>
                          <span className="text-xs font-bold text-gray-900 bg-white px-2 py-0.5 rounded-md shadow-sm">
                            {courseData.instructor}
                          </span>
                        </div>
                      )}

                    </div>

                    {/* Enroll Button with JSON Styling */}
                    <div className="mt-4">
                      <button 
                        onClick={() => {
                          console.log("[CourseDetailsPage] Enroll button clicked!");
                          // Check if payment is disabled and lead collection is enabled
                          const globalSettings = catalogueData?.globalSettings as any;
                          const leadCollectionConfig = globalSettings?.leadCollection;
                          const paymentConfig = globalSettings?.payment;
                          
                          // Check if payment is explicitly disabled (showPayment=false)
                          const showPayment = paymentConfig?.enabled === true;
                          const leadCollectionEnabled = leadCollectionConfig?.enabled;
                          
                          console.log("Payment config:", paymentConfig);
                          console.log("Lead collection config:", leadCollectionConfig);
                          console.log("Show payment:", showPayment);
                          console.log("Lead collection enabled:", leadCollectionEnabled);
                          
                          // Check if this is a "Get Started" button (when payment is disabled)
                          const isGetStartedButton = catalogueData?.globalSettings?.payment?.enabled === false;
                          
                          // If this is a "Get Started" button or payment is disabled, always open lead collection
                          if (isGetStartedButton || !showPayment) {
                            console.log("Get Started button clicked - opening lead collection modal!");
                            console.log("Setting showLeadCollection to true");
                            setShowLeadCollection(true);
                          } else {
                            console.log("Enroll button clicked - opening enrollment payment dialog!");
                            setEnrollmentDialogOpen(true);
                          }
                        }}
                        className="w-full text-white py-3 px-4 rounded-lg text-sm font-semibold transition-all duration-200 transform shadow-lg"
                        style={{
                          backgroundColor: domainRouting.instituteThemeCode ? 
                            `hsl(var(--primary))` : 
                            '#3b82f6',
                          transform: getCardStyling().hover?.scale ? `scale(${getCardStyling().hover.scale})` : 'scale(1)',
                          boxShadow: getCardStyling().hover?.shadow ? '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = domainRouting.instituteThemeCode ? 
                            `hsl(var(--primary))` : 
                            '#2563eb';
                          e.currentTarget.style.opacity = '0.9';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = domainRouting.instituteThemeCode ? 
                            `hsl(var(--primary))` : 
                            '#3b82f6';
                          e.currentTarget.style.opacity = '1';
                        }}
                      >
                        🎓 Enroll Now
                      </button>
                      
                      <div className="text-xs text-gray-500 text-center mt-2">
                        Click to register for this course
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer from JSON globalSettings */}
      {catalogueData && (catalogueData.globalSettings as any).layout?.footer && (catalogueData.globalSettings as any).layout?.footer?.enabled !== false && (
        <JsonRenderer
          page={{
            id: "footer",
            route: "footer",
            title: "Footer",
            components: [(catalogueData.globalSettings as any).layout.footer]
          }}
          globalSettings={catalogueData.globalSettings}
          instituteId={instituteId}
          tagName={tagName}
        />
      )}

      {/* Lead Collection Modal */}
      {showLeadCollection && (
        <LeadCollectionModal
          isOpen={showLeadCollection}
          onClose={handleLeadCollectionClose}
          onSubmit={handleLeadCollectionSubmit}
          settings={(() => {
            const globalSettings = catalogueData?.globalSettings as any;
            const leadCollectionConfig = globalSettings?.leadCollection;
            
            console.log("Lead collection settings being passed:", {
              catalogueData,
              globalSettings,
              leadCollectionConfig,
              fields: leadCollectionConfig?.fields,
              formStyle: leadCollectionConfig?.formStyle
            });
            
            return {
              enabled: true, // Force enable when triggered by buttons
              mandatory: leadCollectionConfig?.mandatory || false,
              inviteLink: leadCollectionConfig?.inviteLink || null,
              formStyle: leadCollectionConfig?.formStyle || {
                type: 'single',
                showProgress: false,
                progressType: 'bar',
                transition: 'slide'
              },
              fields: leadCollectionConfig?.fields || [
                {
                  name: "name",
                  label: "Full Name",
                  type: "text",
                  required: true,
                  step: 1
                },
                {
                  name: "email",
                  label: "Email",
                  type: "email",
                  required: true,
                  step: 2
                },
                {
                  name: "phone",
                  label: "Phone Number",
                  type: "tel",
                  required: true,
                  step: 3
                }
              ]
            };
          })()}
          instituteId={instituteId}
          mandatory={(() => {
            const mandatoryValue = catalogueData?.globalSettings?.leadCollection?.mandatory;
            console.log("[CourseDetailsPage] Mandatory value from JSON:", mandatoryValue);
            console.log("[CourseDetailsPage] Full leadCollection config:", catalogueData?.globalSettings?.leadCollection);
            return mandatoryValue || false;
          })()}
        />
      )}

      {/* Enrollment Payment Dialog */}
      {courseData && (
        <EnrollmentPaymentDialog
          open={enrollmentDialogOpen}
          onOpenChange={(open) => {
            if (open) {
              console.log('[CourseDetailsPage] Opening enrollment dialog with courseData:', {
                id: courseData.id,
                title: courseData.title,
                price: courseData.price,
                packageSessionId: courseData.packageSessionId,
                enrollInviteId: courseData.enrollInviteId
              });
            }
            setEnrollmentDialogOpen(open);
          }}
          instituteId={instituteId}
          courseData={{
            id: courseData.id,
            title: courseData.title,
            price: courseData.price,
            packageSessionId: courseData.packageSessionId,
            enrollInviteId: courseData.enrollInviteId || '',
          }}
          onSuccess={async (tokens) => {
            console.log('[CourseDetailsPage] onSuccess called with tokens:', tokens);
            try {
              // Store tokens using the same method as other parts of the app
              const { setTokenInStorage } = await import('@/lib/auth/sessionUtility');
              const { TokenKey } = await import('@/constants/auth/tokens');
              const { Preferences } = await import('@capacitor/preferences');
              const { getTokenDecodedData } = await import('@/lib/auth/sessionUtility');
              const { fetchAndStoreInstituteDetails } = await import('@/services/fetchAndStoreInstituteDetails');
              const { fetchAndStoreStudentDetails } = await import('@/services/studentDetails');
              const { getStudentDisplaySettings } = await import('@/services/student-display-settings');
              const { identifyUser } = await import('@/lib/analytics');
              
              await setTokenInStorage(TokenKey.accessToken, tokens.accessToken);
              await setTokenInStorage(TokenKey.refreshToken, tokens.refreshToken);
              await Preferences.set({ key: "instituteId", value: instituteId });
              await Preferences.set({ key: "InstituteId", value: instituteId });
              
              // Decode token to get user data (same as SessionLoginForm.tsx)
              const tokenData = getTokenDecodedData(tokens.accessToken);
              const userId = tokenData?.user;

              if (instituteId && userId) {
                // Identify user for analytics (same as SessionLoginForm.tsx)
                identifyUser(userId, {
                  username: tokenData?.username,
                  email: tokenData?.email,
                });

                try {
                  // Fetch and store institute details (same as SessionLoginForm.tsx)
                  await fetchAndStoreInstituteDetails(instituteId, userId);
                  getStudentDisplaySettings(true);
                } catch (error) {
                  console.error("Error fetching institute details:", error);
                }

                try {
                  // Fetch and store student details (same as SessionLoginForm.tsx)
                  await fetchAndStoreStudentDetails(instituteId, userId);
                } catch (error) {
                  console.error("Error fetching student details:", error);
                }
              }
              
              console.log('[CourseDetailsPage] All APIs called successfully, redirecting to /study-library/courses');
              window.location.href = '/study-library/courses';
            } catch (error) {
              console.error('[CourseDetailsPage] Error in onSuccess flow:', error);
              // Fallback to localStorage if Capacitor Storage fails
              localStorage.setItem('accessToken', tokens.accessToken);
              localStorage.setItem('refreshToken', tokens.refreshToken);
              window.location.href = '/study-library/courses';
            }
          }}
        />
      )}

      {/* Mobile Action Buttons - Fixed at bottom for course details page */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 p-4">
        <div className="flex flex-col gap-3">
          {/* Get Started Button */}
          <button
            onClick={() => {
              console.log("[CourseDetailsPage] Mobile Get Started button clicked");
              setShowLeadCollection(true);
            }}
            className="w-full px-4 py-2 text-white font-medium hover:opacity-90 rounded-md transition-colors"
            style={{
              backgroundColor: domainRouting.instituteThemeCode ? `hsl(var(--primary))` : '#3b82f6'
            }}
          >
            Get Started
          </button>
          
          {/* Login Text */}
          <div className="text-center">
            <span
              onClick={() => navigate({ to: '/login' })}
              className="cursor-pointer text-sm transition-colors"
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              <span className="text-black">Already have an account? </span>
              <span 
                className="underline"
                style={{
                  color: domainRouting.instituteThemeCode ? `hsl(var(--primary))` : '#3b82f6'
                }}
              >
                Login
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
