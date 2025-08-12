import React, { useState, useEffect } from "react";
import Footer from "./Footer.tsx";
import InstructorCTASection from "./InstructorCTASection.tsx";
import SupportersSection from "./SupportersSection.tsx";
import CoursesPage from "./CoursesPage.tsx";
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
import { getFromStorage } from "@/components/common/auth/login/forms/page/login-form";
import { isNullOrEmptyOrUndefined } from "@/lib/utils.ts";
import { getPublicUrl } from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/excalidrawUtils.ts";
import { useTheme } from "@/providers/theme/theme-provider.tsx";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { AuthModal } from "@/components/common/auth/modal/AuthModal.tsx";

const CourseCatalougePage: React.FC = () => {
    const navigate = useNavigate();
    const { setCourseData, instituteData, setInstituteData, setInstructors } =
        useCatalogStore();
    const { setPrimaryColor } = useTheme();
    const [bannerImage, setBannerImage] = useState("");
    const [bannerText, setBannerText] = useState({
        heading: "",
        description: "",
    });
    const [searchTerm, setSearchTerm] = useState("");
    const [sortOption, setSortOption] = useState("Newest");

    const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedInstructors, setSelectedInstructors] = useState<string[]>(
        []
    );

    const { instituteId } = useSearch({ from: "/courses/" });
    
    // State for auto-login modal
    const [showAutoLoginModal, setShowAutoLoginModal] = useState(false);

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
        // Only fetch packages when instituteId is available
        if (instituteId) {
            fetchPackages(searchTerm);
        }
    }, [searchTerm, sortOption, instituteId]);

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

    // ✅ Fetch institute details - only when instituteId is available
    useEffect(() => {
        if (!instituteId) return; // 🚫 Prevent calling API without instituteId

        const fetchInstituteDetails = async () => {
            try {
                const response = await axios.get(
                    `${urlInstituteDetails}/${instituteId}`,
                    {
                        params: {
                            instituteId,
                        },
                    }
                );
                const bannerImagePublicUrl = await getPublicUrl(
                    response.data.cover_image_file_id
                );
                const parsedBannerText = JSON.parse(
                    response.data.cover_text_json
                );
                setBannerText(parsedBannerText);
                setInstituteData(response.data);
                setBannerImage(bannerImagePublicUrl);
                setPrimaryColor(response.data.institute_theme_code);
            } catch (error) {
                console.log(error);
            }
        };

        fetchInstituteDetails();
    }, [instituteId]);

    // ✅ Fetch instructor - only when instituteId is available
    useEffect(() => {
        if (!instituteId) return; // 🚫 Prevent calling API without instituteId

        const fetchInstructor = async () => {
            try {
                const response = await axios.post(
                    `${urlInstructor}`,
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

    // Auto-login modal effect - show modal 1 second after page load when instituteId is present
    useEffect(() => {
        if (!instituteId) return;

        const timer = setTimeout(() => {
            // Show modal automatically after 1 second when instituteId is present
            setShowAutoLoginModal(true);
        }, 1000); // 1 second delay

        return () => clearTimeout(timer);
    }, [instituteId]);

    // Show loading state if instituteId is not available yet
    if (!instituteId) {
        return <DashboardLoader />;
    }

    return (
        <div>
            <CourseListHeader
                fileId={instituteData?.institute_logo_file_id || ""}
                instituteId={instituteData?.id}
                type="coursesPage"
            />

            <div className="relative h-[250px] sm:h-[300px] lg:h-[370px]">
                {/* Transparent blue overlay */}
                {instituteData?.cover_image_file_id ? (
                    <div className="pointer-events-none absolute inset-0 z-10 bg-blue-900/50" />
                ) : (
                    <div className="pointer-events-none absolute inset-0 z-10 bg-blue-900/10" />
                )}
                {!instituteData?.cover_image_file_id ? (
                    <div className="absolute inset-0 z-0 bg-transparent" />
                ) : (
                    <div className="absolute inset-0 z-0 opacity-70">
                        <img
                            src={bannerImage}
                            alt="Course Banner"
                            className="size-full object-cover"
                            onError={(e) => {
                                e.currentTarget.style.display = "none";
                                e.currentTarget.parentElement?.classList.add(
                                    "bg-primary-500"
                                );
                            }}
                        />
                    </div>
                )}
                <div className="w-full px-4 sm:px-6 lg:px-8 relative z-20 h-full flex">
                    <div className="flex items-start justify-between gap-4 sm:gap-6 lg:gap-8 w-full">
                        {/* Left side - Title and Description */}
                        <div className="max-w-2xl my-auto flex flex-col justify-center text-white">
                            {!instituteData?.cover_text_json ? (
                                <div className="space-y-3 sm:space-y-4">
                                    <div className="h-6 sm:h-8 w-24 sm:w-32 animate-pulse rounded bg-white/20" />
                                    <div className="h-8 sm:h-12 w-3/4 animate-pulse rounded bg-white/20" />
                                    <div className="h-3 sm:h-4 w-full animate-pulse rounded bg-white/20" />
                                    <div className="h-3 sm:h-4 w-2/3 animate-pulse rounded bg-white/20" />
                                </div>
                            ) : (
                                <>
                                    <h1 className="mb-3 sm:mb-4 text-2xl sm:text-3xl lg:text-4xl font-bold">
                                        {bannerText.heading}
                                    </h1>
                                    <p
                                        className="text-base sm:text-lg opacity-90"
                                        dangerouslySetInnerHTML={{
                                            __html: bannerText.description,
                                        }}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
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
            {showAutoLoginModal && (
                <AuthModal
                    type="coursesPage"
                    courseId={undefined}
                    trigger={<div />}
                    isOpen={showAutoLoginModal}
                    onClose={() => setShowAutoLoginModal(false)}
                    onLoginSuccess={() => setShowAutoLoginModal(false)}
                    onSignupSuccess={() => setShowAutoLoginModal(false)}
                />
            )}
        </div>
    );
};

export default CourseCatalougePage;
