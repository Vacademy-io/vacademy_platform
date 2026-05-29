import { useState } from 'react';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import {
    useLearnerPackagesQuery,
    type PackageDetailDTO,
} from '@/routes/manage-students/students-list/-services/getLearnerPackages';
import { getInstituteId } from '@/constants/helper';
import { MyButton } from '@/components/design-system/button';
import { ChipToggleGroup } from '@/components/design-system/chips';
import { AssignCourseDialog } from './assign-course-dialog';
import { DeassignCourseDialog } from './deassign-course-dialog';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_LEVELS_BY_INSTITUTE } from '@/constants/urls';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useNavigate } from '@tanstack/react-router';
import { getTerminology, getTerminologyPlural } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import {
    BookOpen,
    CheckCircle,
    ClockCounterClockwise,
    GraduationCap,
    CaretLeft,
    CaretRight,
    Funnel,
    Trash,
    type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import {
    ProfileSectionCard,
    ProfileSkeleton,
    ProfileEmpty,
    ProfileHeroStat,
    ProfileActionBar,
    ProfileMiniBar,
} from '../profile-ui';

const ITEMS_PER_PAGE = 20;

type FilterKey = 'all' | 'progress' | 'completed' | 'past';

export const StudentCourses = ({ isSubmissionTab, packageSessionId }: { isSubmissionTab?: boolean; packageSessionId?: string }) => {
    const { selectedStudent } = useStudentSidebar();
    const instituteId = getInstituteId();
    const userId = isSubmissionTab ? selectedStudent?.id || '' : selectedStudent?.user_id || '';
    const { getDetailsFromPackageSessionId } = useInstituteDetailsStore();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [assignOpen, setAssignOpen] = useState(false);
    const [deassignOpen, setDeassignOpen] = useState(false);
    const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
    const [progressPage, setProgressPage] = useState(0);
    const [completedPage, setCompletedPage] = useState(0);
    const [pastPage, setPastPage] = useState(0);
    const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

    const levelIds = selectedLevelId ? [selectedLevelId] : [];
    const packageSessionIds = packageSessionId ? [packageSessionId] : [];

    const {
        data: progressCourses,
        isLoading: isLoadingProgress,
    } = useLearnerPackagesQuery({
        instituteId: instituteId || '',
        userId,
        type: 'PROGRESS',
        page: progressPage,
        size: ITEMS_PER_PAGE,
        levelIds,
        packageSessionIds,
    });

    const {
        data: completedCourses,
        isLoading: isLoadingCompleted,
    } = useLearnerPackagesQuery({
        instituteId: instituteId || '',
        userId,
        type: 'COMPLETED',
        page: completedPage,
        size: ITEMS_PER_PAGE,
        levelIds,
        packageSessionIds,
    });

    const {
        data: pastCourses,
        isLoading: isLoadingPast,
    } = useLearnerPackagesQuery({
        instituteId: instituteId || '',
        userId,
        type: 'PAST',
        page: pastPage,
        size: ITEMS_PER_PAGE,
        levelIds,
        packageSessionIds,
    });

    const { data: availableLevels = [] } = useQuery<{ id: string; level_name: string }[]>({
        queryKey: ['GET_INSTITUTE_LEVELS', instituteId],
        queryFn: async () => {
            const response = await authenticatedAxiosInstance.get(GET_LEVELS_BY_INSTITUTE, {
                params: { instituteId },
            });
            return response.data;
        },
        staleTime: 300000,
        enabled: !!instituteId,
    });

    if (!selectedStudent || !instituteId) {
        return (
            <ProfileEmpty
                icon={GraduationCap}
                title="Student details unavailable"
                hint="No learner is selected or the institute could not be determined."
            />
        );
    }

    if (isLoadingProgress || isLoadingCompleted || isLoadingPast) {
        return <ProfileSkeleton blocks={3} />;
    }

    const allActiveCourses: PackageDetailDTO[] = [
        ...(progressCourses?.content || []),
        ...(completedCourses?.content || []),
    ];

    // Hero stat counts — derived from paginated totals (totalElements) when available,
    // falling back to the length of the current page content.
    const progressCount = progressCourses?.totalElements ?? progressCourses?.content?.length ?? 0;
    const completedCount = completedCourses?.totalElements ?? completedCourses?.content?.length ?? 0;
    const pastCount = pastCourses?.totalElements ?? pastCourses?.content?.length ?? 0;
    const totalCount = progressCount + completedCount + pastCount;

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['GET_LEARNER_PACKAGES'] });
    };

    const handleCourseClick = (course: PackageDetailDTO) => {
        const courseId = course.id;
        const levelId = course.level_id || 'DEFAULT';
        let sessionId: string | undefined;

        if (course.package_session_id) {
            const batchDetails = getDetailsFromPackageSessionId({
                packageSessionId: course.package_session_id,
            });
            if (batchDetails) {
                sessionId = batchDetails.session.id;
            }
        }

        navigate({
            to: '/study-library/courses/course-details/subjects',
            search: { courseId, levelId, sessionId },
        });
    };

    const handleLevelFilter = (levelId: string | null) => {
        setSelectedLevelId(levelId);
        setProgressPage(0);
        setCompletedPage(0);
        setPastPage(0);
    };

    const handleStatFilter = (key: FilterKey) => {
        setActiveFilter((prev) => (prev === key ? 'all' : key));
    };

    const courseTermSingular = getTerminology(ContentTerms.Course, SystemTerms.Course);
    const courseTermPlural = getTerminologyPlural(ContentTerms.Course, SystemTerms.Course);

    // When there are no courses at all, show a dedicated empty state with primary action.
    if (totalCount === 0 && !isLoadingProgress && !isLoadingCompleted && !isLoadingPast) {
        return (
            <div className="flex flex-col gap-3">
                <ProfileEmpty
                    icon={BookOpen}
                    title={`No ${courseTermPlural.toLowerCase()} assigned`}
                    hint="Assign a program to get started."
                    action={
                        <>
                            <MyButton
                                buttonType="primary"
                                scale="small"
                                onClick={() => setAssignOpen(true)}
                            >
                                + Assign to {courseTermSingular}
                            </MyButton>
                            <AssignCourseDialog
                                userId={userId}
                                userName={selectedStudent?.full_name || 'Student'}
                                open={assignOpen}
                                onOpenChange={setAssignOpen}
                                onSuccess={handleRefresh}
                            />
                        </>
                    }
                />
            </div>
        );
    }

    const showProgress = activeFilter === 'all' || activeFilter === 'progress';
    const showCompleted = activeFilter === 'all' || activeFilter === 'completed';
    const showPast = activeFilter === 'all' || activeFilter === 'past';

    return (
        <div className="flex flex-col gap-3">
            {/* Hero stat grid — 3 tiles, single row on desktop, wraps on narrow */}
            <div className="grid grid-cols-3 gap-2">
                <ProfileHeroStat
                    label="In Progress"
                    value={progressCount}
                    tone="primary"
                    icon={BookOpen}
                    selected={activeFilter === 'progress'}
                    onClick={() => handleStatFilter('progress')}
                />
                <ProfileHeroStat
                    label="Completed"
                    value={completedCount}
                    tone="success"
                    icon={CheckCircle}
                    selected={activeFilter === 'completed'}
                    onClick={() => handleStatFilter('completed')}
                />
                <ProfileHeroStat
                    label="Past"
                    value={pastCount}
                    tone="neutral"
                    icon={ClockCounterClockwise}
                    selected={activeFilter === 'past'}
                    onClick={() => handleStatFilter('past')}
                />
            </div>

            {/* Primary action bar */}
            <ProfileActionBar>
                <MyButton
                    buttonType="primary"
                    scale="small"
                    onClick={() => setAssignOpen(true)}
                >
                    + Assign to {courseTermSingular}
                </MyButton>
                <MyButton
                    buttonType="secondary"
                    scale="small"
                    onClick={() => setDeassignOpen(true)}
                    disable={allActiveCourses.length === 0}
                >
                    Remove from {courseTermSingular}
                </MyButton>
            </ProfileActionBar>

            {/* Level filter chips */}
            {availableLevels.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                    <Funnel className="size-3.5 shrink-0 text-muted-foreground" />
                    <ChipToggleGroup<string>
                        value={selectedLevelId ?? '__ALL__'}
                        onChange={(v) => handleLevelFilter(v === '__ALL__' ? null : v)}
                        options={[
                            { value: '__ALL__', label: 'All' },
                            ...availableLevels.map((level) => ({
                                value: level.id,
                                label: level.level_name,
                            })),
                        ]}
                        ariaLabel="Filter courses by level"
                    />
                </div>
            )}

            {/* In Progress — shown first as most actionable */}
            {showProgress && (
                <InProgressSection
                    courseTermPlural={courseTermPlural}
                    courses={progressCourses?.content || []}
                    page={progressPage}
                    totalPages={progressCourses?.totalPages || 0}
                    onPageChange={setProgressPage}
                    onCourseClick={handleCourseClick}
                    getSessionName={(course) => {
                        if (!course.package_session_id) return null;
                        const details = getDetailsFromPackageSessionId({ packageSessionId: course.package_session_id });
                        return details?.session.session_name || null;
                    }}
                    onDeassign={() => setDeassignOpen(true)}
                />
            )}

            {/* Completed */}
            {showCompleted && (
                <CourseSection
                    title={`Completed ${courseTermPlural}`}
                    icon={CheckCircle}
                    courses={completedCourses?.content || []}
                    emptyMessage={`No completed ${courseTermPlural.toLowerCase()}`}
                    onCourseClick={handleCourseClick}
                    getSessionName={(course) => {
                        if (!course.package_session_id) return null;
                        const details = getDetailsFromPackageSessionId({ packageSessionId: course.package_session_id });
                        return details?.session.session_name || null;
                    }}
                    renderBadge={(course) => (
                        <div className="flex shrink-0 items-center gap-1.5">
                            {course.level_name && (
                                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium capitalize text-neutral-600">
                                    {course.level_name}
                                </span>
                            )}
                            <span className="rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700">
                                Completed
                            </span>
                        </div>
                    )}
                    page={completedPage}
                    totalPages={completedCourses?.totalPages || 0}
                    onPageChange={setCompletedPage}
                />
            )}

            {/* Past */}
            {showPast && (
                <CourseSection
                    title={`Past ${courseTermPlural}`}
                    icon={GraduationCap}
                    courses={pastCourses?.content || []}
                    emptyMessage={`No past ${courseTermPlural.toLowerCase()}`}
                    onCourseClick={handleCourseClick}
                    getSessionName={(course) => {
                        if (!course.package_session_id) return null;
                        const details = getDetailsFromPackageSessionId({ packageSessionId: course.package_session_id });
                        return details?.session.session_name || null;
                    }}
                    renderBadge={(course) =>
                        course.level_name ? (
                            <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium capitalize text-neutral-600">
                                {course.level_name}
                            </span>
                        ) : null
                    }
                    page={pastPage}
                    totalPages={pastCourses?.totalPages || 0}
                    onPageChange={setPastPage}
                />
            )}

            {/* Dialogs — kept exactly as-is */}
            <AssignCourseDialog
                userId={userId}
                userName={selectedStudent?.full_name || 'Student'}
                open={assignOpen}
                onOpenChange={setAssignOpen}
                onSuccess={handleRefresh}
            />
            <DeassignCourseDialog
                userId={userId}
                userName={selectedStudent?.full_name || 'Student'}
                courses={allActiveCourses}
                open={deassignOpen}
                onOpenChange={setDeassignOpen}
                onSuccess={handleRefresh}
            />
        </div>
    );
};

