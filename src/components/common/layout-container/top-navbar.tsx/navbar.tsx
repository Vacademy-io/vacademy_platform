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
    const { data: userRoleDetails, isLoading } = useSuspenseQuery(
        handleFetchUserRoleDetails()
    );

    const [hasTeacherAndStudentRole, setHasTeacherAndStudentRole] =
        useState(false);

    const roleNames = userRoleDetails?.roles?.map(
        (role: UserRole) => role.role_name
    );

    useEffect(() => {
        setHasTeacherAndStudentRole(
            roleNames.includes("STUDENT") && roleNames.includes("TEACHER")
        );
    }, [userRoleDetails]);

    const { navHeading } = useNavHeadingStore();
    const { setInstituteDetails, setSidebarOpen } = useStore();

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
        // Load sidebar visibility from Student Display Settings (uses cache on dashboard refresh)
        getStudentDisplaySettings(false)
            .then((s) => setShowSidebarControls(s?.sidebar?.visible !== false))
            .catch(() => setShowSidebarControls(true));
    }, []);

    if (isLoading) return <DashboardLoader />;

    return (
        <div className="sticky top-0 z-[9999] border-b border-primary-200/40 dark:border-neutral-800 flex h-14 items-center justify-between bg-gradient-to-r from-white via-primary-50/20 to-blue-50/20 dark:bg-gradient-to-r dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900 px-4 md:px-5 py-2 transition-all duration-300 shadow-sm">
            <LogoutSidebar />

            {/* Left Section */}
            <div className="flex items-center gap-4">
                {showSidebarControls && (
                    <SidebarTrigger>
                        <div
                            onClick={() => {}}
                            className="group flex items-center justify-center w-8 h-8 rounded-md border border-primary-200/50 dark:border-neutral-700 bg-gradient-to-br from-white to-primary-50/40 dark:from-neutral-800 dark:to-neutral-700/40 hover:from-primary-50 hover:to-primary-100 hover:border-primary-300 dark:hover:from-neutral-700 dark:hover:to-neutral-600 dark:hover:border-neutral-600 transition-all duration-200"
                        >
                            <FiSidebar className="w-4 h-4 text-primary-600 dark:text-neutral-300 group-hover:text-primary-700 dark:group-hover:text-neutral-200 transition-colors duration-200" />
                        </div>
                    </SidebarTrigger>
                )}

                <div className="flex items-center gap-3">
                    <div className="w-px h-6 bg-gradient-to-b from-transparent via-primary-300/60 to-transparent"></div>
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-6 bg-gradient-to-b from-primary-500 via-primary-600 to-blue-600 rounded-full shadow-sm"></div>
                        <div className="relative">
                            <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 leading-tight">
                                {navHeading}
                            </h1>
                            <div className="absolute -bottom-0.5 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-300/50 dark:via-neutral-700 to-transparent"></div>
                        </div>
                    </div>
                </div>
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
                <div className="w-px h-6 bg-gradient-to-b from-transparent via-primary-300/60 dark:via-neutral-700 to-transparent"></div>

                {/* Menu Button (always visible) */}
                <button
                    className="group relative flex items-center justify-center w-9 h-9 rounded-md border border-primary-200/50 dark:border-neutral-700 bg-gradient-to-br from-white to-primary-50/40 dark:from-neutral-800 dark:to-neutral-700/40 hover:from-primary-100 hover:to-primary-200 hover:border-primary-400 dark:hover:from-neutral-700 dark:hover:to-neutral-600 dark:hover:border-neutral-600 transition-all duration-200 overflow-hidden"
                    onClick={() => {
                        setSidebarOpen();
                    }}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-400/0 to-primary-600/0 group-hover:from-primary-400/10 group-hover:to-primary-600/20 dark:group-hover:from-neutral-600/20 dark:group-hover:to-neutral-500/20 transition-all duration-300"></div>
                    <List className="relative w-4 h-4 text-primary-600 dark:text-neutral-300 group-hover:text-primary-700 dark:group-hover:text-neutral-200 transition-colors duration-200" />
                    <div className="absolute inset-0 rounded-md bg-gradient-to-br from-white/20 dark:from-neutral-700/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>
            </div>
        </div>
    );
}
