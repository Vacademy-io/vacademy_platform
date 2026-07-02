import { useState } from 'react';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import {
    useLearnerPackagesQuery,
    type PackageDetailDTO,
} from '@/routes/manage-students/students-list/-services/getLearnerPackages';
import { getInstituteId } from '@/constants/helper';
import { MyButton } from '@/components/design-system/button';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
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
    type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import {
    ProfileSectionCard,
    ProfileSkeleton,
    ProfileEmpty,
    ProfileHeroStat,
    ProfileMiniBar,
} from '../profile-ui';
import { EnrollmentWorkflowStatus } from '@/components/shared/workflow/enrollment-workflow-status';

const ITEMS_PER_PAGE = 20;

export const StudentCourses = ({ isSubmissionTab, packageSessionId }: { isSubmissionTab?: boolean; packageSessionId?: string }) => {
    const { selectedStudent } = useStudentSidebar();
    const instituteId = getInstituteId();
    const userId = isSubmissionTab ? selectedStudent?.id || '' : selectedStudent?.user_id || '';
    const { getDetailsFromPackageSessionId } = useInstituteDetailsStore();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [assignOpen, setAssignOpen] = useState(false);
    const [deassignOpen, setDeassignOpen] = useState(false);
    const [selectedLevelIds, setSelectedLevelIds] = useState<string[]>([]);
    const [levelMenuOpen, setLevelMenuOpen] = useState(false);
    const [progressPage, setProgressPage] = useState(0);
    const [completedPage, setCompletedPage] = useState(0);
    const [pastPage, setPastPage] = useState(0);

    const levelIds = selectedLevelIds;
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

    // Package sessions this learner is enrolled into — used to surface the
    // enrollment workflow run(s) (tick/cross per step) attached to them.
    const learnerPackageSessionIds = Array.from(
        new Set(
            [
                ...(progressCourses?.content || []),
                ...(completedCourses?.content || []),
                ...(pastCourses?.content || []),
            ]
                .map((course) => course.package_session_id)
                .filter((id): id is string => !!id)
        )
    );

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

        // Land on the full Course Details page (layout sidebar + course
        // header / tabs), the same experience users get when opening a course
        // from the study-library list — not the stripped `/subjects`
        // deep-link.
        navigate({
            to: '/study-library/courses/course-details',
            search: { courseId, levelId, sessionId },
        });
    };

    // Reset all three section pages whenever the level filter changes — the
    // result sets shift, so stale page indices would point past the new data.
    const resetPages = () => {
        setProgressPage(0);
        setCompletedPage(0);
        setPastPage(0);
    };
    // Multi-select: toggle a level in/out of the filter set.
    const toggleLevel = (levelId: string) => {
        setSelectedLevelIds((prev) =>
            prev.includes(levelId) ? prev.filter((id) => id !== levelId) : [...prev, levelId]
        );
        resetPages();
    };
    // "All" clears the filter set (empty = no level filter applied).
    const clearLevels = () => {
        setSelectedLevelIds([]);
        resetPages();
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

    return (
        <div className="flex flex-col gap-3">
            {/* Enrollment workflow run(s) for this learner's enrolments — renders
                nothing when no workflow is attached. */}
            <EnrollmentWorkflowStatus
                instituteId={instituteId}
                packageSessionIds={learnerPackageSessionIds}
            />
            {/* Hero stat grid — passive counters per handoff CoursesSection.
                Click-to-filter has been dropped: the 3 sections below always
                render, so these tiles are purely orientation/status read-outs. */}
            <div className="grid grid-cols-3 gap-2">
                <ProfileHeroStat
                    label="In Progress"
                    value={progressCount}
                    tone="primary"
                    icon={BookOpen}
                />
                <ProfileHeroStat
                    label="Completed"
                    value={completedCount}
                    tone="success"
                    icon={CheckCircle}
                />
                <ProfileHeroStat
                    label="Past"
                    value={pastCount}
                    tone="neutral"
                    icon={ClockCounterClockwise}
                />
            </div>

            {/* Combined action + filter row per handoff — Assign / Remove
                buttons sit alongside the level filter chips so the controls
                are one mental group, not two stacked bars. */}
            <div className="flex flex-wrap items-center gap-2">
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
                {availableLevels.length > 0 && (
                    // Collapsed by default into a Filter button; the level list
                    // opens in a dropdown so a long list of levels no longer eats
                    // vertical space in the panel.
                    // - modal={false}: a modal dropdown re-dispatches the click as
                    //   it tears down, which was closing the side-view panel. Non-modal
                    //   avoids the body pointer-lock + that stray click.
                    // - onSelect preventDefault on each item keeps the menu open so
                    //   multiple levels can be toggled in one go.
                    <DropdownMenu
                        open={levelMenuOpen}
                        onOpenChange={setLevelMenuOpen}
                        modal={false}
                    >
                        <DropdownMenuTrigger asChild>
                            <MyButton buttonType="secondary" scale="small" className="ml-auto">
                                <Funnel className="size-3.5" />
                                {selectedLevelIds.length > 0
                                    ? `Filter (${selectedLevelIds.length})`
                                    : 'Filter'}
                            </MyButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="end"
                            className="max-h-72 w-56 overflow-y-auto"
                        >
                            <DropdownMenuCheckboxItem
                                checked={selectedLevelIds.length === 0}
                                onCheckedChange={() => clearLevels()}
                                onSelect={(e) => e.preventDefault()}
                            >
                                All
                            </DropdownMenuCheckboxItem>
                            {availableLevels.map((level) => (
                                <DropdownMenuCheckboxItem
                                    key={level.id}
                                    checked={selectedLevelIds.includes(level.id)}
                                    onCheckedChange={() => toggleLevel(level.id)}
                                    onSelect={(e) => e.preventDefault()}
                                >
                                    {level.level_name}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>

            {/* All three sections render unconditionally per handoff —
                counsellors see the full enrolment story without toggling. */}
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
            />

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

            {/* Dialogs */}
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
}: {
    courseTermPlural: string;
    courses: PackageDetailDTO[];
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onCourseClick: (course: PackageDetailDTO) => void;
    getSessionName: (course: PackageDetailDTO) => string | null;
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
                            <button
                                type="button"
                                key={course.id + (course.package_session_id || '')}
                                onClick={() => onCourseClick(course)}
                                className="flex w-full flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 text-left transition-shadow hover:border-primary-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                            >
                                {/* Single-line summary per handoff: name (flex-1)
                                    + level badge + percentage chip. Per-row
                                    Trash removed — Remove from {course} lives
                                    in the top action bar. */}
                                <div className="flex min-w-0 items-center gap-2">
                                    <p
                                        className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-800"
                                        title={course.package_name || 'Unnamed Course'}
                                    >
                                        {course.package_name || 'Unnamed Course'}
                                    </p>
                                    {course.level_name && (
                                        <span className="shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium capitalize text-primary-700">
                                            {course.level_name}
                                        </span>
                                    )}
                                    <span className="shrink-0 tabular-nums text-sm font-semibold text-card-foreground">
                                        {pct}%
                                    </span>
                                </div>
                                {sessionName && (
                                    <span className="text-xs text-neutral-500">
                                        {sessionTermSingular}: {sessionName}
                                    </span>
                                )}
                                {/* Progress mini-bar */}
                                <ProfileMiniBar value={pct} />
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