// ── In Progress section (hero visual weight, ProfileMiniBar per row) ───────────

const InProgressSection = ({
    courseTermPlural,
    courses,
    page,
    totalPages,
    onPageChange,
    onCourseClick,
    getSessionName,
    onDeassign,
}: {
    courseTermPlural: string;
    courses: PackageDetailDTO[];
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onCourseClick: (course: PackageDetailDTO) => void;
    getSessionName: (course: PackageDetailDTO) => string | null;
    onDeassign: () => void;
}) => {
    const sessionTermSingular = getTerminology(ContentTerms.Session, SystemTerms.Session);

    return (
        <ProfileSectionCard icon={BookOpen} heading={`In Progress ${courseTermPlural}`}>
            {courses.length > 0 ? (
                <div className="flex flex-col gap-2">
                    {courses.map((course) => {
                        const sessionName = getSessionName(course);
                        const pct = Math.min(Math.max(course.percentage_completed ?? 0, 0), 100);
                        return (
                            <div
                                key={course.id + (course.package_session_id || '')}
                                className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 transition-shadow hover:border-primary-300 hover:shadow-sm"
                            >
                                {/* Top row: name + remove action */}
                                <div className="flex min-w-0 items-start justify-between gap-2">
                                    <button
                                        type="button"
                                        className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                                        onClick={() => onCourseClick(course)}
                                    >
                                        <p
                                            className="truncate text-sm font-semibold text-neutral-800"
                                            title={course.package_name || 'Unnamed Course'}
                                        >
                                            {course.package_name || 'Unnamed Course'}
                                        </p>
                                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                            {course.level_name && (
                                                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium capitalize text-neutral-600">
                                                    {course.level_name}
                                                </span>
                                            )}
                                            {sessionName && (
                                                <span className="text-xs text-neutral-500">
                                                    {sessionTermSingular}: {sessionName}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        aria-label="Remove from course"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeassign();
                                        }}
                                        className="shrink-0 rounded p-1 text-neutral-400 transition hover:bg-danger-50 hover:text-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-400"
                                    >
                                        <Trash className="size-3.5" weight="duotone" />
                                    </button>
                                </div>
                                {/* Progress mini-bar */}
                                <ProfileMiniBar value={pct} />
                            </div>
                        );
                    })}

                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-1">
                            <MyButton
                                buttonType="text"
                                scale="small"
                                onClick={() => onPageChange(page - 1)}
                                disable={page === 0}
                            >
                                <CaretLeft className="size-3.5" />
                                Prev
                            </MyButton>
                            <span className="text-xs text-neutral-500">
                                {page + 1} / {totalPages}
                            </span>
                            <MyButton
                                buttonType="text"
                                scale="small"
                                onClick={() => onPageChange(page + 1)}
                                disable={page >= totalPages - 1}
                            >
                                Next
                                <CaretRight className="size-3.5" />
                            </MyButton>
                        </div>
                    )}
                </div>
            ) : (
                <ProfileEmpty
                    icon={BookOpen}
                    title={`No ${courseTermPlural.toLowerCase()} in progress`}
                />
            )}
        </ProfileSectionCard>
    );
};

