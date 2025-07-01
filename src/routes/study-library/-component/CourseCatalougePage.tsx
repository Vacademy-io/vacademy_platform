import React, { useState, useEffect } from "react";
// import Footer from './Footer.tsx';
// import InstructorCTASection from './InstructorCTASection.tsx';
// import SupportersSection from './SupportersSection.tsx';
import CoursesPage from "./CoursesPage.tsx";
// import Header from './Header.tsx';
import { useCatalogStore } from "../-store/catalogStore.ts";
import axios from "axios";
import HeroSection from "../-component1/HeroSection.tsx";
import Tab from "../-component1/Tab.tsx";
import {
    STUDENT_DETAIL,
    urlCourseDetails,
    urlInstituteDetails,
    urlInstructor,
} from "@/constants/urls.ts";
import { getInstituteId } from "@/constants/helper.ts";
import { getUserId } from "@/constants/getUserId.ts";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance.ts";

const CourseCatalougePage: React.FC = () => {
    const { courseData, setCourseData, setInstituteData, setInstructors } =
        useCatalogStore();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [sortOption, setSortOption] = useState("Newest");

    const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedInstructors, setSelectedInstructors] = useState<string[]>(
        []
    );
    //api call to store the courses details

    //console.log("getInsutteId from the helper function",getInstituteId);
    const fetchPackages = async (search = "", sort = "Newest") => {
        try {
            const instituteId = await getInstituteId();
            const response = await axios.post(
                urlCourseDetails,
                {
                    status: [],
                    level_ids: [],
                    faculty_ids: [],
                    search_by_name: search,
                    tag: [],
                    min_percentage_completed: 0,
                    max_percentage_completed: 0,
                    type: "ALL",
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
            setCourseData(response.data.content);
            //console.log('Response courses:', response.data);
        } catch (error) {
            // console.error('Error fetching packages:', error);
        }
    };

    useEffect(() => {
        fetchPackages(searchTerm, sortOption);
    }, [searchTerm, sortOption]);

    const handleApplyFilters = async () => {
        try {
            const instituteId = await getInstituteId();
            const response = await axios.post(
                urlCourseDetails,
                {
                    status: [],
                    level_ids: selectedLevels,
                    faculty_ids: selectedInstructors,
                    search_by_name: searchTerm,
                    tag: selectedTags,
                    min_percentage_completed: 0,
                    max_percentage_completed: 0,
                    type: "ALL",
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
            setCourseData(response.data.content);
        } catch (error) {
            console.error("Error applying filters:", error);
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
                setLoading(false);
            } catch (error) {
                setError(
                    "Something went wrong while fetching the institute details."
                );
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
                setError(
                    "Something went wrong while fetching the instructors."
                );
            }
        };

        fetchInstructor();
    }, []);

    return (
        <div>
            <HeroSection />
            <Tab />
            <CoursesPage
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
            />
        </div>
    );
};

export default CourseCatalougePage;
