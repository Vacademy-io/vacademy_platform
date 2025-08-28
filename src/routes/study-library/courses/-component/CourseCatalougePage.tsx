import React, { useState, useEffect } from "react";
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
import HeroSection from "../-component1/HeroSection.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CoursePackageResponse } from "@/types/course-catalog/course-catalog-list.ts";
import { ContentTerms, SystemTerms } from "@/types/naming-settings.ts";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils.ts";
import { Preferences } from "@capacitor/preferences";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
import type { StudentAllCoursesTabId } from "@/types/student-display-settings";

const CourseCatalougePage: React.FC = () => {
    const [allowLeanersToCreateCourses, setAllowLeanersToCreateCourses] =
        useState<boolean>(false);

    const { setInstituteData, setInstructors } = useCatalogStore();
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
    const [progressCourses, setProgressCourses] =
        useState<CoursePackageResponse>({
            ...allCourses,
        });
    const [completedCourses, setCompletedCourses] =
        useState<CoursePackageResponse>({
            ...allCourses,
        });
    const [searchTerm, setSearchTerm] = useState("");
    const [sortOption, setSortOption] = useState("Newest");

    const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedInstructors, setSelectedInstructors] = useState<string[]>(
        []
    );

    const fetchTabCourses = async (
        tabType: string,
        setData: (data: CoursePackageResponse) => void,
        search = "",
        sort = "Newest"
    ) => {
        try {
            const instituteId = await getInstituteId();
            const response = await authenticatedAxiosInstance.post(
                urlPublicCourseDetails,
                {
                    status: [],
                    level_ids: selectedLevels,
                    faculty_ids: selectedInstructors,
                    search_by_name: search,
                    tag: selectedTags,
                    min_percentage_completed: 0,
                    max_percentage_completed: 0,
                    type: tabType,
                },
                {
                    params: {
                        instituteId,
                        page: 0,
                        size: 10,
                        sortBy:
                            sort === "Newest"
                                ? "created_at,asc"
                                : sort === "Oldest"
                                  ? "created_at,desc"
                                  : sort === "Rating"
                                    ? "rating,asc"
                                    : "created_at,asc",
                    },
                    headers: {
                        accept: "*/*",
                        "Content-Type": "application/json",
                    },
                }
            );
            setData(response.data);
        } catch (error) {
            console.log(error);

            // If enrolled courses fail, try to fetch available courses for the "ALL" tab
            if (tabType === "ALL") {
                try {
                    const { urlCourseDetails } = await import(
                        "@/constants/urls"
                    );
                    const instituteId = await getInstituteId();
                    const response = await authenticatedAxiosInstance.post(
                        urlCourseDetails,
                        {
                            status: [],
                            level_ids: selectedLevels,
                            faculty_ids: selectedInstructors,
                            search_by_name: search,
                            tag: selectedTags,
                            min_percentage_completed: 0,
                            max_percentage_completed: 0,
                        },
                        {
                            params: {
                                instituteId,
                                page: 0,
                                size: 10,
                                sortBy:
                                    sort === "Newest"
                                        ? "created_at,desc"
                                        : sort === "Oldest"
                                          ? "created_at,asc"
                                          : sort === "Rating"
                                            ? "rating,desc"
                                            : "created_at,desc",
                            },
                            headers: {
                                accept: "*/*",
                                "Content-Type": "application/json",
                            },
                        }
                    );
                    setData(response.data);
                } catch (fallbackError) {
                    console.log(
                        "Fallback to available courses also failed:",
                        fallbackError
                    );
                }
            }
        }
    };

    const fetchAllTabs = async (search = searchTerm, sort = sortOption) => {
        await Promise.all([
            fetchTabCourses("ALL", setAllCourses, search, sort),
            fetchTabCourses("PROGRESS", setProgressCourses, search, sort),
            fetchTabCourses("COMPLETED", setCompletedCourses, search, sort),
        ]);
    };

    const handleApplyFilters = async () => {
        await fetchAllTabs();
    };

    const clearAllFilters = async () => {
        setSelectedLevels([]);
        setSelectedTags([]);
        setSelectedInstructors([]);
        setSearchTerm("");
        setSortOption("Newest");
        await fetchAllTabs("", "Newest");
    };

    useEffect(() => {
        fetchAllTabs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        searchTerm,
        sortOption,
        selectedLevels,
        selectedTags,
        selectedInstructors,
    ]);

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
            const isDefaultVisible = ordered.some(
                (t) => t.value === defaultVal
            );
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
                const response = await authenticatedAxiosInstance.get(
                    STUDENT_DETAIL,
                    {
                        params: { instituteId, userId },
                    }
                );
                setInstituteData(response.data);
            } catch (error) {
                console.log(error);
            }
        };

        fetchInstituteDetails();
    }, []);

    // ✅ Fetch instructor
    useEffect(() => {
        const fetchInstructor = async () => {
            try {
                const instituteId = await getInstituteId();
                const response = await axios.post(
                    urlInstructor,
                    {
                        roles: [
                            "TEACHER",
                            "ADMIN",
                            "COURSE CREATOR",
                            "ASSESSMENT CREATOR",
                            "EVALUATOR",
                        ],
                        status: ["ACTIVE"],
                    },
                    {
                        headers: {
                            Accept: "*/*",
                            "Content-Type": "application/json",
                        },
                        params: {
                            instituteId,
                        },
                    }
                );
                // console.log('Instructor response9999:', response.data);
                setInstructors(response.data);
            } catch (error) {
                console.log(error);
            }
        };

        fetchInstructor();
    }, []);

    // ✅ Initial course data fetching when component mounts
    useEffect(() => {
        const loadInitialCourseData = async () => {
            try {
                // Fetch data for the default tab (PROGRESS)
                await fetchTabCourses("PROGRESS", setProgressCourses, "", sortOption);
                
                // Also fetch some data for ALL tab if it's visible
                if (visibleTabs.some(t => t.value === "ALL")) {
                    await fetchTabCourses("ALL", setAllCourses, "", sortOption);
                }
                
                // Fetch completed courses if the tab is visible
                if (visibleTabs.some(t => t.value === "COMPLETED")) {
                    await fetchTabCourses("COMPLETED", setCompletedCourses, "", sortOption);
                }
                
            } catch (error) {
                console.error('[CourseCatalougePage] Failed to load initial course data:', error);
            }
        };

        // Only load data if we have the necessary settings
        if (visibleTabs.length > 0) {
            loadInitialCourseData();
        }
    }, [visibleTabs, sortOption]); // Dependencies: visibleTabs and sortOption

    useEffect(() => {
        const fetchInstituteDetails = async () => {
            const InstituteDetails = await Preferences.get({
                key: "InstituteDetails",
            });
            const parsedInstituteDetails = JSON.parse(
                InstituteDetails?.value || ""
            );
            const settingsJsonData = JSON.parse(
                parsedInstituteDetails.institute_settings_json
            );
            setAllowLeanersToCreateCourses(
                settingsJsonData.setting.COURSE_SETTING.data.permissions
                    .allowLearnersToCreateCourses
            );
        };

        fetchInstituteDetails();
    }, []);

    return (
        <div className="bg-gray-50 dark:bg-neutral-950 min-h-screen">
            {/* Hero Section */}
            <HeroSection
                allowLeanersToCreateCourses={allowLeanersToCreateCourses}
            />

            {/* Main Content Container */}
            <div className="max-w-7xl mx-auto px-2 sm:px-3 lg:px-4">
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
                                        className="flex-1 sm:flex-none px-1.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:shadow-sm"
                                    >
                                        {t.label ||
                                            (t.value === "ALL"
                                                ? `All ${getTerminology(
                                                      ContentTerms.Course,
                                                      SystemTerms.Course
                                                  )}s`
                                                : t.value === "PROGRESS"
                                                  ? "In Progress"
                                                  : "Completed")}
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
                                page={progressCourses.number}
                                handlePageChange={() => {}}
                                showFilters={selectedTab === "ALL"}
                                selectedTab={selectedTab}
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
                                page={progressCourses.number}
                                handlePageChange={() => {}}
                                showFilters={false}
                                selectedTab={selectedTab}
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
                                page={completedCourses.number}
                                handlePageChange={() => {}}
                                showFilters={false}
                                selectedTab={selectedTab}
                            />
                        </TabsContent>
                    )}
                </Tabs>
            </div>
        </div>
    );
};

export default CourseCatalougePage;
