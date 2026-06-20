import React, { useEffect, useRef, useState } from "react";
import { BASE_URL } from "@/constants/urls";
import { Capacitor } from "@capacitor/core";
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
import { getBackendCourseDuration } from "@/utils/courseTime";
import { PriceWithMrp } from "@/components/common/price-with-mrp";
import {
  getTerminology,
  getTerminologyPlural,
} from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, RoleTerms, SystemTerms } from "@/types/naming-settings";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  CaretDown,
  ChalkboardTeacher,
  Clock,
  File as FileIcon,
  GraduationCap,
  House,
  Info,
  Star,
  Tag,
} from "@phosphor-icons/react";

// Helper function to check if HTML content has actual visible text
// Returns false for empty HTML like "<p></p>", "<p> </p>", or just whitespace
const hasContent = (htmlString: string | undefined | null): boolean => {
  if (!htmlString) return false;
  // Strip HTML tags and decode HTML entities
  const textContent = htmlString
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/&nbsp;/gi, " ") // Replace &nbsp; with space
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
  return textContent.length > 0;
};

// HTML content block with a line-clamp + "View more / View less" toggle.
// The clamped flag is measured against scrollHeight so the toggle only
// appears when the content is actually tall enough to be cut off.
const HtmlWithViewMore: React.FC<{
  html: string;
  className?: string;
  clampLines?: number;
}> = ({ html, className, clampLines = 4 }) => {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const clampClass =
    clampLines === 3
      ? "line-clamp-3"
      : clampLines === 5
      ? "line-clamp-5"
      : clampLines === 6
      ? "line-clamp-6"
      : "line-clamp-4";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [html]);

  return (
    <div>
      <div
        ref={ref}
        className={cn(className, !expanded && clampClass)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {(clamped || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-sm font-medium text-primary-500 hover:underline focus:outline-none"
        >
          {expanded ? "View less" : "View more"}
        </button>
      )}
    </div>
  );
};

// Reusable card for each highlights section. Keeps the gradient-accent
// icon chip + hover overlay from the original scattered-card design so
// moving the sections into the accordion doesn't strip visual hierarchy.
const HighlightSectionCard: React.FC<{
  icon: React.ReactNode;
  iconBgClass: string;
  overlayClass: string;
  title: string;
  children: React.ReactNode;
}> = ({ icon, iconBgClass, overlayClass, title, children }) => (
  <div className="relative bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 p-3 sm:p-4 group">
    <div
      className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl",
        overlayClass
      )}
    />
    <div className="relative">
      <div className="flex items-center space-x-2 mb-3">
        <div
          className={cn(
            "p-1.5 rounded-lg shadow-sm bg-gradient-to-br",
            iconBgClass
          )}
        >
          {icon}
        </div>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  </div>
);

