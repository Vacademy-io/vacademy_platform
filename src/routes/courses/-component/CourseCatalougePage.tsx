import React, { useState, useEffect } from "react";
import Footer from "./Footer.tsx";
import InstructorCTASection from "./InstructorCTASection.tsx";
import SupportersSection from "./SupportersSection.tsx";
import CoursesPage from "./CoursesPage.tsx";
import HeroSectionCourseCatalog from "./HeroSectionCourseCatalog.tsx";
import { useCatalogStore } from "../-store/catalogStore.ts";
import axios from "axios";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
    urlInstituteDetails,
    urlCourseDetails,
    urlInstructor,
} from "@/constants/urls.ts";
import CourseListHeader from "./CourseListHeader.tsx";
import { getTokenFromStorage } from "@/lib/auth/sessionUtility.ts";
import { TokenKey } from "@/constants/auth/tokens.ts";
import { getFromStorage } from "@/components/common/LoginPages/sections/login-form.tsx";
import { isNullOrEmptyOrUndefined } from "@/lib/utils.ts";

const CourseCatalougePage: React.FC = () => {
    const navigate = useNavigate();
    const { setCourseData, instituteData, setInstituteData, setInstructors } =
        useCatalogStore();

    const [searchTerm, setSearchTerm] = useState("");
    const [sortOption, setSortOption] = useState("Newest");

    const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedInstructors, setSelectedInstructors] = useState<string[]>(
        []
    );

    const { instituteId } = useSearch({ from: "/courses/" });

    useEffect(() => {
        console.log("Extracted instituteId:", instituteId);
    }, [instituteId]);

    //api call to store the courses details

    const fetchPackages = async (search = "") => {
        try {
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
                },
                {
                    params: {
                        instituteId: instituteId,
                        page: 0,
                        size: 95,
                    },
                    headers: {
                        accept: "*/*",
                        "Content-Type": "application/json",
                    },
                }
            );
            setCourseData(response.data.content);
            console.log("Response courses:", response.data);
        } catch (error) {
            console.error("Error fetching packages:", error);
        }
    };

    useEffect(() => {
        fetchPackages(searchTerm);
    }, [searchTerm, sortOption]);

    const handleApplyFilters = async () => {
        try {
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
                },
                {
                    params: {
                        instituteId: instituteId,
                        page: 0,
                        size: 95,
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
                const response = await axios.get(
                    `${urlInstituteDetails}/${instituteId}`,
                    {
                        params: {
                            instituteId,
                        },
                    }
                );
                setInstituteData(response.data);
            } catch (error) {
                console.log(error);
            }
        };

        FetchInstituteDetails();
    }, [instituteId]);

    // ✅ Fetch instructor
    useEffect(() => {
        if (!instituteId) return; // 🚫 Prevent calling API with undefined ID

        const fetchInstructor = async () => {
            try {
                const response = await axios.post(
                    `${urlInstructor}`,
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
                setInstructors(response.data);
            } catch (error) {
                console.log(error);
            }
        };

        fetchInstructor();
    }, [instituteId]); // ✅ Add dependency

    useEffect(() => {
        const redirectToDashboardIfAuthenticated = async () => {
            const token = await getTokenFromStorage(TokenKey.accessToken);
            const studentDetails = await getFromStorage("StudentDetails");
            const instituteDetails = await getFromStorage("InstituteDetails");

            if (
                !isNullOrEmptyOrUndefined(token) &&
                !isNullOrEmptyOrUndefined(studentDetails) &&
                !isNullOrEmptyOrUndefined(instituteDetails)
            ) {
                navigate({ to: "/dashboard" });
            }
        };

        redirectToDashboardIfAuthenticated();
    }, [navigate]);

    return (
        <div>
            <CourseListHeader
                fileId={instituteData?.institute_logo_file_id || ""}
                instituteId={instituteData?.id}
                type="coursesPage"
            />
            <HeroSectionCourseCatalog />
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

            <InstructorCTASection />
            <SupportersSection />
            <Footer />
        </div>
    );
};

export default CourseCatalougePage;
