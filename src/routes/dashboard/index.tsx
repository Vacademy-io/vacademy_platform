import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { fetchStaticData } from "./-lib/utils";
import { Helmet } from "react-helmet";
import { fetchStudentDetails } from "@/services/studentDetails";
import { getUserId } from "@/constants/getUserId";
import { getInstituteId } from "@/constants/helper";
import { Preferences } from "@capacitor/preferences";
import { getPackageSessionId } from "@/utils/study-library/get-list-from-stores/getPackageSessionId";
import { fetchStudyLibraryDetails } from "@/services/study-library/getStudyLibraryDetails";
import { useStudyLibraryStore } from "@/stores/study-library/use-study-library-store";
import {
    DashbaordResponse,
    DashboardSlide,
} from "./-types/dashboard-data-types";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { PastLearningInsights } from "./-components/PastLearningInsights";
import { fetchAndStoreInstituteDetails } from "@/services/fetchAndStoreInstituteDetails";
import { useInstituteFeatureStore } from "@/stores/insititute-feature-store";
import { useLiveSessions } from "../study-library/live-class/-hooks/useLiveSessions";
import { HOLISTIC_INSTITUTE_ID } from "@/constants/urls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    BookOpen,
    CheckCircle,
    Hourglass,
    Users,
    XCircle,
    TrendUp,
    Clock,
    Target,
    Trophy,
    Calendar,
    Play,
    FileText,
    PencilSimple,
    ChartLine,
} from "phosphor-react";
import { Button } from "@/components/ui/button";
import { MyButton } from "@/components/design-system/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Sparkles } from "lucide-react";
import { SessionDetails } from "../study-library/live-class/-types/types";
import { useMarkAttendance } from "../study-library/live-class/-hooks/useMarkAttendance";
import { SessionStreamingServiceType } from "../register/live-class/-types/enum";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/")({
    beforeLoad: async () => {
        const instituteId = await getInstituteId();
        const userId = await getUserId();

        if (!instituteId || !userId) {
            throw new Error("Institute ID or User ID is missing");
        }
        await fetchAndStoreInstituteDetails(instituteId, userId);
        const response = await fetchStudentDetails(instituteId, userId);
        const studentDetails = response.data[0];
        await Preferences.set({
            key: "studentDetails",
            value: JSON.stringify(studentDetails),
        });
    },
    component: () => {
        return (
            <LayoutContainer>
                <DashboardComponent />
            </LayoutContainer>
        );
    },
});

// Loading skeleton component
const StatCardSkeleton = () => (
    <div className="group relative overflow-hidden">
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl sm:rounded-2xl p-4 sm:p-6 transition-all duration-300">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 rounded-lg sm:rounded-xl animate-pulse"></div>
                <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="space-y-2 sm:space-y-3">
                <div className="w-12 h-6 sm:w-16 sm:h-8 bg-gray-200 rounded animate-pulse"></div>
                <div className="w-20 h-3 sm:w-24 sm:h-4 bg-gray-200 rounded animate-pulse"></div>
            </div>
        </div>
    </div>
);

