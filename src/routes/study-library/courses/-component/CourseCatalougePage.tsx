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
import { DashboardLoader } from "@/components/core/dashboard-loader.tsx";
import { CoursePackageResponse } from "@/types/course-catalog/course-catalog-list.ts";

const CourseCatalougePage: React.FC = () => {
    const { setInstituteData, setInstructors } = useCatalogStore();
    const [selectedTab, setSelectedTab] = useState("ALL");
    const [page, setPage] = useState(0);
    const [courseData, setCourseData] = useState<CoursePackageResponse>({
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

    const [searchTerm, setSearchTerm] = useState("");
    const [sortOption, setSortOption] = useState("Newest");

    const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedInstructors, setSelectedInstructors] = useState<string[]>(
        []
    );

    const [isLoadingCourse, setIsLoadingCourse] = useState(false);

    const handlePageChange = (page: number) => {
        setPage(page + 1);
    };

    const fetchPackages = async (search = "", sort = "Newest") => {
        setIsLoadingCourse(true);
        try {
            const instituteId = await getInstituteId();
            const response = await authenticatedAxiosInstance.post(
                urlPublicCourseDetails,
                {
                    status: [],
                    level_ids: [],
                    faculty_ids: [],
                    search_by_name: search,
                    tag: [],
                    min_percentage_completed: 0,
                    max_percentage_completed: 0,
                    type: selectedTab,
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
            setCourseData(response.data);
        } catch (error) {
            console.log(error);
        } finally {
            setIsLoadingCourse(false);
        }
    };

    const handleApplyFilters = async () => {
        setIsLoadingCourse(true);
        try {
            const instituteId = await getInstituteId();
            const response = await authenticatedAxiosInstance.post(
                urlPublicCourseDetails,
                {
                    status: [],
                    level_ids: selectedLevels,
                    faculty_ids: selectedInstructors,
                    search_by_name: searchTerm,
                    tag: selectedTags,
                    min_percentage_completed: 0,
                    max_percentage_completed: 0,
                    type: selectedTab,
                },
                {
                    params: {
                        instituteId,
                        page: 0,
                        size: 10,
                    },
                    headers: {
                        accept: "*/*",
                        "Content-Type": "application/json",
                    },
                }
            );
            setCourseData(response.data);
        } catch (error) {
            console.error("Error applying filters:", error);
        } finally {
            setIsLoadingCourse(false);
        }
    };

    // ✅ Fetch institute details
    useEffect(() => {
        const FetchInstituteDetails = async () => {
            try {
                const userId = await getUserId();
                const instituteId = await getInstituteId();
                const response = await authenticatedAxiosInstance.get(
                    STUDENT_DETAIL,
                    {
                        params: { instituteId, userId },
                    }
                );
                // console.log("Institute details", response.data);
                setInstituteData(response.data);
            } catch (error) {
                console.log(error);
            }
        };

        FetchInstituteDetails();
    }, []);

    // ✅ Fetch instructor
    useEffect(() => {
        const fetchInstructor = async () => {
            try {
                const instituteId = await getInstituteId();
                const response = await axios.post(
                    urlInstructor,
                    {
                        roles: ["TEACHER", "ADMIN"],
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

    useEffect(() => {
        fetchPackages(searchTerm, sortOption);
    }, [searchTerm, sortOption, selectedTab, page]);

    return (
        <div>
            <HeroSection />
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                <TabsList className="p-0 !bg-transparent mb-4 border-b w-full flex justify-start rounded-none">
                    <TabsTrigger
                        value="ALL"
                        className={`text-md !shadow-none border-b-2 -mb-1 rounded-none font-semibold 
          ${selectedTab === "ALL" ? "border-primary-500 !text-primary-500" : "border-transparent text-gray-500"}`}
                    >
                        All Courses
                    </TabsTrigger>
                    <TabsTrigger
                        value="PROGRESS"
                        className={`text-md !shadow-none border-b-2 -mb-1 rounded-none font-semibold 
          ${selectedTab === "PROGRESS" ? "border-primary-500 !text-primary-500" : "border-transparent text-gray-500"}`}
                    >
                        In Progress
                    </TabsTrigger>
                    <TabsTrigger
                        value="COMPLETED"
                        className={`text-md !shadow-none border-b-2 -mb-1 rounded-none font-semibold 
          ${selectedTab === "COMPLETED" ? "border-primary-500 !text-primary-500" : "border-transparent text-gray-500"}`}
                    >
                        Completed
                    </TabsTrigger>
                </TabsList>
                {isLoadingCourse ? (
                    <DashboardLoader />
                ) : (
                    <TabsContent value={selectedTab}>
                        <CoursesPage
                            courseData={courseData}
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
                            clearAllFilters={() => {
                                setSelectedLevels([]);
                                setSelectedTags([]);
                                setSelectedInstructors([]);
                                fetchPackages();
                            }}
                            page={page}
                            handlePageChange={handlePageChange}
                        />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
};

export default CourseCatalougePage;