// Course highlights panel — collapsible accordion that wraps the
// "What you'll learn / About / Who should learn / Instructors" sections
// so they appear compactly at the top of the course page instead of
// stacking as separate cards below.
const CourseHighlightsAccordion: React.FC<{
  whyLearn: string;
  aboutCourse: string | null;
  whoShouldLearn: string;
  instructors: Array<{ name: string; email: string }>;
}> = ({ whyLearn, aboutCourse, whoShouldLearn, instructors }) => {
  const [open, setOpen] = useState(false);
  const hasWhy = hasContent(whyLearn);
  const hasAbout = hasContent(aboutCourse);
  const hasWho = hasContent(whoShouldLearn);
  const hasInstructors = instructors && instructors.length > 0;
  if (!hasWhy && !hasAbout && !hasWho && !hasInstructors) return null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
      >
        <span className="flex items-center gap-2 min-w-0">
          <div className="p-1 bg-primary-50 rounded-md">
            <Info className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" weight="bold" />
          </div>
          <span className="text-sm font-semibold truncate text-gray-900">
            {getTerminology(ContentTerms.Course, SystemTerms.Course)} highlights
          </span>
        </span>
        <CaretDown
          className={cn(
            "w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200",
            open ? "rotate-180" : "rotate-0"
          )}
          weight="bold"
        />
      </button>
      {open && (
        <div className="px-3 sm:px-4 pb-4 pt-3 space-y-3 border-t border-gray-100 bg-gray-50/50">
          {hasWhy && (
            <HighlightSectionCard
              title="What you'll learn"
              icon={
                <BookOpen
                  size={18}
                  className="text-success-600"
                  weight="duotone"
                />
              }
              iconBgClass="from-success-100 to-success-200"
              overlayClass="from-success-500/5 to-transparent"
            >
              <HtmlWithViewMore
                html={whyLearn}
                className="text-sm text-gray-600 leading-relaxed"
              />
            </HighlightSectionCard>
          )}
          {hasAbout && (
            <HighlightSectionCard
              title={`About this ${getTerminology(
                ContentTerms.Course,
                SystemTerms.Course
              ).toLowerCase()}`}
              icon={
                <FileIcon
                  size={18}
                  className="text-blue-600"
                  weight="duotone"
                />
              }
              iconBgClass="from-blue-100 to-blue-200"
              overlayClass="from-blue-500/5 to-transparent"
            >
              <HtmlWithViewMore
                html={aboutCourse || ""}
                className="text-sm text-gray-600 leading-relaxed"
              />
            </HighlightSectionCard>
          )}
          {hasWho && (
            <HighlightSectionCard
              title="Who should join"
              icon={
                <GraduationCap
                  size={18}
                  className="text-purple-600"
                  weight="duotone"
                />
              }
              iconBgClass="from-purple-100 to-purple-200"
              overlayClass="from-purple-500/5 to-transparent"
            >
              <HtmlWithViewMore
                html={whoShouldLearn}
                className="text-sm text-gray-600 leading-relaxed"
              />
            </HighlightSectionCard>
          )}
          {hasInstructors && (
            <HighlightSectionCard
              title={getTerminologyPlural(
                RoleTerms.Teacher,
                SystemTerms.Teacher
              )}
              icon={
                <ChalkboardTeacher
                  size={18}
                  className="text-orange-600"
                  weight="duotone"
                />
              }
              iconBgClass="from-orange-100 to-orange-200"
              overlayClass="from-orange-500/5 to-transparent"
            >
              <div className="space-y-2">
                {instructors.map((inst, idx) => (
                  <div
                    key={`${inst.email}-${idx}`}
                    className="flex items-center gap-3 p-2.5 bg-gray-50/80 rounded-lg hover:bg-gray-100/80 transition-all duration-300"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-500 text-white text-xs font-semibold rounded-full flex items-center justify-center">
                      {inst.name ? inst.name.charAt(0).toUpperCase() : "I"}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">
                        {inst.name ||
                          getTerminology(RoleTerms.Teacher, SystemTerms.Teacher)}
                      </h4>
                      <p className="text-xs text-gray-600">
                        {inst.email || "No email provided"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </HighlightSectionCard>
          )}
        </div>
      )}
    </section>
  );
};

interface CourseDetailsPageProps {
  courseId: string;
  tagName: string;
  instituteId: string;
  instituteThemeCode?: string | null;
  enrollInviteId?: string;
  packageSessionId?: string;
  bannerImage?: string;
  level?: string;
  price?: string;
  available_slots?: number;
}

interface CourseData {
  id: string;
  title: string;
  description: string | null;
  duration: string | null;
  instructor: string | null;
  price: number;
  elevatedPrice?: number;
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
  course_banner_media_id?: string;
  comma_separeted_tags?: string;
  course_html_description_html?: string;
  about_the_course_html?: string;
  currency?: string;
  available_slots?: number;
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
  price,
  available_slots,
}) => {
  const navigate = useNavigate();
  const domainRouting = useDomainRouting();
  const isAndroid = Capacitor.getPlatform() === "android";
  const isIOS = Capacitor.getPlatform() === "ios";
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getCardStyling = () => {
    if (!catalogueData?.globalSettings) {
      return {
        hover: { shadow: true, scale: 1.05 },
      };
    }

    const globalSettings = catalogueData.globalSettings as any;

    // Find course details page styling
    const detailsPage = globalSettings.pages?.find(
      (page: any) => page.id === "details",
    );
    return (
      detailsPage?.components?.[0]?.style?.card || {
        hover: { shadow: true, scale: 1.05 },
      }
    );
  };
  const [showLeadCollection, setShowLeadCollection] = useState(false);
  const [catalogueData, setCatalogueData] =
    useState<CourseCatalogueData | null>(null);

  // Debug catalogue data changes
  useEffect(() => {
    console.log("[CourseDetailsPage] Catalogue data loaded:", !!catalogueData);
  }, [catalogueData]);
  const [enrollmentDialogOpen, setEnrollmentDialogOpen] = useState(false);

  // Fetch catalogue data for header and footer
  useEffect(() => {
    const fetchCatalogueData = async () => {
      try {
        const data = await CourseCatalogueService.getCourseCatalogueByTag(
          instituteId,
          tagName,
        );
        setCatalogueData(data);
      } catch (error) {
        console.error(
          "[CourseDetailsPage] Failed to fetch catalogue data:",
          error,
        );
        console.error("[CourseDetailsPage] Error details:", {
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          response: (error as any)?.response?.data,
        });
        // Set empty catalogue data as fallback
        setCatalogueData({
          globalSettings: {
            courseCatalogeType: {
              enabled: false,
              value: "",
            },
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
                transition: "slide",
              },
              fields: [],
            },
            enrquiry: {
              enabled: true,
              requirePayment: false,
            },
            payment: {
              enabled: true,
              provider: "razorpay",
              fields: [],
            },
          },
          pages: [],
        });
      }
    };

    if (instituteId && tagName) {
      fetchCatalogueData();
    }
  }, [instituteId, tagName]);

  // Apply font from JSON if fonts.enabled is true
  useEffect(() => {
    const fonts = catalogueData?.globalSettings?.fonts;

    if (!fonts?.enabled || !fonts?.family) {
      document.body.style.fontFamily =
        "'Figtree', system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      return;
    }

    const fontFamily = fonts.family.trim();
    const primaryFont = fontFamily.split(",")[0].replace(/['"]/g, "").trim();

    // Create Google Fonts link
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      primaryFont,
    )}:wght@300;400;500;600;700&display=swap`;

    // Append link only once
    if (!document.querySelector(`link[href="${link.href}"]`)) {
      document.head.appendChild(link);
    }

    // Apply font exactly as specified in JSON
    document.body.style.fontFamily = fontFamily;
    document.documentElement.style.setProperty("--app-font-family", fontFamily);
  }, [catalogueData]);

  // Fetch course details
  useEffect(() => {
    const fetchCourseDetails = async () => {
      try {
        setIsLoading(true);

        // Fetch course details from /course-init API (scalable single course endpoint)
        const initApiResponse = await axios.get(
          `${BASE_URL}/admin-core-service/open/v1/learner-study-library/course-init`,
          {
            params: {
              instituteId: instituteId,
              courseId: courseId,
            },
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        // Extract the first (and only) course from the response
        const initData = initApiResponse.data;
        const courseResponse =
          Array.isArray(initData) && initData.length > 0 ? initData[0] : null;

        if (!courseResponse) {
          console.log("[CourseDetailsPage] Course not found in response");
          setError("Course not found.");
          return;
        }

        const course = courseResponse.course;

        // Check if course is published to catalogue
        if (course.is_course_published_to_catalaouge !== true) {
          setError("This course is not available for public viewing.");
          return;
        }

        // Use banner image from props if available, otherwise use API fields (raw media IDs)
        let thumbnailUrl = "/api/placeholder/800/400";
        if (bannerImage) {
          thumbnailUrl = bannerImage;
        } else {
          // Fallback to API fields (raw media IDs, same priority as course catalog)
          const thumbnailField =
            course.course_preview_image_media_id ||
            course.course_banner_media_id ||
            course.thumbnail_file_id;
          thumbnailUrl = thumbnailField || "/api/placeholder/800/400";
        }

        // Default price from course-init API
        let finalPrice = price
          ? parseFloat(price)
          : course.min_plan_actual_price || 0;
        let finalElevatedPrice: number | undefined =
          typeof course.min_plan_elevated_price === "number"
            ? course.min_plan_elevated_price
            : undefined;
        let finalCurrency = course.currency || "USD";

        // Fetch enroll-invite API to get the correct price and currency from payment plans
        // This API contains the actual payment_plans with actual_price and currency
        if (enrollInviteId && instituteId) {
          try {
            console.log(
              "[CourseDetailsPage] Fetching enroll-invite data for price...",
            );
            const enrollInviteResponse = await axios.get(
              `${BASE_URL}/admin-core-service/open/learner/enroll-invite/${instituteId}/${enrollInviteId}`,
              {
                headers: {
                  "Content-Type": "application/json",
                },
              },
            );

            console.log(
              "[CourseDetailsPage] Enroll Invite API response:",
              enrollInviteResponse.data,
            );

            const enrollInviteData = enrollInviteResponse.data;

            // Extract price and currency from payment_plans
            const paymentPlan =
              enrollInviteData?.package_session_to_payment_options?.[0]
                ?.payment_option?.payment_plans?.[0];

            if (paymentPlan) {
              const planPrice = paymentPlan.actual_price;
              const planElevated = paymentPlan.elevated_price;
              const planCurrency = paymentPlan.currency;

              console.log("[CourseDetailsPage] Payment plan found:", {
                actualPrice: planPrice,
                elevatedPrice: planElevated,
                currency: planCurrency,
                planName: paymentPlan.name,
              });

              if (planPrice !== undefined && planPrice !== null) {
                finalPrice = planPrice;
              }
              if (typeof planElevated === "number") {
                finalElevatedPrice = planElevated;
              }
              if (planCurrency) {
                finalCurrency = planCurrency;
              }
            } else {
              console.log(
                "[CourseDetailsPage] No payment plan found in enroll-invite response",
              );
            }
          } catch (enrollInviteError) {
            console.error(
              "[CourseDetailsPage] Failed to fetch enroll-invite data:",
              enrollInviteError,
            );
            // Continue with default price from course-init API
          }
        }

        // Known field-name placeholders that the backend sometimes echoes
        // back when a course field is unset. Treat them as empty so we
        // don't render raw identifiers to learners.
        const PLACEHOLDER_FIELD_NAMES = new Set([
          "about_the_course",
          "about_the_course_html",
          "course_html_description",
          "course_html_description_html",
          "who_should_learn",
          "why_learn",
          "course_preview_image_media_id",
          "course_banner_media_id",
          "thumbnail_file_id",
        ]);

        // Parse HTML content safely
        const parseHtmlContent = (htmlString: string) => {
          if (!htmlString) return "";
          // Remove HTML tags and decode entities for display
          const stripped = htmlString
            .replace(/<[^>]*>/g, "")
            .replace(/&nbsp;/g, " ")
            .trim();
          if (!stripped) return "";
          if (PLACEHOLDER_FIELD_NAMES.has(stripped)) return "";
          return stripped;
        };

        // Extract learning outcomes from HTML content
        const extractLearningOutcomes = (htmlContent: string) => {
          if (!htmlContent)
            return [
              "Learn practical skills",
              "Apply knowledge in real projects",
              "Gain industry insights",
            ];

          // Try to extract bullet points or list items
          const listItems = htmlContent.match(/<li[^>]*>(.*?)<\/li>/g);
          if (listItems && listItems.length > 0) {
            return listItems.map((item) => parseHtmlContent(item));
          }

          // Try to extract content between <strong> tags
          const strongItems = htmlContent.match(
            /<strong[^>]*>(.*?)<\/strong>/g,
          );
          if (strongItems && strongItems.length > 0) {
            return strongItems.map((item) => parseHtmlContent(item));
          }

          // Fallback to splitting by sentences
          return parseHtmlContent(htmlContent)
            .split(".")
            .filter((s) => s.trim().length > 10)
            .slice(0, 5);
        };

        // Parse comma-separated tags
        const parseTags = (tagsString: string) => {
          if (!tagsString) return [];
          return tagsString
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0);
        };

        // Transform API response to CourseData interface
        const courseData: CourseData = {
          id: course.id || courseId,
          title: course.package_name || "Untitled Course",
          description: parseHtmlContent(course.course_html_description) || null,
          duration: courseResponse.sessions?.[0]?.level_with_details?.[0]
            ?.read_time_in_minutes
            ? getBackendCourseDuration(
                courseResponse.sessions[0].level_with_details[0]
                  .read_time_in_minutes,
              )
            : null,
          instructor:
            courseResponse.sessions?.[0]?.level_with_details?.[0]
              ?.instructors?.[0]?.full_name || null,
          price: finalPrice,
          elevatedPrice: finalElevatedPrice,
          type: "Course", // Generic type since it's not specified in the API
          level: level || "Basic",
          thumbnail: thumbnailUrl,
          // Add fields for hero section - use placeholder if no valid image
          previewImage:
            course.course_preview_image_media_id &&
            course.course_preview_image_media_id !== null &&
            course.course_preview_image_media_id !== "null"
              ? course.course_preview_image_media_id
              : "/api/placeholder/400/300",
          bannerImage:
            course.course_banner_media_id &&
            course.course_banner_media_id !== null &&
            course.course_banner_media_id !== "null"
              ? course.course_banner_media_id
              : "/api/placeholder/400/300",
          fullDescription:
            parseHtmlContent(course.about_the_course) ||
            parseHtmlContent(course.course_html_description) ||
            "",
          learningOutcomes: extractLearningOutcomes(
            course.who_should_learn || course.why_learn,
          ),
          requirements: [
            "Basic computer skills",
            "Internet connection",
            "Motivation to learn",
          ],
          whoShouldLearn:
            parseHtmlContent(course.who_should_learn) ||
            "Anyone interested in learning this subject",
          whyLearn:
            parseHtmlContent(course.why_learn) ||
            "Gain valuable skills and knowledge",
          aboutCourse: parseHtmlContent(course.course_html_description) || null,
          instructors:
            courseResponse.sessions?.[0]?.level_with_details?.[0]?.instructors?.map(
              (inst: any) => ({
                name:
                  inst.full_name ||
                  `Unknown ${getTerminology(RoleTerms.Teacher, SystemTerms.Teacher)}`,
                email: inst.email || "No email provided",
              }),
            ) || [
              {
                name:
                  courseResponse.sessions?.[0]?.level_with_details?.[0]
                    ?.instructors?.[0]?.full_name ||
                  `Unknown ${getTerminology(RoleTerms.Teacher, SystemTerms.Teacher)}`,
                email:
                  courseResponse.sessions?.[0]?.level_with_details?.[0]
                    ?.instructors?.[0]?.email || "No email provided",
              },
            ],
          rating: course.rating || 5,
          tags: parseTags(course.tags || ""),
          curriculum: [], // No curriculum data available from API yet
          courseDepth: course.course_depth || 5, // Default to 5 to show full structure
          packageSessionId:
            packageSessionId || course.package_session_id || courseId, // Use passed packageSessionId or fallback to API response
          enrollInviteId: enrollInviteId || course.enroll_invite_id, // Use passed enrollInviteId or fallback to API response
          levelId: course.level_id, // Add levelId from API response
          courseId: course.course_id || courseId, // Add courseId from API response or use the route param
          course_banner_media_id: course.course_banner_media_id || "", // Explicitly pass the banner ID for BookDetailsComponent
          // Preserve raw HTML fields for BookDetailsComponent (filter placeholder field-name echoes)
          course_html_description_html:
            (PLACEHOLDER_FIELD_NAMES.has(
              (course.course_html_description || "").trim(),
            )
              ? ""
              : course.course_html_description) ||
            (PLACEHOLDER_FIELD_NAMES.has(
              (course.course_html_description_html || "").trim(),
            )
              ? ""
              : course.course_html_description_html) ||
            "",
          about_the_course_html:
            (PLACEHOLDER_FIELD_NAMES.has((course.about_the_course || "").trim())
              ? ""
              : course.about_the_course) ||
            (PLACEHOLDER_FIELD_NAMES.has(
              (course.about_the_course_html || "").trim(),
            )
              ? ""
              : course.about_the_course_html) ||
            "",
          comma_separeted_tags:
            course.tags || course.comma_separeted_tags || "",
          currency: finalCurrency,
          available_slots: available_slots,
        } as any;

        setCourseData(courseData);

        // Check if lead collection should be shown based on JSON configuration
        const globalSettings = catalogueData?.globalSettings as any;
        const leadCollectionConfig = globalSettings?.leadCollection;

        // Check if form has already been submitted
        const leadCollectionSubmittedKey = `leadCollectionSubmitted_${instituteId}_${tagName}`;
        const hasSubmittedLeadCollection =
          localStorage.getItem(leadCollectionSubmittedKey) === "true";

        if (leadCollectionConfig?.enabled && !hasSubmittedLeadCollection) {
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
      document.documentElement.setAttribute("data-theme", instituteThemeCode);
    }
  }, [instituteThemeCode]);

  // Apply the page-builder primary color (same as the catalogue page).
  // The details page previously had NO theme injection, so its buttons fell
  // back to the global ThemeProvider `--primary` — which can be a stale
  // `theme-custom-color` cached in localStorage (e.g. an old bright green).
  // Scope the catalogue's `theme.primaryColor` onto this page's wrapper so the
  // CTAs honor the institute color the admin set, exactly like the catalogue.
  const themeRootRef = useRef<HTMLDivElement>(null);
  const detailsPrimaryColor = (catalogueData?.globalSettings as any)?.theme
    ?.primaryColor as string | undefined;
  useEffect(() => {
    const el = themeRootRef.current;
    if (!el) return;
    if (detailsPrimaryColor && /^#[0-9a-fA-F]{6}$/.test(detailsPrimaryColor)) {
      const r = parseInt(detailsPrimaryColor.slice(1, 3), 16) / 255;
      const g = parseInt(detailsPrimaryColor.slice(3, 5), 16) / 255;
      const b = parseInt(detailsPrimaryColor.slice(5, 7), 16) / 255;
      const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
      const l = (max + min) / 2;
      let h = 0,
        s = 0;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
      }
      const H = Math.round(h * 360),
        S = Math.round(s * 100),
        L = Math.round(l * 100);
      el.style.setProperty("--primary-500", `${H} ${S}% ${L}%`);
      el.style.setProperty("--primary", `${H} ${S}% ${L}%`);
      el.style.setProperty("--primary-400", `${H} ${S}% ${Math.min(L + 10, 90)}%`);
      el.style.setProperty(
        "--primary-200",
        `${H} ${Math.max(S - 15, 10)}% ${Math.min(L + 28, 95)}%`,
      );
      el.style.setProperty(
        "--primary-50",
        `${H} ${Math.max(S - 30, 5)}% ${Math.min(L + 43, 98)}%`,
      );
    } else {
      el.style.removeProperty("--primary-500");
      el.style.removeProperty("--primary");
      el.style.removeProperty("--primary-400");
      el.style.removeProperty("--primary-200");
      el.style.removeProperty("--primary-50");
    }
  }, [detailsPrimaryColor]);

  // Listen for openLeadCollection event from HeaderComponent
  useEffect(() => {
    const handleOpenLeadCollection = () => {
      setShowLeadCollection(true);
    };

    window.addEventListener("openLeadCollection", handleOpenLeadCollection);

    return () => {
      window.removeEventListener(
        "openLeadCollection",
        handleOpenLeadCollection,
      );
    };
  }, []);

  const handleLeadCollectionClose = () => {
    setShowLeadCollection(false);
  };

  const handleLeadCollectionSubmit = () => {
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
            className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-400 transition-colors"
          >
            Back to Catalog
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={themeRootRef} className="min-h-screen bg-white w-full">
      {/* Render header and footer - add them if not in JSON */}
      {!catalogueData && (
        <div className="container mx-auto p-8 text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Loading Course Catalogue...
          </h2>
          <p className="text-gray-600">
            Please wait while we load the course information.
          </p>
        </div>
      )}

      {catalogueData && (
        <>
          {/* Header from JSON globalSettings — sticky like the catalogue page
              (it previously scrolled away on the details page). */}
          {(catalogueData.globalSettings as any).layout?.header &&
            (catalogueData.globalSettings as any).layout?.header?.enabled !==
              false && (
              <div
                className={
                  (catalogueData.globalSettings as any).stickyHeader !== false
                    ? "sticky top-0 z-50"
                    : ""
                }
              >
                <JsonRenderer
                  page={{
                    id: "header",
                    route: "header",
                    title: "Header",
                    components: [
                      (catalogueData.globalSettings as any).layout.header,
                    ],
                  }}
                  globalSettings={catalogueData.globalSettings}
                  instituteId={instituteId}
                  tagName={tagName}
                  catalogueData={catalogueData}
                />
              </div>
            )}

          {/* Render details page components from JSON */}
          {catalogueData.pages
            ?.filter(
              (page) =>
                page.id === "details" || page.route === "course-details",
            )
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
      {(catalogueData?.globalSettings as any)?.courseCatalogeType?.enabled !==
        true && (
        <div className="pt-4 pb-24 sm:pt-6 bg-gray-50 w-full">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-4">
                {/* Tags+title are rendered by the JSON catalogue hero
                    (HeroSectionComponent) above; we don't repeat them here.
                    If no hero is configured, no header shows. */}

                {/* Course highlights accordion — collapsed by default,
                    wraps the what-you'll-learn / about / who-should-learn /
                    instructors sections that used to stack as separate cards
                    below the structure. */}
                <CourseHighlightsAccordion
                  whyLearn={courseData.whyLearn}
                  aboutCourse={courseData.aboutCourse}
                  whoShouldLearn={courseData.whoShouldLearn}
                  instructors={courseData.instructors || []}
                />

                {/* Course Overview Card - Mobile First */}
                <div className="lg:hidden">
                  <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                      <div className="p-1.5 bg-primary-50 rounded-lg">
                        <House size={16} className="text-primary-500" weight="duotone" />
                      </div>
                      <h2 className="text-sm font-semibold text-gray-900">
                        Course Overview
                      </h2>
                    </div>

                    {/* Course Stats */}
                    <div className="space-y-2">
                      {/* Price - Only show if payment is enabled */}
                      {catalogueData?.globalSettings?.payment?.enabled !==
                        false && (
                        <div className="flex items-center justify-between py-2 px-3 bg-primary-50 rounded-lg border border-primary-100">
                          <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                            <Tag size={13} className="text-primary-400" />
                            Price
                          </span>
                          <PriceWithMrp
                            actual={courseData.price}
                            elevated={courseData.elevatedPrice}
                            currency={courseData.currency}
                            size="md"
                            className="text-primary-500 font-semibold"
                          />
                        </div>
                      )}

                      {/* Rating */}
                      <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                          <Star size={13} className="text-yellow-400" weight="fill" />
                          Rating
                        </span>
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                size={12}
                                weight="fill"
                                className={cn(
                                  star <= Math.floor(courseData.rating)
                                    ? "text-yellow-400"
                                    : "text-gray-200"
                                )}
                              />
                            ))}
                          </div>
                          <span className="text-xs font-semibold text-gray-900">
                            {courseData.rating > 0
                              ? courseData.rating.toFixed(1)
                              : "—"}
                          </span>
                        </div>
                      </div>

                      {/* Level */}
                      <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                          <GraduationCap size={13} className="text-gray-400" weight="duotone" />
                          Level
                        </span>
                        <span className="text-xs font-semibold text-gray-800 bg-white border border-gray-200 px-2 py-0.5 rounded-md">
                          {courseData.level}
                        </span>
                      </div>

                      {/* Duration */}
                      {courseData.duration && (
                        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                          <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                            <Clock size={13} className="text-gray-400" weight="duotone" />
                            Duration
                          </span>
                          <span className="text-xs font-semibold text-gray-800 bg-white border border-gray-200 px-2 py-0.5 rounded-md">
                            {courseData.duration}
                          </span>
                        </div>
                      )}

                      {/* Instructor */}
                      {courseData.instructor && (
                        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                          <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                            <ChalkboardTeacher size={13} className="text-gray-400" weight="duotone" />
                            {getTerminology(
                              RoleTerms.Teacher,
                              SystemTerms.Teacher,
                            )}
                          </span>
                          <span className="text-xs font-semibold text-gray-800 bg-white border border-gray-200 px-2 py-0.5 rounded-md max-w-32 truncate">
                            {courseData.instructor}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Enroll Button */}
                    <div className="pt-1 space-y-2">
                      <button
                        onClick={() => {
                          // Check if payment is disabled and lead collection is enabled
                          const globalSettings =
                            catalogueData?.globalSettings as any;
                          const leadCollectionConfig =
                            globalSettings?.leadCollection;
                          const paymentConfig = globalSettings?.payment;

                          // Check if payment is explicitly disabled (showPayment=false)
                          const showPayment = paymentConfig?.enabled === true;
                          const leadCollectionEnabled =
                            leadCollectionConfig?.enabled;

                          console.log("Payment config:", paymentConfig);
                          console.log(
                            "Lead collection config:",
                            leadCollectionConfig,
                          );
                          console.log("Show payment:", showPayment);
                          console.log(
                            "Lead collection enabled:",
                            leadCollectionEnabled,
                          );

                          // Check if this is a "Get Started" button (when payment is disabled)
                          const isGetStartedButton =
                            catalogueData?.globalSettings?.payment
                              ?.enabled === false;

                          // If this is a "Get Started" button or payment is disabled, check if lead collection is enabled
                          if (isGetStartedButton || !showPayment) {
                            console.log(
                              "Get Started button clicked - opening lead collection modal!",
                            );
                            // Force show lead collection
                            setShowLeadCollection(true);
                          } else {
                            setEnrollmentDialogOpen(true);
                          }
                        }}
                        className="w-full text-white py-3 px-4 rounded-lg text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.98] shadow-md"
                        style={{
                          backgroundColor: domainRouting.instituteThemeCode
                            ? `hsl(var(--primary))`
                            : "#3b82f6", // design-lint-ignore: page-builder default color
                        }}
                      >
                        {catalogueData?.globalSettings?.payment?.enabled !==
                        false
                          ? courseData.price === 0
                            ? "Enroll for Free"
                            : "Enroll Now"
                          : "Get Started"}
                      </button>
                      <p className="text-xs text-gray-400 text-center">
                        Click to register for this course
                      </p>
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

                {/* Content sections (what-you'll-learn / about /
                    who-should-learn / instructors / tags) moved into the
                    CourseHeroHeader + CourseHighlightsAccordion above the
                    course structure. */}
              </div>

              {/* Sidebar */}
              <div className="lg:col-span-1">
                <div className="sticky top-4 space-y-4">
                  {/* Course Overview Card - Hidden on mobile, shown on desktop */}
                  <div className="hidden lg:block bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                      <div className="p-1.5 bg-primary-50 rounded-lg">
                        <House size={16} className="text-primary-500" weight="duotone" />
                      </div>
                      <h2 className="text-sm font-semibold text-gray-900">
                        Course Overview
                      </h2>
                    </div>

                    {/* Course Stats */}
                    <div className="space-y-2">
                      {/* Price - Only show if payment is enabled */}
                      {catalogueData?.globalSettings?.payment?.enabled !==
                        false && (
                        <div className="flex items-center justify-between py-2 px-3 bg-primary-50 rounded-lg border border-primary-100">
                          <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                            <Tag size={13} className="text-primary-400" />
                            Price
                          </span>
                          <PriceWithMrp
                            actual={courseData.price}
                            elevated={courseData.elevatedPrice}
                            currency={courseData.currency}
                            size="md"
                            className="text-primary-500 font-semibold"
                          />
                        </div>
                      )}

                      {/* Rating */}
                      <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                          <Star size={13} className="text-yellow-400" weight="fill" />
                          Rating
                        </span>
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                size={12}
                                weight="fill"
                                className={cn(
                                  star <= Math.floor(courseData.rating)
                                    ? "text-yellow-400"
                                    : "text-gray-200"
                                )}
                              />
                            ))}
                          </div>
                          <span className="text-xs font-semibold text-gray-900">
                            {courseData.rating > 0
                              ? courseData.rating.toFixed(1)
                              : "—"}
                          </span>
                        </div>
                      </div>

                      {/* Level */}
                      <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                          <GraduationCap size={13} className="text-gray-400" weight="duotone" />
                          Level
                        </span>
                        <span className="text-xs font-semibold text-gray-800 bg-white border border-gray-200 px-2 py-0.5 rounded-md">
                          {courseData.level}
                        </span>
                      </div>

                      {/* Duration */}
                      {courseData.duration && (
                        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                          <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                            <Clock size={13} className="text-gray-400" weight="duotone" />
                            Duration
                          </span>
                          <span className="text-xs font-semibold text-gray-800 bg-white border border-gray-200 px-2 py-0.5 rounded-md">
                            {courseData.duration}
                          </span>
                        </div>
                      )}

                      {/* Instructor */}
                      {courseData.instructor && (
                        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                          <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                            <ChalkboardTeacher size={13} className="text-gray-400" weight="duotone" />
                            {getTerminology(
                              RoleTerms.Teacher,
                              SystemTerms.Teacher,
                            )}
                          </span>
                          <span className="text-xs font-semibold text-gray-800 bg-white border border-gray-200 px-2 py-0.5 rounded-md max-w-32 truncate">
                            {courseData.instructor}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Enroll Button */}
                    <div className="pt-1 space-y-2">
                      <button
                        onClick={() => {
                          // Check if payment is disabled and lead collection is enabled
                          const globalSettings =
                            catalogueData?.globalSettings as any;
                          const leadCollectionConfig =
                            globalSettings?.leadCollection;
                          const paymentConfig = globalSettings?.payment;

                          // Check if payment is explicitly disabled (showPayment=false)
                          const showPayment = paymentConfig?.enabled === true;
                          const leadCollectionEnabled =
                            leadCollectionConfig?.enabled;

                          console.log("Payment config:", paymentConfig);
                          console.log(
                            "Lead collection config:",
                            leadCollectionConfig,
                          );
                          console.log("Show payment:", showPayment);
                          console.log(
                            "Lead collection enabled:",
                            leadCollectionEnabled,
                          );

                          // Check if this is a "Get Started" button (when payment is disabled)
                          const isGetStartedButton =
                            catalogueData?.globalSettings?.payment
                              ?.enabled === false;

                          // If this is a "Get Started" button or payment is disabled, check if lead collection is enabled
                          if (isGetStartedButton || !showPayment) {
                            console.log(
                              "Get Started button clicked - opening lead collection modal!",
                            );
                            // Force show lead collection
                            setShowLeadCollection(true);
                          } else {
                            setEnrollmentDialogOpen(true);
                          }
                        }}
                        className="w-full text-white py-3 px-4 rounded-lg text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.98] shadow-md"
                        style={{
                          backgroundColor: domainRouting.instituteThemeCode
                            ? `hsl(var(--primary))`
                            : "#3b82f6", // design-lint-ignore: page-builder default color
                        }}
                      >
                        Enroll Now
                      </button>
                      <p className="text-xs text-gray-400 text-center">
                        Click to register for this course
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer from JSON globalSettings */}
      {catalogueData &&
        (catalogueData.globalSettings as any).layout?.footer &&
        (catalogueData.globalSettings as any).layout?.footer?.enabled !==
          false && (
          <JsonRenderer
            page={{
              id: "footer",
              route: "footer",
              title: "Footer",
              components: [(catalogueData.globalSettings as any).layout.footer],
            }}
            globalSettings={catalogueData.globalSettings}
            instituteId={instituteId}
            tagName={tagName}
          />
        )}

      {/* Lead Collection Modal */}
      {showLeadCollection && catalogueData?.globalSettings?.leadCollection && (
        <LeadCollectionModal
          isOpen={showLeadCollection}
          onClose={handleLeadCollectionClose}
          onSubmit={handleLeadCollectionSubmit}
          settings={{
            enabled:
              catalogueData?.globalSettings?.leadCollection?.enabled || false,
            mandatory:
              catalogueData?.globalSettings?.leadCollection?.mandatory || false,
            inviteLink:
              catalogueData?.globalSettings?.leadCollection?.inviteLink || null,
            formStyle: catalogueData?.globalSettings?.leadCollection
              ?.formStyle || {
              type: "single",
              showProgress: false,
              progressType: "bar",
              transition: "slide",
            },
            fields: catalogueData?.globalSettings?.leadCollection?.fields || [
              {
                name: "name",
                label: "Full Name",
                type: "text",
                required: true,
                step: 1,
              },
              {
                name: "email",
                label: "Email",
                type: "email",
                required: true,
                step: 2,
              },
              {
                name: "phone",
                label: "Phone Number",
                type: "tel",
                required: true,
                step: 3,
              },
            ],
          }}
          instituteId={instituteId}
          mandatory={
            catalogueData?.globalSettings?.leadCollection?.mandatory || false
          }
          packageSessionId={courseData.packageSessionId}
        />
      )}

      {/* Enrollment Payment Dialog */}
      {courseData && (
        <EnrollmentPaymentDialog
          open={enrollmentDialogOpen}
          onOpenChange={(open) => {
            if (open) {
            }
            setEnrollmentDialogOpen(open);
          }}
          instituteId={instituteId}
          courseData={{
            id: courseData.id,
            title: courseData.title,
            price: courseData.price,
            packageSessionId: courseData.packageSessionId,
            enrollInviteId: courseData.enrollInviteId || "",
          }}
          onSuccess={async (tokens) => {
            try {
              // Store tokens using the same method as other parts of the app
              const { setTokenInStorage } =
                await import("@/lib/auth/sessionUtility");
              const { TokenKey } = await import("@/constants/auth/tokens");
              const { Preferences } = await import("@capacitor/preferences");
              const { getTokenDecodedData } =
                await import("@/lib/auth/sessionUtility");
              const { fetchAndStoreInstituteDetails } =
                await import("@/services/fetchAndStoreInstituteDetails");
              const { fetchAndStoreStudentDetails } =
                await import("@/services/studentDetails");
              const { getStudentDisplaySettings } =
                await import("@/services/student-display-settings");
              const { identifyUser } = await import("@/lib/analytics");

              await setTokenInStorage(TokenKey.accessToken, tokens.accessToken);
              await setTokenInStorage(
                TokenKey.refreshToken,
                tokens.refreshToken,
              );
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
                  // Fetch and store student details. Pass a fallbackUser so a
                  // just-enrolled learner — whose student record may not be
                  // queryable yet right after enrollment — still gets
                  // StudentDetails persisted. Without it the student API throws,
                  // StudentDetails is never stored, isAuthenticated() returns
                  // false, and the learner is bounced to /login instead of being
                  // auto-logged-in.
                  await fetchAndStoreStudentDetails(instituteId, userId, {
                    id: userId,
                    username: tokenData?.username || "",
                    email: tokenData?.email || "",
                    full_name: tokenData?.username || "",
                    roles: ["STUDENT"],
                  });
                } catch (error) {
                  console.error("Error fetching student details:", error);
                }
              }

              console.log(
                "[CourseDetailsPage] All APIs called successfully, redirecting to /study-library/courses",
              );
              window.location.href = "/study-library/courses";
            } catch (error) {
              console.error(
                "[CourseDetailsPage] Error in onSuccess flow:",
                error,
              );
              // Fallback to localStorage if Capacitor Storage fails
              localStorage.setItem("accessToken", tokens.accessToken);
              localStorage.setItem("refreshToken", tokens.refreshToken);
              window.location.href = "/study-library/courses";
            }
          }}
        />
      )}

      {/* Mobile Action Buttons - Fixed at bottom for course details page */}
      {(catalogueData?.globalSettings as any)?.courseCatalogeType?.enabled !==
        true && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 p-4">
          <div className="flex flex-col gap-3">
            {/* Get Started Button */}
            <button
              onClick={() => {
                // Mirror the desktop CTA: enroll when payment is enabled,
                // otherwise fall back to the lead-collection form.
                if (catalogueData?.globalSettings?.payment?.enabled === true) {
                  setEnrollmentDialogOpen(true);
                } else {
                  setShowLeadCollection(true);
                }
              }}
              className="w-full px-4 py-3 text-white text-sm font-semibold hover:opacity-90 active:scale-[0.98] rounded-lg shadow-md transition-all duration-200"
              style={{
                backgroundColor: domainRouting.instituteThemeCode
                  ? `hsl(var(--primary))`
                  : "#3b82f6", // design-lint-ignore: page-builder default color
              }}
            >
              {catalogueData?.globalSettings?.payment?.enabled !== false
                ? courseData.price === 0
                  ? "Enroll for Free"
                  : "Enroll Now"
                : "Get Started"}
            </button>

            {/* Login Text */}
            <div
              className={`text-center border-gray-200 ${isAndroid || isIOS ? "mb-8" : ""}`}
            >
              <span
                onClick={() => navigate({ to: "/login" })}
                className="cursor-pointer text-sm transition-colors"
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "0.8";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
              >
                <span className="text-black">Already have an account? </span>
                <span
                  className="underline"
                  style={{
                    color: domainRouting.instituteThemeCode
                      ? `hsl(var(--primary))`
                      : "#3b82f6", // design-lint-ignore: page-builder default color
                  }}
                >
                  Login
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