// Enhanced Stat Card Component
const StatCard = ({
    title,
    count,
    icon: Icon,
    onClick,
    gradient,
    isLoading = false,
}: {
    title: string;
    count: number | undefined;
    icon: any;
    onClick: () => void;
    gradient: string;
    isLoading?: boolean;
}) => {
    if (isLoading) return <StatCardSkeleton />;

    return (
        <div
            onClick={onClick}
            className="group relative overflow-hidden cursor-pointer transform transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1 active:scale-[0.98]"
        >
            {/* Background gradient overlay */}
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl sm:rounded-2xl`}></div>
            
            {/* Main card */}
            <div className="relative bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-xl hover:border-primary-300/40 transition-all duration-500 group-hover:bg-white/90">
                {/* Floating orb effect */}
                <div className="absolute top-0 right-0 w-12 h-12 sm:w-20 sm:h-20 bg-primary-100/30 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 -translate-y-2 sm:-translate-y-4 translate-x-2 sm:translate-x-4"></div>
                
                <div className="flex items-center justify-between mb-3 sm:mb-5">
                    <div className="p-2 sm:p-3 bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg sm:rounded-xl text-primary-600 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                        <Icon weight="duotone" size={20} className="sm:w-6 sm:h-6" />
                    </div>
                    <div className="opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                        <ChevronRight 
                            size={18} 
                            className="text-gray-400 group-hover:text-primary-500 transition-colors duration-300 group-hover:translate-x-1 sm:w-5 sm:h-5" 
                        />
                    </div>
                </div>
                
                <div className="space-y-1 sm:space-y-2">
                    <div className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight leading-tight">
                        {(count ?? 0).toLocaleString()}
                    </div>
                    <div className="text-xs sm:text-sm font-medium text-gray-600 group-hover:text-gray-700 transition-colors duration-300 line-clamp-2">
                        {title}
                    </div>
                </div>
                
                {/* Progress indicator */}
                <div className="absolute bottom-0 left-0 h-0.5 sm:h-1 bg-gradient-to-r from-primary-400 to-primary-600 w-0 group-hover:w-full transition-all duration-700 ease-out rounded-b-xl sm:rounded-b-2xl"></div>
            </div>
        </div>
    );
};

// Enhanced Continue Learning Card
const ContinueLearningCard = ({ data, onResumeClick }: { data: DashbaordResponse | null; onResumeClick: (slide: DashboardSlide) => void }) => {
    if (!data?.slides || data.slides.length === 0) {
        return (
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary-50/80 via-white to-primary-100/30 shadow-sm hover:shadow-lg transition-all duration-500">
                <CardContent className="p-6 sm:p-8 text-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
                        <Target weight="duotone" size={24} className="text-primary-600 sm:w-8 sm:h-8" />
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">All Caught Up!</h3>
                    <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 max-w-sm mx-auto">
                        You've completed all available lessons. Explore more content to continue learning.
                    </p>
                    <MyButton buttonType="primary" scale="medium" className="w-full sm:w-auto">
                        <BookOpen weight="duotone" size={16} className="mr-2" />
                        <span className="text-sm sm:text-base">Explore Content</span>
                    </MyButton>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-gray-50/80 via-white to-primary-50/30 shadow-sm hover:shadow-lg transition-all duration-500">
            {/* Animated background pattern */}
            <div className="absolute inset-0 opacity-5">
                <div className="absolute top-0 left-1/4 w-20 h-20 sm:w-32 sm:h-32 bg-primary-300 rounded-full blur-3xl animate-gentle-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-24 h-24 sm:w-40 sm:h-40 bg-primary-200 rounded-full blur-3xl animate-gentle-pulse" style={{ animationDelay: '1s' }}></div>
            </div>
            
            <CardHeader className="pb-3 sm:pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg">
                            <Play weight="duotone" size={18} className="text-primary-600" />
                        </div>
                        <div className="min-w-0">
                            <CardTitle className="text-lg sm:text-xl font-semibold text-gray-900">Continue Learning</CardTitle>
                            <p className="text-xs sm:text-sm text-gray-600 mt-1">
                                {data.slides.length} lesson{data.slides.length !== 1 ? 's' : ''} in progress
                            </p>
                        </div>
                    </div>
                    <Badge variant="secondary" className="bg-primary-100 text-primary-700 border-primary-200 text-xs self-start sm:self-auto">
                        <Sparkles size={10} className="mr-1" />
                        Active
                    </Badge>
                </div>
            </CardHeader>
            
            <CardContent className="pt-0">
                <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                    {data.slides.slice(0, 3).map((slide, index) => (
                        <div
                            key={slide.slide_id}
                            onClick={() => onResumeClick(slide)}
                            className="group flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white/70 backdrop-blur-sm border border-gray-200/60 rounded-lg sm:rounded-xl hover:bg-white hover:border-primary-300/60 transition-all duration-300 cursor-pointer hover:shadow-md active:scale-[0.98] w-full overflow-hidden"
                        >
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg flex items-center justify-center">
                                    <span className="text-primary-600 font-semibold text-xs sm:text-sm">{index + 1}</span>
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-900 truncate group-hover:text-primary-600 transition-colors duration-300 text-sm sm:text-base">
                                    {slide.slide_title}
                                </h4>
                                <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-1">
                                    {slide.slide_description || "Continue from where you left off"}
                                </p>
                            </div>
                            <div className="flex-shrink-0">
                                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-primary-100 transition-colors duration-300">
                                    <ChevronRight size={14} className="text-gray-400 group-hover:text-primary-600 sm:w-4 sm:h-4" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                
                <MyButton 
                    buttonType="primary" 
                    scale="medium"
                    onClick={() => data.slides[0] && onResumeClick(data.slides[0])}
                    className="w-full"
                >
                    <Play weight="duotone" size={16} className="mr-2" />
                    <span className="text-sm sm:text-base">Resume Learning</span>
                </MyButton>
            </CardContent>
        </Card>
    );
};

export function DashboardComponent() {
    const [username, setUsername] = useState<string | null>(null);
    const [testAssignedCount, setTestAssignedCount] = useState<number>(0);
    const [homeworkAssignedCount, setHomeworkAssignedCount] = useState<number>(0);
    const [batchId, setBatchId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { showForInstitutes } = useInstituteFeatureStore();
    const { mutateAsync: markAttendance } = useMarkAttendance();
    const { setNavHeading } = useNavHeadingStore();
    const navigate = useNavigate();
    const { studyLibraryData, setStudyLibraryData } = useStudyLibraryStore();
    const [data, setData] = useState<DashbaordResponse | null>(null);
    const { setActiveItem } = useContentStore();
    const {
        data: liveSessions,
        isLoading: isLoadingLiveSessions,
        refetch: refetchLiveSessions,
    } = useLiveSessions(batchId || "");

    const handleGetStudyLibraryData = async () => {
        try {
            const PackageSessionId = await getPackageSessionId();
            const data = await fetchStudyLibraryDetails(PackageSessionId);
            setStudyLibraryData(data);
        } catch (error) {
            console.error("Error fetching study library data:", error);
        }
    };

    const handleResumeClick = (slide: DashboardSlide) => {
        setActiveItem({
            id: slide.slide_id,
            source_id: "",
            source_type: slide.source_type,
            title: slide.slide_title,
            image_file_id: "",
            description: slide.slide_description,
            status: slide.status,
            slide_order: 0,
            is_loaded: false,
            new_slide: false,
            percentage_completed: 0,
            progress_marker: slide.progress_marker,
        });
        navigate({
            to: `/study-library/courses/course-details/subjects/modules/chapters/slides?subjectId=${slide.subject_id}&moduleId=${slide.module_id}&chapterId=${slide.chapter_id}&slideId=${slide.slide_id}`,
        });
    };

    useEffect(() => {
        const fetchBatchId = async () => {
            try {
                const id = await getPackageSessionId();
                setBatchId(id);
            } catch (error) {
                console.error("Error fetching batch ID:", error);
            }
        };
        fetchBatchId();
    }, []);

    useEffect(() => {
        if (batchId) {
            const interval = setInterval(() => {
                refetchLiveSessions();
            }, 60000);
            return () => clearInterval(interval);
        }
    }, [batchId, refetchLiveSessions]);

    useEffect(() => {
        setNavHeading("Dashboard");
        const initializeDashboard = async () => {
            setIsLoading(true);
            try {
                await Promise.all([
                    fetchStaticData(setUsername, setTestAssignedCount, setHomeworkAssignedCount, setData),
                    handleGetStudyLibraryData(),
                ]);
            } catch (error) {
                console.error("Error initializing dashboard:", error);
            } finally {
                // Add a small delay for smooth loading transition
                setTimeout(() => setIsLoading(false), 800);
            }
        };
        initializeDashboard();
    }, []);

    const handleJoinSession = async (session: SessionDetails) => {
        const now = new Date();
        const sessionDate = new Date(`${session.meeting_date}T${session.start_time}`);
        const waitingRoomStart = new Date(sessionDate);
        waitingRoomStart.setMinutes(waitingRoomStart.getMinutes() - session.waiting_room_time);

        const isInWaitingRoom = now >= waitingRoomStart && now < sessionDate;
        const isInMainSession = now >= sessionDate;

        if (isInWaitingRoom) {
            navigate({
                to: "/study-library/live-class/waiting-room",
                search: { sessionId: session.schedule_id },
            });
        } else if (isInMainSession) {
            try {
                await markAttendance({
                    sessionId: session.session_id,
                    scheduleId: session.schedule_id,
                    userSourceType: "USER",
                    userSourceId: "",
                    details: "Joined live class directly",
                });

                if (session.session_streaming_service_type === SessionStreamingServiceType.EMBED) {
                    navigate({
                        to: "/study-library/live-class/embed",
                        search: { sessionId: session.schedule_id },
                    });
                } else {
                    window.open(session.meeting_link, "_blank", "noopener,noreferrer");
                }
            } catch (error) {
                console.error("Failed to mark attendance:", error);
                toast.error("Failed to mark attendance");

                if (session.session_streaming_service_type === SessionStreamingServiceType.EMBED) {
                    navigate({
                        to: "/study-library/live-class/embed",
                        search: { sessionId: session.schedule_id },
                    });
                } else {
                    window.open(session.meeting_link, "_blank", "noopener,noreferrer");
                }
            }
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50/80 via-white to-primary-50/20 relative overflow-hidden w-full max-w-full">
            <Helmet>
                <title>Dashboard</title>
                <meta name="description" content="Enterprise Dashboard - Learning Management System" />
            </Helmet>

            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-32 md:w-64 h-32 md:h-64 bg-gradient-to-br from-primary-100/20 to-transparent rounded-full blur-3xl animate-gentle-pulse"></div>
                <div className="absolute bottom-1/3 right-1/3 w-40 md:w-80 h-40 md:h-80 bg-gradient-to-br from-primary-50/30 to-transparent rounded-full blur-3xl animate-gentle-pulse" style={{ animationDelay: '2s' }}></div>
            </div>

            <div className="relative z-10 space-y-6 md:space-y-8 p-4 sm:p-6 max-w-7xl mx-auto w-full max-w-full overflow-hidden">
                {/* Enhanced Header Section */}
                <div className="animate-fade-in-down">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-6">
                        <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
                            <div className="relative flex-shrink-0">
                                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
                                    <span className="text-lg sm:text-2xl font-bold text-primary-700">
                                        {username?.charAt(0)?.toUpperCase() || 'U'}
                                    </span>
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-6 sm:h-6 bg-success-500 rounded-full border-2 border-white shadow-sm animate-gentle-pulse"></div>
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight leading-tight">
                                    {isLoading ? (
                                        <div className="w-40 sm:w-48 h-6 sm:h-8 bg-gray-200 rounded animate-pulse"></div>
                                    ) : (
                                        <span className="block sm:inline">{`Welcome back, ${username}!`} <span className="hidden sm:inline">👋</span></span>
                                    )}
                                </h1>
                                <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2 flex items-center space-x-2">
                                    {showForInstitutes([HOLISTIC_INSTITUTE_ID]) ? (
                                        <>
                                            <Sparkles size={14} className="text-primary-500 flex-shrink-0" />
                                            <span className="text-sm sm:text-base">Ready for today's yoga journey?</span>
                                        </>
                                    ) : (
                                        <>
                                            <TrendUp size={14} className="text-primary-500 flex-shrink-0" />
                                            <span className="text-sm sm:text-base">Your learning dashboard</span>
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-center sm:justify-end">
                            <div className="bg-white/70 backdrop-blur-sm border border-gray-200 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 shadow-sm">
                                <div className="flex items-center space-x-2 text-gray-600">
                                    <Calendar weight="duotone" size={16} className="text-primary-500 flex-shrink-0" />
                                    <span className="font-medium text-sm sm:text-base">
                                        {new Date().toLocaleDateString("en-US", {
                                            weekday: "short",
                                            month: "short",
                                            day: "numeric",
                                        })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {!showForInstitutes([HOLISTIC_INSTITUTE_ID]) && (
                    <>
                        {/* Enhanced Stats Grid */}
                        <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                                <StatCard
                                    title="Study Materials"
                                    count={studyLibraryData?.length || 0}
                                    icon={BookOpen}
                                    onClick={() => navigate({ to: '/study-library/courses' })}
                                    gradient="from-blue-500/10 to-primary-500/10"
                                    isLoading={isLoading}
                                />
                                <StatCard
                                    title="Assignments"
                                    count={homeworkAssignedCount}
                                    icon={PencilSimple}
                                    onClick={() => navigate({ to: '/homework/list' })}
                                    gradient="from-green-500/10 to-emerald-500/10"
                                    isLoading={isLoading}
                                />
                                <StatCard
                                    title="Evaluations"
                                    count={testAssignedCount}
                                    icon={Trophy}
                                    onClick={() => navigate({ to: '/assessment/examination' })}
                                    gradient="from-purple-500/10 to-pink-500/10"
                                    isLoading={isLoading}
                                />
                            </div>
                        </div>

                        {/* Enhanced Continue Learning Section */}
                        <div className="animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                            <ContinueLearningCard data={data} onResumeClick={handleResumeClick} />
                        </div>

                        {/* Enhanced Analytics Section */}
                        <div className="animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
                            <PastLearningInsights />
                        </div>
                    </>
                )}

                {showForInstitutes([HOLISTIC_INSTITUTE_ID]) && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                        {/* Hero Section */}
                        <div className="lg:col-span-8">
                            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-50/80 via-white to-pink-50/60 shadow-lg hover:shadow-xl transition-all duration-500">
                                <CardContent className="p-4 sm:p-6 lg:p-0 relative">
                                    <div className="absolute inset-0 bg-gradient-to-br from-purple-100/20 to-pink-100/20"></div>
                                    <img
                                        src="/yoga-dashboard.png"
                                        alt="Yoga illustration"
                                        className="object-contain w-48 h-48 sm:w-60 sm:h-60 lg:w-72 lg:h-72 mx-auto relative z-10"
                                    />
                                </CardContent>
                            </Card>
                        </div>

                        {/* Attendance Section */}
                        <div className="lg:col-span-4 space-y-4 sm:space-y-6">
                            <Card className="border-0 bg-gradient-to-br from-white/80 to-primary-50/30 shadow-lg">
                                <CardHeader className="pb-3 sm:pb-4">
                                    <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
                                        <CheckCircle weight="duotone" size={18} className="text-primary-600" />
                                        <span>This Week</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="flex items-center justify-center gap-1 sm:gap-2">
                                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, index) => {
                                            const icons = [CheckCircle, XCircle, CheckCircle, Hourglass, Hourglass];
                                            const colors = ['text-success-500', 'text-danger-500', 'text-success-500', 'text-warning-500', 'text-warning-500'];
                                            const Icon = icons[index];
                                            return (
                                                <div key={day} className="flex flex-col items-center space-y-1 sm:space-y-2 p-2 sm:p-3 bg-white/70 rounded-lg sm:rounded-xl border border-gray-200/50">
                                                    <Icon size={16} className={colors[index]} weight="duotone" />
                                                    <span className="text-xs font-medium text-gray-600">{day}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-0 bg-gradient-to-br from-white/80 to-blue-50/30 shadow-lg">
                                <CardContent className="p-4 sm:p-6">
                                    <div className="flex items-center space-x-3 sm:space-x-4">
                                        <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg sm:rounded-xl flex-shrink-0">
                                            <Users weight="duotone" size={20} className="text-blue-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Refer A Friend</h3>
                                            <p className="text-xs sm:text-sm text-gray-600 mt-1">Share the journey</p>
                                        </div>
                                        <MyButton buttonType="secondary" scale="small">
                                            <span className="text-xs sm:text-sm">Invite</span>
                                        </MyButton>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Live Classes Section */}
                        <div className="lg:col-span-12">
                            <Card className="border-0 bg-gradient-to-br from-white/80 to-green-50/30 shadow-lg">
                                <CardHeader className="pb-3 sm:pb-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                                        <CardTitle className="flex items-center space-x-3">
                                            <div className="p-2 bg-gradient-to-br from-green-100 to-green-200 rounded-lg">
                                                <BookOpen weight="duotone" size={18} className="text-green-600" />
                                            </div>
                                            <span className="text-base sm:text-lg">My Classes</span>
                                        </CardTitle>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => navigate({ to: "/study-library/live-class" })}
                                            className="hover:bg-green-100 text-sm self-start sm:self-auto"
                                        >
                                            View All <ChevronRight size={14} className="ml-1" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    {isLoadingLiveSessions ? (
                                        <div className="space-y-3 sm:space-y-4">
                                            {[1, 2, 3].map((i) => (
                                                <div key={i} className="flex items-center space-x-3 sm:space-x-4 p-3 sm:p-4 bg-gray-100 rounded-lg sm:rounded-xl animate-pulse">
                                                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-200 rounded-lg flex-shrink-0"></div>
                                                    <div className="flex-1 space-y-2">
                                                        <div className="w-3/4 h-3 sm:h-4 bg-gray-200 rounded"></div>
                                                        <div className="w-1/2 h-2 sm:h-3 bg-gray-200 rounded"></div>
                                                    </div>
                                                    <div className="w-16 sm:w-20 h-6 sm:h-8 bg-gray-200 rounded flex-shrink-0"></div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {liveSessions?.live_sessions?.map((session, index) => (
                                                <div
                                                    key={`live-${session.session_id}-${index}`}
                                                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-3 sm:p-4 bg-white/70 backdrop-blur-sm border border-gray-200/60 rounded-lg sm:rounded-xl hover:bg-white hover:border-green-300/60 transition-all duration-300 w-full overflow-hidden"
                                                >
                                                    <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
                                                        <div className="p-2 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex-shrink-0">
                                                            <BookOpen weight="duotone" size={18} className="text-green-600" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{session.title}</h3>
                                                            <p className="text-xs sm:text-sm text-gray-600 mt-1">
                                                                {new Date(`${session.meeting_date}T${session.start_time}`).toLocaleTimeString("en-US", {
                                                                    hour: "numeric",
                                                                    minute: "2-digit",
                                                                    hour12: true,
                                                                })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-3">
                                                        <Badge className="bg-success-100 text-success-700 border-success-300 text-xs">
                                                            Live
                                                        </Badge>
                                                        <MyButton
                                                            buttonType="primary"
                                                            scale="small"
                                                            onClick={() => handleJoinSession(session)}
                                                        >
                                                            <span className="text-xs sm:text-sm">Join Now</span>
                                                        </MyButton>
                                                    </div>
                                                </div>
                                            ))}

                                            {liveSessions?.upcoming_sessions?.slice(0, 2).map((session, index) => (
                                                <div
                                                    key={`upcoming-${session.session_id}-${index}`}
                                                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-3 sm:p-4 bg-white/70 backdrop-blur-sm border border-gray-200/60 rounded-lg sm:rounded-xl hover:bg-white transition-all duration-300 w-full overflow-hidden"
                                                >
                                                    <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
                                                        <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex-shrink-0">
                                                            <Clock weight="duotone" size={18} className="text-blue-600" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{session.title}</h3>
                                                            <p className="text-xs sm:text-sm text-gray-600 mt-1">
                                                                {new Date(`${session.meeting_date}T${session.start_time}`).toLocaleDateString("en-US", {
                                                                    month: "short",
                                                                    day: "numeric",
                                                                })} at {new Date(`${session.meeting_date}T${session.start_time}`).toLocaleTimeString("en-US", {
                                                                    hour: "numeric",
                                                                    minute: "2-digit",
                                                                    hour12: true,
                                                                })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-end">
                                                        <Badge variant="secondary" className="bg-info-100 text-info-700 border-info-300 text-xs">
                                                            Upcoming
                                                        </Badge>
                                                    </div>
                                                </div>
                                            ))}

                                            {!liveSessions?.live_sessions?.length && !liveSessions?.upcoming_sessions?.length && (
                                                <div className="text-center py-8 sm:py-12">
                                                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
                                                        <BookOpen weight="duotone" size={24} className="text-gray-400" />
                                                    </div>
                                                    <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">No classes scheduled</h3>
                                                    <p className="text-gray-600 mb-4 sm:mb-6 text-sm">Check back later for upcoming live classes</p>
                                                    <MyButton
                                                        buttonType="secondary"
                                                        scale="medium"
                                                        onClick={() => navigate({ to: "/study-library/live-class" })}
                                                    >
                                                        <span className="text-sm">View All Classes</span>
                                                    </MyButton>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
