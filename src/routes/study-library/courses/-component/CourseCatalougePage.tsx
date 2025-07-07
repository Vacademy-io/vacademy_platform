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

    // Auto-switch to PROGRESS tab if ALL tab is hidden and current tab is ALL
    useEffect(() => {
        if (selectedTab === "ALL" && courseData.totalElements === 0) {
            setSelectedTab("PROGRESS");
        }
    }, [courseData.totalElements, selectedTab]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50/80 via-white to-primary-50/20 relative overflow-hidden w-full max-w-full">
            {/* Hero Section */}
            <HeroSection />
            
            {/* Main Content Container */}
            <div className="relative z-10 max-w-7xl mx-auto p-2 sm:p-3 lg:p-4">
                <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
                    {/* Enhanced Tab Navigation */}
                    <div className="relative bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-500 mb-3 sm:mb-4 overflow-hidden">
                        {/* Background gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-50/30 via-transparent to-primary-50/20 pointer-events-none"></div>
                        
                        {/* Floating orb effect */}
                        <div className="absolute top-0 right-0 w-12 h-12 bg-primary-100/20 rounded-full blur-2xl opacity-70 -translate-y-2 translate-x-4"></div>
                        
                        <div className="relative p-2 sm:p-3">
                            <TabsList className="relative bg-gray-50/50 backdrop-blur-sm rounded-xl p-1 w-full flex justify-start border border-gray-200/40 shadow-sm">
                                {/* Only show ALL tab if there are courses */}
                                {courseData.totalElements > 0 && (
                                    <TabsTrigger
                                        value="ALL"
                                        className={`relative px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold rounded-lg transition-all duration-300 flex-1 sm:flex-none ${
                                            selectedTab === "ALL" 
                                                ? "bg-white text-primary-600 shadow-sm border border-primary-200" 
                                                : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                                        }`}
                                    >
                                        All Courses
                                        {selectedTab === "ALL" && (
                                            <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-primary-600/10 rounded-lg"></div>
                                        )}
                                    </TabsTrigger>
                                )}
                                <TabsTrigger
                                    value="PROGRESS"
                                    className={`relative px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold rounded-lg transition-all duration-300 flex-1 sm:flex-none ${
                                        selectedTab === "PROGRESS" 
                                            ? "bg-white text-primary-600 shadow-sm border border-primary-200" 
                                            : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                                    }`}
                                >
                                    In Progress
                                    {selectedTab === "PROGRESS" && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-primary-600/10 rounded-lg"></div>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="COMPLETED"
                                    className={`relative px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold rounded-lg transition-all duration-300 flex-1 sm:flex-none ${
                                        selectedTab === "COMPLETED" 
                                            ? "bg-white text-primary-600 shadow-sm border border-primary-200" 
                                            : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                                    }`}
                                >
                                    Completed
                                    {selectedTab === "COMPLETED" && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-primary-600/10 rounded-lg"></div>
                                    )}
                                </TabsTrigger>
                            </TabsList>
                        </div>
                    </div>

                    {/* Tab Content */}
                    {isLoadingCourse ? (
                        <div className="relative bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-2xl shadow-sm p-4 sm:p-6 animate-pulse overflow-hidden">
                            {/* Background pattern */}
                            <div className="absolute inset-0 bg-gradient-to-br from-gray-50/30 via-transparent to-primary-50/20 pointer-events-none"></div>
                            
                            <div className="relative space-y-6">
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                                    <div className="space-y-2 flex-1">
                                        <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="bg-gray-100 rounded-xl p-6 space-y-4">
                                            <div className="h-48 bg-gray-200 rounded-xl"></div>
                                            <div className="space-y-2">
                                                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                                                <div className="h-4 bg-gray-200 rounded w-full"></div>
                                                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                                                 <TabsContent value={selectedTab} className="m-0">
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
                                 showFilters={selectedTab === "ALL"}
                             />
                         </TabsContent>
                    )}
                </Tabs>
            </div>
        </div>
    );
};

export default CourseCatalougePage;
