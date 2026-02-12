import React, { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import CoursesPage from "./CoursesPage.tsx";
import { useCatalogStore } from "../-store/catalogStore.ts";
import axios from "axios";
import {
  STUDENT_DETAIL,
  urlInstructor,
  urlPublicCourseDetails,
} from "@/constants/urls.ts";
import { getInstituteId } from "@/constants/helper.ts";
import { getUserId } from "@/constants/getUserId.ts";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance.ts";
import { toast } from "sonner";
import HeroSection from "../-component1/HeroSection.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IconBooks, IconChartBar, IconCheck } from "@tabler/icons-react";
import { CoursePackageResponse } from "@/types/course-catalog/course-catalog-list.ts";
import { ContentTerms, SystemTerms } from "@/types/naming-settings.ts";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils.ts";
import { Preferences } from "@capacitor/preferences";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
import type { StudentAllCoursesTabId } from "@/types/student-display-settings";
import { useDripConditionStore } from "@/stores/study-library/drip-conditions-store";
import { parseDripConditions } from "@/services/getIsDrippingEnable";
import { getChatbotSettings } from "@/services/chatbot-settings.ts";

/** Merge unique instructors from course list into existing list (by id). Ensures instructors attached to courses appear in the filter. */
function mergeInstructorsFromCourses(
  current: { id: string; full_name?: string; username?: string }[],
  courses: { instructors?: { id: string; full_name?: string; username?: string }[] }[]
): { id: string; full_name?: string; username?: string }[] {
  const byId = new Map(current.map((i) => [i.id, i]));
  for (const course of courses) {
    for (const inst of course.instructors || []) {
      if (inst?.id && typeof inst.id === "string" && !byId.has(inst.id)) {
        byId.set(inst.id, {
          id: inst.id,
          full_name: inst.full_name ?? inst.username,
          username: inst.username,
        });
      }
    }
  }
  return Array.from(byId.values());
}

const CourseCatalougePage: React.FC = () => {
  const [allowLeanersToCreateCourses, setAllowLeanersToCreateCourses] =
    useState<boolean>(false);

  // Use selectors to prevent re-renders when store state changes
  const setInstituteData = useCatalogStore((state) => state.setInstituteData);
  const setInstructors = useCatalogStore((state) => state.setInstructors);

  const setDripCondition = useDripConditionStore(
    (state) => state.setDripCondition
  );
  const clearDripCondition = useDripConditionStore(
    (state) => state.clearDripCondition
  );
  const setIsDrippingEnable = useDripConditionStore(
    (state) => state.setIsDrippingEnable
  );

  const [selectedTab, setSelectedTab] = useState("PROGRESS");
  const [visibleTabs, setVisibleTabs] = useState<
    { value: "ALL" | "PROGRESS" | "COMPLETED"; label?: string }[]
  >([
    { value: "PROGRESS", label: "In Progress" },
    { value: "COMPLETED", label: "Completed" },
    {
      value: "ALL",
      label: `All ${getTerminology(ContentTerms.Course, SystemTerms.Course)}s`,
    },
  ]);
  const [allCourses, setAllCourses] = useState<CoursePackageResponse>({
    content: [],
    empty: false,
    first: false,
    last: false,
    number: 0,
    numberOfElements: 0,
    pageable: {
      pageNumber: 0,
      pageSize: 10,
      offset: 0,
      paged: true,
      unpaged: false,
      sort: {
        unsorted: true,
        sorted: false,
        empty: true,
      },
    },
    size: 10,
    sort: {
      unsorted: true,
      sorted: false,
      empty: true,
    },
    totalElements: 0,
    totalPages: 0,
  });
  const [progressCourses, setProgressCourses] = useState<CoursePackageResponse>(
    {
      ...allCourses,
    }
  );
  const [completedCourses, setCompletedCourses] =
    useState<CoursePackageResponse>({
      ...allCourses,
    });
  const [isLoadingByTab, setIsLoadingByTab] = useState<{
    ALL: boolean;
    PROGRESS: boolean;
    COMPLETED: boolean;
  }>({
    ALL: false,
    PROGRESS: false,
    COMPLETED: false,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState("Newest");

  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedInstructors, setSelectedInstructors] = useState<string[]>([]);

  // Debounced search term to avoid multiple API calls during typing
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  // Track pagination per tab
  const [pageByTab, setPageByTab] = useState<{
    ALL: number;
    PROGRESS: number;
    COMPLETED: number;
  }>({
    ALL: 0,
    PROGRESS: 0,
    COMPLETED: 0,
  });
  const pageSize = 10;

  // Version key to trigger fetch only when filters are explicitly applied
  const [filtersVersion, setFiltersVersion] = useState(0);

  const getSortPayload = (sort: string) => {
    switch (sort) {
      case "Newest":
        return { createdAt: "DESC" };
      case "Oldest":
        return { createdAt: "ASC" };
      default:
        return { createdAt: "DESC" };
    }
  };

  /** Learner-packages API may expect snake_case in sort_columns; use this for the main request. */
  const getSortPayloadSnake = (sort: string) => {
    switch (sort) {
      case "Oldest":
        return { created_at: "ASC" };
      default:
        return { created_at: "DESC" };
    }
  };

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchCoursesForTab = useCallback(
    async (tabType: "ALL" | "PROGRESS" | "COMPLETED") => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (import.meta.env.DEV) {
        console.debug("[Catalog] fetch start", {
          tabType,
          page: pageByTab[tabType],
          sort: sortOption,
          search: debouncedSearch,
          levels: selectedLevels,
          instructors: selectedInstructors,
          tags: selectedTags,
        });
      }
      setIsLoadingByTab((prev) => ({ ...prev, [tabType]: true }));
      try {
        const instituteId = await getInstituteId();
        const body = {
          status: [] as string[],
          level_ids: selectedLevels ?? [],
          faculty_ids: selectedInstructors ?? [],
          search_by_name: debouncedSearch ?? "",
          tag: selectedTags ?? [],
          min_percentage_completed: 0,
          max_percentage_completed: 0,
          type: tabType,
          sort_columns: getSortPayloadSnake(sortOption),
        };
        const response = await authenticatedAxiosInstance.post(
          urlPublicCourseDetails,
          body,
          {
            params: {
              instituteId,
              page: pageByTab[tabType],
              size: pageSize,
            },
            headers: {
              accept: "*/*",
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          }
        );

        if (controller.signal.aborted) return;

        const data = response.data as CoursePackageResponse;
        if (tabType === "ALL") setAllCourses(data);
        if (tabType === "PROGRESS") setProgressCourses(data);
        if (tabType === "COMPLETED") setCompletedCourses(data);

        if (data.content?.length) {
          const current = useCatalogStore.getState().instructor;
          const merged = mergeInstructorsFromCourses(current, data.content);
          setInstructors(merged);
        }

        if (data.content && Array.isArray(data.content)) {
          data.content.forEach((course) => {
            if (course.id && course.drip_condition_json) {
              clearDripCondition(course.id);
              setDripCondition(course.id, course.drip_condition_json);
            } else if (course.id && !course.drip_condition_json) {
              clearDripCondition(course.id);
            }
          });
        }
      } catch (err) {
        if (controller.signal.aborted || axios.isCancel(err)) return;

        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        const message = axios.isAxiosError(err) ? err.response?.data : err;

        if (import.meta.env.DEV) {
          console.error("[Catalog] learner-packages search failed", { status, message, tabType });
        }
        if (status === 500) {
          toast.error("Something went wrong while loading courses. Please try again.");
        }

        if (tabType === "ALL" && status !== 500) {
          try {
            const { urlCourseDetails } = await import("@/constants/urls");
            const instituteId = await getInstituteId();
            const body = {
              status: [] as string[],
              level_ids: selectedLevels ?? [],
              faculty_ids: selectedInstructors ?? [],
              created_by_user_id: null as string | null,
              search_by_name: debouncedSearch ?? "",
              tag: selectedTags ?? [],
              min_percentage_completed: 0,
              max_percentage_completed: 0,
              type: "ALL" as const,
              sort_columns: getSortPayload(sortOption),
            };
            const response = await authenticatedAxiosInstance.post(
              urlCourseDetails,
              body,
              {
                params: {
                  instituteId,
                  page: pageByTab[tabType],
                  size: pageSize,
                },
                headers: {
                  accept: "*/*",
                  "Content-Type": "application/json",
                },
                signal: controller.signal,
              }
            );
            if (controller.signal.aborted) return;
            const fallbackData = response.data as CoursePackageResponse;
            setAllCourses(fallbackData);
            if (fallbackData.content?.length) {
              const current = useCatalogStore.getState().instructor;
              const merged = mergeInstructorsFromCourses(current, fallbackData.content);
              setInstructors(merged);
            }
            if (fallbackData.content && Array.isArray(fallbackData.content)) {
              fallbackData.content.forEach((course) => {
                if (course.id && course.drip_condition_json) {
                  clearDripCondition(course.id);
                  setDripCondition(course.id, course.drip_condition_json);
                } else if (course.id && !course.drip_condition_json) {
                  clearDripCondition(course.id);
                }
              });
            }
          } catch {
            // swallow fallback errors
          }
        }
      } finally {
        setIsLoadingByTab((prev) => ({ ...prev, [tabType]: false }));
      }
    },
    [
      selectedLevels,
      selectedInstructors,
      debouncedSearch,
      selectedTags,
      pageByTab,
      sortOption,
      setDripCondition,
      clearDripCondition,
      setInstructors,
    ]
  );

  const handleApplyFilters = async () => {
    // reset pages and trigger a fetch via filtersVersion change
    setPageByTab({ ALL: 0, PROGRESS: 0, COMPLETED: 0 });
    setFiltersVersion((v) => v + 1);
  };

  const clearAllFilters = async () => {
    setSelectedLevels([]);
    setSelectedTags([]);
    setSelectedInstructors([]);
    setSearchTerm("");
    setSortOption("Newest");
    setPageByTab({ ALL: 0, PROGRESS: 0, COMPLETED: 0 });
    setFiltersVersion((v) => v + 1);
  };

  // Single consolidated fetch: run when selected tab changes, or
  // when debounced search, sort, applied filters, or pagination for the active tab changes
  const currentPageForActiveTab =
    pageByTab[selectedTab as "ALL" | "PROGRESS" | "COMPLETED"];
  useEffect(() => {
    fetchCoursesForTab(selectedTab as "ALL" | "PROGRESS" | "COMPLETED");
  }, [
    selectedTab,
    debouncedSearch,
    sortOption,
    filtersVersion,
    currentPageForActiveTab,
    fetchCoursesForTab,
  ]);

  // Reset current tab page to 0 when search or sort changes
  useEffect(() => {
    setPageByTab((prev) => ({ ...prev, [selectedTab]: 0 } as typeof prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, sortOption]);

  // Pagination handlers per tab (MyPagination is zero-based)
  const handlePageChangeAll = (page: number) => {
    if (import.meta.env.DEV) {
      console.debug("[Catalog] change page ALL", { page });
    }
    setPageByTab((prev) => ({ ...prev, ALL: Math.max(0, page) }));
  };
  const handlePageChangeProgress = (page: number) => {
    if (import.meta.env.DEV) {
      console.debug("[Catalog] change page PROGRESS", { page });
    }
    setPageByTab((prev) => ({ ...prev, PROGRESS: Math.max(0, page) }));
  };
  const handlePageChangeCompleted = (page: number) => {
    if (import.meta.env.DEV) {
      console.debug("[Catalog] change page COMPLETED", { page });
    }
    setPageByTab((prev) => ({ ...prev, COMPLETED: Math.max(0, page) }));
  };

  // Enforce Student Display Settings: visible/order tabs and default tab
  useEffect(() => {
    const mapSettingIdToValue = (
      id: StudentAllCoursesTabId
    ): "ALL" | "PROGRESS" | "COMPLETED" => {
      switch (id) {
        case "AllCourses":
          return "ALL";
        case "InProgress":
          return "PROGRESS";
        case "Completed":
          return "COMPLETED";
        default:
          return "PROGRESS";
      }
    };

    getStudentDisplaySettings(false).then((settings) => {
      const tabs = settings?.allCourses?.tabs || [];
      const ordered = tabs
        .filter((t) => t.visible !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((t) => ({
          value: mapSettingIdToValue(t.id),
          label: t.label,
        }));
      if (ordered.length) setVisibleTabs(ordered);

      // Determine default tab from settings; ensure it's visible
      const defaultVal = mapSettingIdToValue(
        settings?.allCourses?.defaultTab || "InProgress"
      );
      const isDefaultVisible = ordered.some((t) => t.value === defaultVal);
      const firstVisible = ordered[0]?.value || "PROGRESS";
      const toSet = isDefaultVisible ? defaultVal : firstVisible;
      setSelectedTab(toSet);
    });
  }, []);

  // ✅ Fetch institute details
  useEffect(() => {
    const fetchInstituteDetails = async () => {
      try {
        const userId = await getUserId();
        const instituteId = await getInstituteId();
        const response = await authenticatedAxiosInstance.get(STUDENT_DETAIL, {
          params: { instituteId, userId },
        });
        setInstituteData(response.data);
        await getChatbotSettings();
      } catch {
        // Error handling
      }
    };

    fetchInstituteDetails();
  }, [setInstituteData]);

  // ✅ Fetch instructor
  useEffect(() => {
    const fetchInstructor = async () => {
      try {
        const instituteId = await getInstituteId();
        const response = await axios.get(`${urlInstructor}/${instituteId}`, {
          params: {
            instituteId,
          },
          headers: {
            accept: "*/*",
          },
        });
        setInstructors(response.data);
      } catch (error) {
        console.error(error);
      }
    };
    fetchInstructor();
  }, [setInstructors]);

  // Remove extra initial multi-tab fetching; rely on consolidated effect above

  useEffect(() => {
    const fetchInstituteDetails = async () => {
      const InstituteDetails = await Preferences.get({
        key: "InstituteDetails",
      });
      const parsedInstituteDetails = JSON.parse(InstituteDetails?.value || "");
      const settingsJsonData = JSON.parse(
        parsedInstituteDetails.institute_settings_json
      );
      setAllowLeanersToCreateCourses(
        settingsJsonData.setting.COURSE_SETTING.data.permissions
          .allowLearnersToCreateCourses
      );

      // Enable/disable drip conditions based on institute settings
      const { isDrippingEnable } = parseDripConditions(
        parsedInstituteDetails.institute_settings_json
      );
      setIsDrippingEnable(isDrippingEnable);
    };

    fetchInstituteDetails();
  }, [setIsDrippingEnable]);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <HeroSection allowLeanersToCreateCourses={allowLeanersToCreateCourses} />

      {/* Main Content Container */}
      <div className="mx-auto">
        <Tabs
          value={selectedTab}
          onValueChange={setSelectedTab}
          className="w-full"
        >
          {/* Tab Navigation */}
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-md shadow-sm mb-3">
            <div className="p-2 sm:p-3">
              <TabsList className="bg-gray-50 dark:bg-neutral-900 justify-start p-0.5 w-full grid grid-cols-3 gap-0.5 sm:w-auto sm:flex sm:flex-row">
                {visibleTabs.map((t) => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className={cn(
                      "flex-1 sm:flex-none px-1.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:shadow-sm",
                      // Vibrant Styles - Flat Pastel
                      t.value === "COMPLETED" &&
                        "[.ui-vibrant_&]:data-[state=active]:bg-emerald-100/50 [.ui-vibrant_&]:data-[state=active]:text-emerald-700 dark:[.ui-vibrant_&]:data-[state=active]:bg-emerald-900/30 dark:[.ui-vibrant_&]:data-[state=active]:text-emerald-300",
                      t.value === "PROGRESS" &&
                        "[.ui-vibrant_&]:data-[state=active]:bg-indigo-100/50 [.ui-vibrant_&]:data-[state=active]:text-indigo-700 dark:[.ui-vibrant_&]:data-[state=active]:bg-indigo-900/30 dark:[.ui-vibrant_&]:data-[state=active]:text-indigo-300",
                      t.value !== "COMPLETED" &&
                        t.value !== "PROGRESS" &&
                        "[.ui-vibrant_&]:data-[state=active]:bg-slate-100/50 [.ui-vibrant_&]:data-[state=active]:text-slate-700 dark:[.ui-vibrant_&]:data-[state=active]:bg-slate-800/50 dark:[.ui-vibrant_&]:data-[state=active]:text-slate-300"
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {/* Icon (visible only in vibrant mode via CSS) */}
                      <span className="hidden [.ui-vibrant_&]:inline">
                        {t.value === "ALL" && <IconBooks size={14} />}
                        {t.value === "PROGRESS" && <IconChartBar size={14} />}
                        {t.value === "COMPLETED" && <IconCheck size={14} />}
                      </span>
                      {t.label ||
                        (t.value === "ALL"
                          ? `All ${getTerminology(
                              ContentTerms.Course,
                              SystemTerms.Course
                            )}s`
                          : t.value === "PROGRESS"
                          ? "In Progress"
                          : "Completed")}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>

          {/* Tab Content */}
          {visibleTabs.some((t) => t.value === "ALL") && (
            <TabsContent value="ALL" className="m-0">
              <CoursesPage
                courseData={allCourses}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                sortOption={sortOption}
                onSortChange={setSortOption}
                selectedLevels={selectedLevels}
                setSelectedLevels={setSelectedLevels}
                selectedTags={selectedTags}
                setSelectedTags={setSelectedTags}
                selectedInstructors={selectedInstructors}
                setSelectedInstructors={setSelectedInstructors}
                onApplyFilters={handleApplyFilters}
                clearAllFilters={clearAllFilters}
                handlePageChange={handlePageChangeAll}
                showFilters={selectedTab === "ALL"}
                selectedTab={selectedTab}
                isLoading={isLoadingByTab.ALL}
              />
            </TabsContent>
          )}
          {visibleTabs.some((t) => t.value === "PROGRESS") && (
            <TabsContent value="PROGRESS" className="m-0">
              <CoursesPage
                courseData={progressCourses}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                sortOption={sortOption}
                onSortChange={setSortOption}
                selectedLevels={selectedLevels}
                setSelectedLevels={setSelectedLevels}
                selectedTags={selectedTags}
                setSelectedTags={setSelectedTags}
                selectedInstructors={selectedInstructors}
                setSelectedInstructors={setSelectedInstructors}
                onApplyFilters={handleApplyFilters}
                clearAllFilters={clearAllFilters}
                handlePageChange={handlePageChangeProgress}
                showFilters={false}
                selectedTab={selectedTab}
                isLoading={isLoadingByTab.PROGRESS}
              />
            </TabsContent>
          )}
          {visibleTabs.some((t) => t.value === "COMPLETED") && (
            <TabsContent value="COMPLETED" className="m-0">
              <CoursesPage
                courseData={completedCourses}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                sortOption={sortOption}
                onSortChange={setSortOption}
                selectedLevels={selectedLevels}
                setSelectedLevels={setSelectedLevels}
                selectedTags={selectedTags}
                setSelectedTags={setSelectedTags}
                selectedInstructors={selectedInstructors}
                setSelectedInstructors={setSelectedInstructors}
                onApplyFilters={handleApplyFilters}
                clearAllFilters={clearAllFilters}
                handlePageChange={handlePageChangeCompleted}
                showFilters={false}
                selectedTab={selectedTab}
                isLoading={isLoadingByTab.COMPLETED}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default CourseCatalougePage;