// ── Generic course section (Completed / Past — less visual weight) ─────────────

const CourseSection = ({
    title,
    icon,
    courses,
    emptyMessage,
    renderBadge,
    page,
    totalPages,
    onPageChange,
    onCourseClick,
    getSessionName,
}: {
    title: string;
    icon: PhosphorIcon;
    courses: PackageDetailDTO[];
    emptyMessage: string;
    renderBadge: (course: PackageDetailDTO) => React.ReactNode;
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onCourseClick?: (course: PackageDetailDTO) => void;
    getSessionName?: (course: PackageDetailDTO) => string | null;
}) => {
    const sessionTermSingular = getTerminology(ContentTerms.Session, SystemTerms.Session);

    return (
        <ProfileSectionCard icon={icon} heading={title}>
            {courses.length > 0 ? (
                <div className="flex flex-col gap-2">
                    {courses.map((course) => {
                        const sessionName = getSessionName?.(course);
                        return (
                            <button
                                key={course.id + (course.package_session_id || '')}
                                type="button"
                                className={cn(
                                    'flex w-full flex-col rounded-lg border border-neutral-200 bg-white p-3 text-left transition-shadow',
                                    onCourseClick && 'cursor-pointer hover:border-primary-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400'
                                )}
                                onClick={() => onCourseClick?.(course)}
                            >
                                <div className="flex min-w-0 items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p
                                            className="truncate text-sm font-semibold text-neutral-800"
                                            title={course.package_name || 'Unnamed Course'}
                                        >
                                            {course.package_name || 'Unnamed Course'}
                                        </p>
                                        {sessionName && (
                                            <p className="mt-0.5 truncate text-xs text-neutral-500">
                                                {sessionTermSingular}: {sessionName}
                                            </p>
                                        )}
                                    </div>
                                    {renderBadge(course)}
                                </div>
                            </button>
                        );
                    })}

                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-1">
                            <MyButton
                                buttonType="text"
                                scale="small"
                                onClick={() => onPageChange(page - 1)}
                                disable={page === 0}
                            >
                                <CaretLeft className="size-3.5" />
                                Prev
                            </MyButton>
                            <span className="text-xs text-neutral-500">
                                {page + 1} / {totalPages}
                            </span>
                            <MyButton
                                buttonType="text"
                                scale="small"
                                onClick={() => onPageChange(page + 1)}
                                disable={page >= totalPages - 1}
                            >
                                Next
                                <CaretRight className="size-3.5" />
                            </MyButton>
                        </div>
                    )}
                </div>
            ) : (
                <ProfileEmpty
                    icon={icon}
                    title={emptyMessage}
                />
            )}
        </ProfileSectionCard>
    );
};
