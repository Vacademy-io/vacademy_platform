import { H1 } from "@/components/design-system/typography";
import { BookOpen } from "phosphor-react";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { MyButton } from "@/components/design-system/button";
import { useSuspenseQuery } from "@tanstack/react-query";
import { handleFetchUserRoleDetails } from "../-services/institute-details";
import { useEffect, useState } from "react";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { Preferences } from "@capacitor/preferences";
import { TokenKey } from "@/constants/auth/tokens";
import {
    getTokenFromCookie,
    setAuthorizationCookie,
} from "@/lib/auth/sessionUtility";

interface UserRole {
    id: string;
    institute_id: string;
    role_name: string;
    status: string;
    role_id: string;
}

const HeroSection = ({
    allowLeanersToCreateCourses,
}: {
    allowLeanersToCreateCourses: boolean;
}) => {
    const { data: userRoleDetails, isLoading } = useSuspenseQuery(
        handleFetchUserRoleDetails()
    );

    const [hasTeacherAndStudentRole, setHasTeacherAndStudentRole] =
        useState(false);

    const roleNames = userRoleDetails?.roles?.map(
        (role: UserRole) => role.role_name
    );

    const handleNavigate = () => {
        const accessToken = getTokenFromCookie(TokenKey.accessToken);
        const refreshToken = getTokenFromCookie(TokenKey.refreshToken);
        window.location.href = `https://dash.vacademy.io/auth-transfer?accessToken=${accessToken}&refreshToken=${refreshToken}`;
    };

    useEffect(() => {
        setHasTeacherAndStudentRole(
            roleNames.includes("STUDENT") && roleNames.includes("TEACHER")
        );
    }, [userRoleDetails]);

    // Auto-set cookies when component mounts
    useEffect(() => {
        const setTokensInCookies = async () => {
            try {
                // Get tokens from storage
                const accessToken = await Preferences.get({
                    key: "accessToken",
                });
                const refreshToken = await Preferences.get({
                    key: "refreshToken",
                });

                // Set cookies if tokens exist
                if (accessToken?.value) {
                    setAuthorizationCookie(
                        TokenKey.accessToken,
                        accessToken.value
                    );
                }
                if (refreshToken?.value) {
                    setAuthorizationCookie(
                        TokenKey.refreshToken,
                        refreshToken.value
                    );
                }
            } catch (error) {
                console.error("❌ Error auto-setting cookies:", error);
            }
        };

        setTokensInCookies();
    }, []); // Run only once when component mounts

    if (isLoading) return <DashboardLoader />;

    return (
        <div className="relative min-h-[180px] sm:min-h-[200px] bg-gradient-to-br from-gray-50/80 via-white to-primary-50/20 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-900 overflow-hidden w-full max-w-full">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-12 h-12 sm:w-16 sm:h-16 md:w-32 md:h-32 bg-gradient-to-br from-primary-100/20 to-transparent rounded-full blur-3xl animate-gentle-pulse"></div>
                <div
                    className="absolute bottom-1/3 right-1/3 w-16 h-16 sm:w-20 sm:h-20 md:w-40 md:h-40 bg-gradient-to-br from-primary-50/30 to-transparent rounded-full blur-3xl animate-gentle-pulse"
                    style={{ animationDelay: "2s" }}
                ></div>
            </div>

            <div className="relative z-10 flex flex-col lg:flex-row max-w-7xl mx-auto p-1 sm:p-2 lg:p-3 min-h-[160px] sm:min-h-[100px]">
                {/* Content Section */}
                <div className="w-full lg:w-2/3 flex items-center justify-center lg:justify-start">
                    <div className="animate-fade-in-up max-w-2xl text-center lg:text-left">
                        {/* Header with Icon */}
                        <div className="flex items-center justify-center lg:justify-start space-x-1.5 mb-1 sm:mb-2">
                            <div className="p-0.5 sm:p-1 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg shadow-sm">
                                <BookOpen
                                    size={16}
                                    className="text-primary-600 sm:w-[18px] sm:h-[18px]"
                                    weight="duotone"
                                />
                            </div>
                            <div className="flex items-center space-x-0.5 sm:space-x-1">
                                <div className="w-1 h-1 sm:w-1.5 bg-primary-500 rounded-full animate-pulse"></div>
                                <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">
                                    {getTerminology(
                                        ContentTerms.Course,
                                        SystemTerms.Course
                                    )}{" "}
                                    Catalog
                                </span>
                            </div>
                        </div>

                        {/* Main Heading */}
                        <H1 className="mb-1 sm:mb-2">Explore & Discover</H1>

                        {/* Single Description */}
                        <div className="mb-0.5 sm:mb-1">
                            <p className="text-sm sm:text-base text-gray-600 font-medium leading-relaxed">
                                Effortlessly organize, upload, and track
                                educational resources in one place.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Actions Section (image removed) */}
                <div
                    className={`w-full lg:w-1/3 flex items-center justify-center p-0.5 sm:p-1 animate-fade-in-up ${
                        allowLeanersToCreateCourses
                            ? "gap-2 sm:gap-3 flex-col"
                            : ""
                    }`}
                    style={{ animationDelay: "0.4s" }}
                >
                    {hasTeacherAndStudentRole && (
                        <>
                            <MyButton
                                onClick={handleNavigate}
                                className="w-full sm:w-auto"
                            >
                                Create Course
                            </MyButton>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HeroSection;
