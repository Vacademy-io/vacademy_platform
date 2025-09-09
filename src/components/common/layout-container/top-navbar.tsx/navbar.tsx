import { SidebarTrigger } from "@/components/ui/sidebar";
import { List } from "@phosphor-icons/react";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { FiSidebar } from "react-icons/fi";
import { useEffect, useState } from "react";
import useStore from "../sidebar/useSidebar";
import { Preferences } from "@capacitor/preferences";
import { getPublicUrl } from "@/services/upload_file";
import { LogoutSidebar } from "../sidebar/logoutSidebar";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Student } from "phosphor-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { handleFetchUserRoleDetails } from "@/routes/study-library/courses/-services/institute-details";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { getTokenFromCookie } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { SystemAlertsBar } from "@/components/announcements";
import { handleGetPublicInstituteDetails } from "../services/navbar-services";

interface UserRole {
    id: string;
    institute_id: string;
    role_name: string;
    status: string;
    role_id: string;
}

export function Navbar() {
    const { data: instituteDetails } = useSuspenseQuery(
        handleGetPublicInstituteDetails()
    );
    const { data: userRoleDetails, isLoading, error } = useSuspenseQuery(
        handleFetchUserRoleDetails()
    );

    const [hasTeacherAndStudentRole, setHasTeacherAndStudentRole] =
        useState(false);

    const roleNames = userRoleDetails?.roles?.map(
        (role: UserRole) => role.role_name
    ) || [];

    useEffect(() => {
        if (userRoleDetails?.roles && roleNames.length > 0) {
            setHasTeacherAndStudentRole(
                roleNames.includes("STUDENT") && roleNames.includes("TEACHER")
            );
        }
    }, [userRoleDetails, roleNames]);

    const { navHeading } = useNavHeadingStore();
    const { setInstituteDetails, setSidebarOpen, instituteName, instituteLogoFileUrl, sideBarOpen } = useStore();

    const handleNavigateToAdmin = () => {
        const accessToken = getTokenFromCookie(TokenKey.accessToken);
        const refreshToken = getTokenFromCookie(TokenKey.refreshToken);
        window.location.href = `https://${instituteDetails.teacher_portal_base_url}/auth-transfer?accessToken=${accessToken}&refreshToken=${refreshToken}`;
    };

    async function fetch() {
        try {
            const InstituteDetailsData = await Preferences.get({
                key: "InstituteDetails",
            });

            const InstituteDetails = InstituteDetailsData.value
                ? JSON.parse(InstituteDetailsData.value)
                : null;

            if (InstituteDetails) {
                const url = InstituteDetails.institute_logo_file_id
                    ? await getPublicUrl(
                          InstituteDetails.institute_logo_file_id
                      )
                    : "";

                setInstituteDetails(InstituteDetails.institute_name, url);
            }
        } catch (error) {
            console.error("Error fetching institute details:", error);
        }
    }

    const [showSidebarControls, setShowSidebarControls] = useState(true);

    useEffect(() => {
        // setNotifications(true);
        fetch();
        // Apply institute details from public query as a reliable source on refresh
        if (instituteDetails) {
            const maybeSet = async () => {
                try {
                    const url = instituteDetails.institute_logo_file_id
                        ? await getPublicUrl(instituteDetails.institute_logo_file_id)
                        : "";
                    setInstituteDetails(instituteDetails.institute_name, url);
                } catch (e) {
                    console.warn("Navbar: failed to derive public logo url", e);
                }
            };
            void maybeSet();
        }
        // Load sidebar visibility from Student Display Settings (uses cache on dashboard refresh)
        getStudentDisplaySettings(false)
            .then((s) => setShowSidebarControls(s?.sidebar?.visible !== false))
            .catch(() => setShowSidebarControls(true));
    }, [instituteDetails, setInstituteDetails]);

    if (isLoading) return <DashboardLoader />;

    // Handle error gracefully
    if (error) {
        console.warn("Navbar: Error loading user role details, showing fallback UI:", error);
        // Return a simplified navbar without role-dependent features
        return (
            <div className="sticky top-0 z-[9999] border-b border-primary-200/40 dark:border-neutral-800 flex h-14 items-center justify-between bg-white dark:bg-neutral-900 px-4 md:px-5 py-2 transition-all duration-300 shadow-sm">
                <LogoutSidebar />
                
                {/* Left Section */}
                <div className="flex items-center gap-4">
                    {showSidebarControls && (
                        <SidebarTrigger>
                            <div
                                onClick={() => {}}
                                className="group flex items-center justify-center w-8 h-8 rounded-md border border-primary-200/50 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-primary-50 dark:hover:bg-neutral-700 hover:border-primary-300 dark:hover:border-neutral-600 transition-all duration-200"
                            >
                                <FiSidebar
                                    className="w-4 h-4 text-primary-600 dark:text-primary-400 group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors duration-200"
                                />
                            </div>
                        </SidebarTrigger>
                    )}
                    
                    {!sideBarOpen && (
                    <div className="flex items-center gap-3">
                        {/* Institute brand */}
                        <div className="flex items-center gap-2">
                            {instituteLogoFileUrl ? (
                                <img
                                    src={instituteLogoFileUrl}
                                    alt={instituteName || "Institute"}
                                    className="h-8 w-8 rounded-sm object-cover border border-primary-200/60 dark:border-neutral-700"
                                />
                            ) : (
                                <div className="h-8 w-8 rounded-sm bg-primary-200/40 dark:bg-neutral-700/60 flex items-center justify-center text-[12px] font-semibold text-primary-700 dark:text-neutral-200">
                                    {(instituteName?.[0] || "I").toUpperCase()}
                                </div>
                            )}
                            <span className="text-base font-medium text-primary-900 dark:text-primary-100">
                                {instituteName || "Institute"}
                            </span>
                        </div>
                        <div className="h-8 w-px bg-primary-200/50 dark:bg-neutral-700" />
                        <h1 className="text-lg font-semibold text-primary-900 dark:text-primary-100">
                            {navHeading || "Dashboard"}
                        </h1>
                    </div>
                    )}
                </div>

                {/* Right Section */}
                <div className="flex items-center gap-3">
                    <SystemAlertsBar />
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-px bg-primary-200/50 dark:bg-neutral-700" />
                        <Student className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                            User
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="sticky top-0 z-[9999] border-b border-primary-200/40 dark:border-neutral-800 flex h-14 items-center justify-between bg-white dark:bg-neutral-900 px-4 md:px-5 py-2 transition-all duration-300 shadow-sm">
            <LogoutSidebar />

            {/* Left Section */}
            <div className="flex items-center gap-4">
                {showSidebarControls && (
                    <SidebarTrigger>
                        <div
                            onClick={() => {}}
                            className="group flex items-center justify-center w-8 h-8 rounded-md border border-primary-200/50 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-primary-50 dark:hover:bg-neutral-700 hover:border-primary-300 dark:hover:border-neutral-600 transition-all duration-200"
                        >
                            <FiSidebar className="w-4 h-4 text-primary-600 dark:text-neutral-300 group-hover:text-primary-700 dark:group-hover:text-neutral-200 transition-colors duration-200" />
                        </div>
                    </SidebarTrigger>
                )}

                {!sideBarOpen && (
                <div className="flex items-center gap-3">
                    {/* Institute brand */}
                    <div className="flex items-center gap-2">
                        {instituteLogoFileUrl ? (
                            <img
                                src={instituteLogoFileUrl}
                                alt={instituteName || "Institute"}
                                className="h-8 w-8 rounded-sm object-cover border border-primary-200/60 dark:border-neutral-700"
                            />
                        ) : (
                            <div className="h-8 w-8 rounded-sm bg-primary-200/40 dark:bg-neutral-700/60 flex items-center justify-center text-[12px] font-semibold text-primary-700 dark:text-neutral-200">
                                {(instituteName?.[0] || "I").toUpperCase()}
                            </div>
                        )}
                        <span className="text-base font-medium text-neutral-900 dark:text-neutral-100">
                            {instituteName || "Institute"}
                        </span>
                    </div>
                    <div className="w-px h-8 bg-primary-200/60 dark:bg-neutral-700"></div>
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-6 bg-primary-600 dark:bg-primary-500 rounded-full shadow-sm"></div>
                        <div className="relative">
                            <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 leading-tight">
                                {navHeading}
                            </h1>
                            <div className="absolute -bottom-0.5 left-0 right-0 h-px bg-primary-300/50 dark:bg-neutral-700"></div>
                        </div>
                    </div>
                </div>
                )}
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-3">
                {/* System Alerts */}
                <SystemAlertsBar />

                {hasTeacherAndStudentRole && (
                    <Tooltip delayDuration={0}>
                        <TooltipTrigger>
                            <Button
                                variant="outline"
                                size="icon"
                                className="size-10 rounded-full p-2"
                                onClick={handleNavigateToAdmin}
                            >
                                <Student />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent
                            className="bg-primary-400 text-white"
                            side="left"
                        >
                            <p>Switch to Teacher</p>
                        </TooltipContent>
                    </Tooltip>
                )}
                <div className="w-px h-6 bg-primary-200/60 dark:bg-neutral-700"></div>

                {/* Menu Button (always visible) */}
                <button
                    className="group relative flex items-center justify-center w-9 h-9 rounded-md border border-primary-200/50 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-primary-100 dark:hover:bg-neutral-700 hover:border-primary-400 dark:hover:border-neutral-600 transition-all duration-200"
                    onClick={() => {
                        setSidebarOpen();
                    }}
                >
                    <List className="w-4 h-4 text-primary-600 dark:text-neutral-300 group-hover:text-primary-700 dark:group-hover:text-neutral-200 transition-colors duration-200" />
                </button>
            </div>
        </div>
    );
}
