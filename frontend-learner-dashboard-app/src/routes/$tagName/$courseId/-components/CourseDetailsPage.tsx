import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { withArabicFallback } from "@/utils/branding";
import { BASE_URL, GET_PRODUCT_PAGE_BY_CODE } from "@/constants/urls";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InviteUnavailableMessage } from "@/components/common/enroll-by-invite/-components/InviteUnavailableMessage";
import {
  resolveInviteAvailability,
  extractUnavailableMessageHtml,
} from "@/lib/invite-availability";
import { getBackendCourseDuration } from "@/utils/courseTime";
import { PriceWithMrp } from "@/components/common/price-with-mrp";
import {
  getTerminology,
  getTerminologyPlural,
} from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, RoleTerms, SystemTerms } from "@/types/naming-settings";
import { cn, sanitizeHtml } from "@/lib/utils";
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

// Backend sometimes stores sentinel level names (e.g. "default") that must not
// surface in the course overview. Hide sentinels; show genuine values as-is.
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
  return trimmed;
};

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
  const { t } = useTranslation("coursePlayerB");
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
        className={cn("richtext-content", className, !expanded && clampClass)}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
      />
      {(clamped || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-sm font-medium text-primary-500 hover:underline focus:outline-none"
        >
          {expanded ? t("common.viewLess") : t("common.viewMore")}
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
  <div className="relative bg-catalogue-bg-elevated border border-catalogue-border rounded-catalogue-lg shadow-sm hover:shadow-md transition-all duration-300 p-3 sm:p-4 group">
    <div
      className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-catalogue-lg",
        overlayClass
      )}
    />
    <div className="relative">
      <div className="flex items-center space-x-2 mb-3">
        <div
          className={cn(
            "p-1.5 rounded-catalogue-md shadow-sm bg-gradient-to-br",
            iconBgClass
          )}
        >
          {icon}
        </div>
        <h2 className="text-base font-bold text-catalogue-text-primary">{title}</h2>
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
  showInstructors: boolean;
}> = ({ whyLearn, aboutCourse, whoShouldLearn, instructors, showInstructors }) => {
  const { t } = useTranslation("coursePlayerB");
  const [open, setOpen] = useState(true);
  const hasWhy = hasContent(whyLearn);
  const hasAbout = hasContent(aboutCourse);
  const hasWho = hasContent(whoShouldLearn);
  // Instructors only render when the institute opts in (default hidden).
  const hasInstructors = showInstructors && instructors && instructors.length > 0;
  if (!hasWhy && !hasAbout && !hasWho && !hasInstructors) return null;

  return (
    <section className="rounded-catalogue-lg border border-catalogue-border bg-catalogue-bg-elevated shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-start hover:bg-catalogue-bg-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
      >
        <span className="flex items-center gap-2 min-w-0">
          <div className="p-1 bg-primary-50 rounded-catalogue-sm">
            <Info className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" weight="bold" />
          </div>
          <span className="text-sm font-semibold truncate text-catalogue-text-primary">
            {t("courseDetails.accordion.highlightsTitle", {
              course: getTerminology(ContentTerms.Course, SystemTerms.Course),
            })}
          </span>
        </span>
        <CaretDown
          className={cn(
            "w-4 h-4 text-catalogue-text-muted flex-shrink-0 transition-transform duration-200",
            open ? "rotate-180" : "rotate-0"
          )}
          weight="bold"
        />
      </button>
      {open && (
        <div className="px-3 sm:px-4 pb-4 pt-3 space-y-3 border-t border-catalogue-border-subtle bg-catalogue-bg-subtle/50">
          {hasAbout && (
            <HighlightSectionCard
              title={t("courseDetails.accordion.aboutThisCourse", {
                course: getTerminology(ContentTerms.Course, SystemTerms.Course),
              })}
              icon={
                <FileIcon
                  size={18}
                  className="text-blue-600"
                  weight="duotone"
                />
              }
              iconBgClass="from-info-100 to-info-200"
              overlayClass="from-info-500/5 to-transparent"
            >
              <HtmlWithViewMore
                html={aboutCourse || ""}
                className="text-sm text-catalogue-text-secondary leading-relaxed"
              />
            </HighlightSectionCard>
          )}
          {hasWhy && (
            <HighlightSectionCard
              title={t("courseDetails.accordion.whatYoullLearn")}
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
                className="text-sm text-catalogue-text-secondary leading-relaxed"
              />
            </HighlightSectionCard>
          )}
          {hasWho && (
            <HighlightSectionCard
              title={t("courseDetails.accordion.whoShouldJoin")}
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
                className="text-sm text-catalogue-text-secondary leading-relaxed"
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
              iconBgClass="from-primary-100 to-primary-200"
              overlayClass="from-primary-500/5 to-transparent"
            >
              <div className="space-y-2">
                {instructors.map((inst, idx) => (
                  <div
                    key={`${inst.email}-${idx}`}
                    className="flex items-center gap-3 p-2.5 bg-catalogue-bg-subtle/80 rounded-catalogue-md hover:bg-catalogue-bg-muted/80 transition-all duration-300"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-500 text-white text-xs font-semibold rounded-full flex items-center justify-center">
                      {inst.name ? inst.name.charAt(0).toUpperCase() : "I"}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-catalogue-text-primary">
                        {inst.name ||
                          getTerminology(RoleTerms.Teacher, SystemTerms.Teacher)}
                      </h4>
                      <p className="text-xs text-catalogue-text-secondary">
                        {inst.email || t("courseDetails.noEmailProvided")}
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
  /**
   * Present when the visitor came from a Product Page offer section. Enrolling
   * then hands off to that product page's checkout (same funnel as its "Enrol
   * now" card CTA) instead of the standalone enroll-invite dialog.
   */
  productPageCode?: string;
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
  // Server-computed availability of the course's default enroll invite + the admin's
  // "unavailable" message (from the invite's setting_json). Drive the closed-state UI.
  enrollInviteAvailability?: string;
  unavailableMessageHtml?: string;
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
  productPageCode,
}) => {
  const { t } = useTranslation("coursePlayerB");
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
  // Teachers/Instructors section is hidden unless the institute opts in via
  // STUDENT_DISPLAY_SETTINGS. Fetched from the public (open) settings endpoint
  // because this catalogue page is unauthenticated.
  const [showInstructors, setShowInstructors] = useState(false);

  // Debug catalogue data changes
  useEffect(() => {
    console.log("[CourseDetailsPage] Catalogue data loaded:", !!catalogueData);
  }, [catalogueData]);

  useEffect(() => {
    if (!instituteId) return;
    let cancelled = false;
    axios
      .get(
        `${BASE_URL}/admin-core-service/open/institute/setting/v1/student-display`,
        { params: { instituteId } },
      )
      .then((res) => {
        if (cancelled) return;
        const cd = (
          res.data as { courseDetails?: { showInstructors?: boolean } } | null
        )?.courseDetails;
        setShowInstructors(cd?.showInstructors ?? false);
      })
      .catch(() => {
        if (!cancelled) setShowInstructors(false);
      });
    return () => {
      cancelled = true;
    };
  }, [instituteId]);
  const [enrollmentDialogOpen, setEnrollmentDialogOpen] = useState(false);
  // Shown when a learner tries to enroll through an expired / not-yet-started / deactivated invite.
  const [showUnavailableDialog, setShowUnavailableDialog] = useState(false);

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

    // Apply font exactly as specified in JSON, plus the Arabic fallback the
    // stack would otherwise drop (withArabicFallback preserves Latin order).
    const resolvedFontFamily = withArabicFallback(fontFamily);
    document.body.style.fontFamily = resolvedFontFamily;
    document.documentElement.style.setProperty("--app-font-family", resolvedFontFamily);
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
          setError(t("courseDetails.courseNotFoundError", {
            course: getTerminology(ContentTerms.Course, SystemTerms.Course),
          }));
          return;
        }

        const course = courseResponse.course;

        // Check if course is published to catalogue
        if (course.is_course_published_to_catalaouge !== true) {
          // A course sold on a Product Page is ALREADY public there — name,
          // price and an anonymous enrol button — so the catalogue publish
          // flag must not hide its details page. Most product-page courses are
          // not catalogue-published (214 of 219 on Shiksha Nation), which would
          // have dead-ended nearly every "View course" click.
          //
          // Membership is verified against the product page itself rather than
          // trusted from the URL, so a hand-typed ?productPageCode= cannot open
          // a course that page does not actually sell. Only reached for an
          // unpublished course, so a normal catalogue visit costs no extra
          // request (the payload carries every course on the page).
          let offeredByProductPage = false;
          if (productPageCode) {
            try {
              const productPage = await axios.get(
                GET_PRODUCT_PAGE_BY_CODE(productPageCode, instituteId),
              );
              offeredByProductPage = (productPage.data?.mappings ?? []).some(
                (m: { status?: string; package_id?: string }) =>
                  (m.status ?? "ACTIVE") === "ACTIVE" && m.package_id === courseId,
              );
            } catch (productPageError) {
              // Fail closed — an unreachable product page cannot vouch for it.
              console.warn(
                "[CourseDetailsPage] Product page lookup failed:",
                productPageError,
              );
            }
          }

          if (!offeredByProductPage) {
            setError(t("courseDetails.courseNotPublicError", {
              course: getTerminology(ContentTerms.Course, SystemTerms.Course),
            }));
            return;
          }
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
        // Availability window + admin "unavailable" message, read from the enroll-invite fetch below.
        let fetchedInviteAvailability: string | undefined;
        let fetchedInviteSettingJson: string | undefined;

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
            fetchedInviteAvailability = enrollInviteData?.availability_status;
            fetchedInviteSettingJson = enrollInviteData?.setting_json;

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

        // Preserve rich-text HTML for sections rendered via dangerouslySetInnerHTML
        // (About / What you'll learn / Who should join). Only drops placeholder
        // field-name echoes and visually-empty markup — keeps the formatting tags.
        const rawHtmlContent = (htmlString: string) => {
          if (!htmlString) return "";
          const trimmed = htmlString.trim();
          if (PLACEHOLDER_FIELD_NAMES.has(trimmed)) return "";
          const stripped = trimmed
            .replace(/<[^>]*>/g, "")
            .replace(/&nbsp;/g, " ")
            .trim();
          if (!stripped) return "";
          if (PLACEHOLDER_FIELD_NAMES.has(stripped)) return "";
          return htmlString;
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
        const courseTerm = getTerminology(ContentTerms.Course, SystemTerms.Course);
        const courseData: CourseData = {
          id: course.id || courseId,
          title: course.package_name || t("courseDetails.untitledCourse", { course: courseTerm }),
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
            rawHtmlContent(course.who_should_learn) ||
            t("courseDetails.defaultWhoShouldLearn", {
              subject: getTerminology(ContentTerms.Subjects, SystemTerms.Subjects),
            }),
          whyLearn:
            rawHtmlContent(course.why_learn) ||
            t("courseDetails.defaultWhyLearn"),
          // "About this course" must show the dedicated About field (rich text),
          // falling back to the course description. Previously read the wrong field
          // (course_html_description) and stripped all formatting.
          aboutCourse:
            rawHtmlContent(course.about_the_course) ||
            rawHtmlContent(course.course_html_description) ||
            null,
          instructors:
            courseResponse.sessions?.[0]?.level_with_details?.[0]?.instructors?.map(
              (inst: any) => ({
                name:
                  inst.full_name ||
                  t("courseDetails.unknownTeacher", {
                    teacher: getTerminology(RoleTerms.Teacher, SystemTerms.Teacher),
                  }),
                email: inst.email || t("courseDetails.noEmailProvided"),
              }),
            ) || [
              {
                name:
                  courseResponse.sessions?.[0]?.level_with_details?.[0]
                    ?.instructors?.[0]?.full_name ||
                  t("courseDetails.unknownTeacher", {
                    teacher: getTerminology(RoleTerms.Teacher, SystemTerms.Teacher),
                  }),
                email:
                  courseResponse.sessions?.[0]?.level_with_details?.[0]
                    ?.instructors?.[0]?.email || t("courseDetails.noEmailProvided"),
              },
            ],
          rating: course.rating || 5,
          tags: parseTags(course.tags || ""),
          curriculum: [], // No curriculum data available from API yet
          courseDepth: course.course_depth || 5, // Default to 5 to show full structure
          packageSessionId:
            packageSessionId || course.package_session_id || courseId, // Use passed packageSessionId or fallback to API response
          enrollInviteId: enrollInviteId || course.enroll_invite_id, // Use passed enrollInviteId or fallback to API response
          enrollInviteAvailability: fetchedInviteAvailability,
          unavailableMessageHtml: extractUnavailableMessageHtml(fetchedInviteSettingJson),
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
        setError(t("courseDetails.loadFailedError", {
          course: getTerminology(ContentTerms.Course, SystemTerms.Course),
        }));
      } finally {
        setIsLoading(false);
      }
    };

    if (courseId && instituteId) {
      fetchCourseDetails();
    }
  }, [courseId, tagName, instituteId, productPageCode]);

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
          <h2 className="text-2xl font-semibold text-catalogue-text-primary mb-2">
            {error || t("courseDetails.courseNotFoundDefault", {
              course: getTerminology(ContentTerms.Course, SystemTerms.Course),
            })}
          </h2>
          <p className="text-catalogue-text-secondary mb-4">
            {t("courseDetails.courseLoadFailedDescription", {
              course: getTerminology(ContentTerms.Course, SystemTerms.Course),
            })}
          </p>
          <button
            onClick={() => navigate({ to: `/${tagName}` })}
            className="px-4 py-2 bg-primary-500 text-white rounded-catalogue-sm hover:bg-primary-400 transition-colors"
          >
            {t("courseDetails.backToCatalog")}
          </button>
        </div>
      </div>
    );
  }

  // Enroll-invite availability (server-computed). When not AVAILABLE, every enroll CTA opens the
  // admin's "unavailable" message instead of the payment/lead flow.
  const inviteAvailability = resolveInviteAvailability(courseData.enrollInviteAvailability);
  const isEnrollmentClosed = inviteAvailability !== "AVAILABLE";
  const unavailableMessageHtml = courseData.unavailableMessageHtml ?? "";

  /**
   * Every enroll CTA on this page (desktop sidebar, inline card, mobile bar)
   * routes through here so the three never drift apart.
   *
   * Arrived from a Product Page offer section → hand back to that product
   * page's checkout with this course preselected, which is byte-for-byte the
   * destination its "Enrol now" card CTA uses. Otherwise keep the original
   * behaviour: payment dialog when payment is on, lead form when it is off.
   */
  const handleEnrollClick = () => {
    // Invite expired / not-yet-started / deactivated → show the admin message.
    if (isEnrollmentClosed) {
      setShowUnavailableDialog(true);
      return;
    }

    const psId = courseData.packageSessionId || packageSessionId;
    if (productPageCode && psId) {
      navigate({
        to: "/product-pages/$productPageCode",
        params: { productPageCode },
        search: {
          ...(instituteId ? { instituteId } : {}),
          courseIds: psId,
          defaultTab: "CART" as const,
        },
      });
      return;
    }

    // Payment disabled on the catalogue → the lead form is the conversion step.
    const paymentEnabled =
      (catalogueData?.globalSettings as any)?.payment?.enabled === true;
    if (paymentEnabled) {
      setEnrollmentDialogOpen(true);
    } else {
      setShowLeadCollection(true);
    }
  };

  // Honor the catalogue's light/dark mode, exactly like CourseCataloguePage.
  // Without this the details page kept light tokens under a dark catalogue:
  // the hero painted its configured dark background while the title still
  // resolved text-catalogue-text-primary to near-black (dark on dark), and the
  // content below stayed white.
  const isDarkMode = (catalogueData?.globalSettings as any)?.mode === "dark";

  return (
    <div
      ref={themeRootRef}
      data-catalogue-theme={
        (catalogueData?.globalSettings as any)?.theme?.preset || "default"
      }
      className={`min-h-screen bg-catalogue-bg w-full${isDarkMode ? " dark" : ""}`}
    >
      {/* Render header and footer - add them if not in JSON */}
      {!catalogueData && (
        <div className="container mx-auto p-8 text-center">
          <h2 className="text-2xl font-semibold text-catalogue-text-primary mb-4">
            {t("courseDetails.loadingCatalogueTitle", {
              course: getTerminology(ContentTerms.Course, SystemTerms.Course),
            })}
          </h2>
          <p className="text-catalogue-text-secondary">
            {t("courseDetails.loadingCatalogueDescription", {
              course: getTerminology(ContentTerms.Course, SystemTerms.Course),
            })}
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

          {/* Render details page components from JSON.
              HeaderComponent renders a `fixed` <header> (h-16 md:h-20) and emits
              no spacer, so the wrapper above collapses to zero height and the
              hero title would slide under it. The catalogue page reserves the
              same offset on its <main> (`pt-16 md:pt-20`) — mirror it here. */}
          <div
            className={
              (catalogueData.globalSettings as any).layout?.header &&
              (catalogueData.globalSettings as any).layout?.header?.enabled !==
                false
                ? "pt-16 md:pt-20"
                : ""
            }
          >
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
          </div>
        </>
      )}

      {/* Course Content */}
      {(catalogueData?.globalSettings as any)?.courseCatalogeType?.enabled !==
        true && (
        <div className="pt-4 pb-24 sm:pt-6 bg-catalogue-bg-subtle w-full">
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
                  showInstructors={showInstructors}
                />

                {/* Course Overview Card - Mobile First */}
                <div className="lg:hidden">
                  <div className="bg-catalogue-bg-elevated border border-catalogue-border rounded-catalogue-lg shadow-sm p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-center gap-2 pb-3 border-b border-catalogue-border-subtle">
                      <div className="p-1.5 bg-primary-50 rounded-catalogue-md">
                        <House size={16} className="text-primary-500" weight="duotone" />
                      </div>
                      <h2 className="text-sm font-semibold text-catalogue-text-primary">
                        {t("courseDetails.courseOverview", {
                          course: getTerminology(ContentTerms.Course, SystemTerms.Course),
                        })}
                      </h2>
                    </div>

                    {/* Course Stats */}
                    <div className="space-y-2">
                      {/* Price - Only show if payment is enabled */}
                      {catalogueData?.globalSettings?.payment?.enabled !==
                        false && (
                        <div className="flex items-center justify-between py-2 px-3 bg-primary-50 rounded-catalogue-md border border-primary-100">
                          <span className="text-xs font-medium text-catalogue-text-secondary flex items-center gap-1.5">
                            <Tag size={13} className="text-primary-400" />
                            {t("courseDetails.price")}
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
                      <div className="flex items-center justify-between py-2 px-3 bg-catalogue-bg-subtle rounded-catalogue-md">
                        <span className="text-xs font-medium text-catalogue-text-secondary flex items-center gap-1.5">
                          <Star size={13} className="text-yellow-400" weight="fill" />
                          {t("courseDetails.rating")}
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
                          <span className="text-xs font-semibold text-catalogue-text-primary">
                            {courseData.rating > 0
                              ? courseData.rating.toFixed(1)
                              : "—"}
                          </span>
                        </div>
                      </div>

                      {/* Level (hidden when the level is a sentinel like "Default") */}
                      {displayLevelName(courseData.level) && (
                        <div className="flex items-center justify-between py-2 px-3 bg-catalogue-bg-subtle rounded-catalogue-md">
                          <span className="text-xs font-medium text-catalogue-text-secondary flex items-center gap-1.5">
                            <GraduationCap size={13} className="text-catalogue-text-muted" weight="duotone" />
                            {getTerminology(ContentTerms.Level, SystemTerms.Level)}
                          </span>
                          <span className="text-xs font-semibold text-catalogue-text-primary bg-catalogue-bg-elevated border border-catalogue-border px-2 py-0.5 rounded-catalogue-sm">
                            {displayLevelName(courseData.level)}
                          </span>
                        </div>
                      )}

                      {/* Duration */}
                      {courseData.duration && (
                        <div className="flex items-center justify-between py-2 px-3 bg-catalogue-bg-subtle rounded-catalogue-md">
                          <span className="text-xs font-medium text-catalogue-text-secondary flex items-center gap-1.5">
                            <Clock size={13} className="text-catalogue-text-muted" weight="duotone" />
                            {t("courseDetails.duration")}
                          </span>
                          <span className="text-xs font-semibold text-catalogue-text-primary bg-catalogue-bg-elevated border border-catalogue-border px-2 py-0.5 rounded-catalogue-sm">
                            {courseData.duration}
                          </span>
                        </div>
                      )}

                      {/* Instructor */}
                      {courseData.instructor && (
                        <div className="flex items-center justify-between py-2 px-3 bg-catalogue-bg-subtle rounded-catalogue-md">
                          <span className="text-xs font-medium text-catalogue-text-secondary flex items-center gap-1.5">
                            <ChalkboardTeacher size={13} className="text-catalogue-text-muted" weight="duotone" />
                            {getTerminology(
                              RoleTerms.Teacher,
                              SystemTerms.Teacher,
                            )}
                          </span>
                          <span className="text-xs font-semibold text-catalogue-text-primary bg-catalogue-bg-elevated border border-catalogue-border px-2 py-0.5 rounded-catalogue-sm max-w-32 truncate">
                            {courseData.instructor}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Enroll Button */}
                    <div className="pt-1 space-y-2">
                      <button
                        onClick={handleEnrollClick}
                        className="w-full text-white py-3 px-4 rounded-catalogue-md text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.98] shadow-md"
                        style={{
                          backgroundColor: `hsl(var(--primary-500, var(--primary)))`,
                        }}
                      >
                        {catalogueData?.globalSettings?.payment?.enabled !==
                        false
                          ? courseData.price === 0
                            ? t("courseDetails.enrollForFree")
                            : t("courseDetails.enrollNow")
                          : t("courseDetails.getStarted")}
                      </button>
                      <p className="text-xs text-catalogue-text-muted text-center">
                        {t("courseDetails.clickToRegister", {
                          course: getTerminology(ContentTerms.Course, SystemTerms.Course),
                        })}
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
                  <div className="hidden lg:block bg-catalogue-bg-elevated border border-catalogue-border rounded-catalogue-lg shadow-sm p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-center gap-2 pb-3 border-b border-catalogue-border-subtle">
                      <div className="p-1.5 bg-primary-50 rounded-catalogue-md">
                        <House size={16} className="text-primary-500" weight="duotone" />
                      </div>
                      <h2 className="text-sm font-semibold text-catalogue-text-primary">
                        {t("courseDetails.courseOverview", {
                          course: getTerminology(ContentTerms.Course, SystemTerms.Course),
                        })}
                      </h2>
                    </div>

                    {/* Course Stats */}
                    <div className="space-y-2">
                      {/* Price - Only show if payment is enabled */}
                      {catalogueData?.globalSettings?.payment?.enabled !==
                        false && (
                        <div className="flex items-center justify-between py-2 px-3 bg-primary-50 rounded-catalogue-md border border-primary-100">
                          <span className="text-xs font-medium text-catalogue-text-secondary flex items-center gap-1.5">
                            <Tag size={13} className="text-primary-400" />
                            {t("courseDetails.price")}
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
                      <div className="flex items-center justify-between py-2 px-3 bg-catalogue-bg-subtle rounded-catalogue-md">
                        <span className="text-xs font-medium text-catalogue-text-secondary flex items-center gap-1.5">
                          <Star size={13} className="text-yellow-400" weight="fill" />
                          {t("courseDetails.rating")}
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
                          <span className="text-xs font-semibold text-catalogue-text-primary">
                            {courseData.rating > 0
                              ? courseData.rating.toFixed(1)
                              : "—"}
                          </span>
                        </div>
                      </div>

                      {/* Level (hidden when the level is a sentinel like "Default") */}
                      {displayLevelName(courseData.level) && (
                        <div className="flex items-center justify-between py-2 px-3 bg-catalogue-bg-subtle rounded-catalogue-md">
                          <span className="text-xs font-medium text-catalogue-text-secondary flex items-center gap-1.5">
                            <GraduationCap size={13} className="text-catalogue-text-muted" weight="duotone" />
                            {getTerminology(ContentTerms.Level, SystemTerms.Level)}
                          </span>
                          <span className="text-xs font-semibold text-catalogue-text-primary bg-catalogue-bg-elevated border border-catalogue-border px-2 py-0.5 rounded-catalogue-sm">
                            {displayLevelName(courseData.level)}
                          </span>
                        </div>
                      )}

                      {/* Duration */}
                      {courseData.duration && (
                        <div className="flex items-center justify-between py-2 px-3 bg-catalogue-bg-subtle rounded-catalogue-md">
                          <span className="text-xs font-medium text-catalogue-text-secondary flex items-center gap-1.5">
                            <Clock size={13} className="text-catalogue-text-muted" weight="duotone" />
                            {t("courseDetails.duration")}
                          </span>
                          <span className="text-xs font-semibold text-catalogue-text-primary bg-catalogue-bg-elevated border border-catalogue-border px-2 py-0.5 rounded-catalogue-sm">
                            {courseData.duration}
                          </span>
                        </div>
                      )}

                      {/* Instructor */}
                      {courseData.instructor && (
                        <div className="flex items-center justify-between py-2 px-3 bg-catalogue-bg-subtle rounded-catalogue-md">
                          <span className="text-xs font-medium text-catalogue-text-secondary flex items-center gap-1.5">
                            <ChalkboardTeacher size={13} className="text-catalogue-text-muted" weight="duotone" />
                            {getTerminology(
                              RoleTerms.Teacher,
                              SystemTerms.Teacher,
                            )}
                          </span>
                          <span className="text-xs font-semibold text-catalogue-text-primary bg-catalogue-bg-elevated border border-catalogue-border px-2 py-0.5 rounded-catalogue-sm max-w-32 truncate">
                            {courseData.instructor}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Enroll Button */}
                    <div className="pt-1 space-y-2">
                      <button
                        onClick={handleEnrollClick}
                        className="w-full text-white py-3 px-4 rounded-catalogue-md text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.98] shadow-md"
                        style={{
                          backgroundColor: `hsl(var(--primary-500, var(--primary)))`,
                        }}
                      >
                        {t("courseDetails.enrollNow")}
                      </button>
                      <p className="text-xs text-catalogue-text-muted text-center">
                        {t("courseDetails.clickToRegister", {
                          course: getTerminology(ContentTerms.Course, SystemTerms.Course),
                        })}
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

      {/* Enrollment unavailable (expired / not-yet-started / deactivated invite) */}
      <Dialog open={showUnavailableDialog} onOpenChange={setShowUnavailableDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="sr-only">{t("courseDetails.enrollmentUnavailableTitle")}</DialogTitle>
          </DialogHeader>
          <InviteUnavailableMessage
            availability={inviteAvailability}
            messageHtml={unavailableMessageHtml}
            className="py-2"
          />
        </DialogContent>
      </Dialog>

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
                label: t("courseDetails.leadFormDefaults.fullName"),
                type: "text",
                required: true,
                step: 1,
              },
              {
                name: "email",
                label: t("courseDetails.leadFormDefaults.email"),
                type: "email",
                required: true,
                step: 2,
              },
              {
                name: "phone",
                label: t("courseDetails.leadFormDefaults.phone"),
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
        <div className="md:hidden fixed bottom-0 start-0 end-0 z-50 bg-catalogue-bg-elevated border-t border-catalogue-border p-4">
          <div className={`flex flex-col gap-3 ${isAndroid || isIOS ? "mb-8" : ""}`}>
            {/* Login Button */}
            <div className="flex flex-col gap-1">
              <button
                onClick={() => navigate({ to: "/login" })}
                className="w-full px-4 py-3 text-sm font-semibold hover:opacity-90 active:scale-[0.98] rounded-catalogue-md border transition-all duration-200"
                style={{
                  color: `hsl(var(--primary-500, var(--primary)))`,
                  borderColor: `hsl(var(--primary-500, var(--primary)))`,
                }}
              >
                {t("header.login")}
              </button>
            </div>

            {/* Get Started / Enroll Button */}
            <div className="flex flex-col gap-1">
              <button
                onClick={handleEnrollClick}
                className="w-full px-4 py-3 text-white text-sm font-semibold hover:opacity-90 active:scale-[0.98] rounded-catalogue-md shadow-md transition-all duration-200"
                style={{
                  backgroundColor: `hsl(var(--primary-500, var(--primary)))`,
                }}
              >
                {catalogueData?.globalSettings?.payment?.enabled !== false
                  ? courseData.price === 0
                    ? t("courseDetails.enrollForFree")
                    : t("courseDetails.enrollNow")
                  : t("courseDetails.getStarted")}
              </button>
              <span className="text-xs text-catalogue-text-secondary text-center">{t("courseDetails.forNewUsers")}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
