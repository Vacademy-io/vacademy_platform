import { useState } from 'react';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import {
    useLearnerPackagesQuery,
    type PackageDetailDTO,
} from '@/routes/manage-students/students-list/-services/getLearnerPackages';
import { getInstituteId } from '@/constants/helper';
import { MyButton } from '@/components/design-system/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, CaretDown, FunnelSimple, X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { AssignCourseDialog } from './assign-course-dialog';
import { DeassignCourseDialog } from './deassign-course-dialog';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_LEVELS_BY_INSTITUTE } from '@/constants/urls';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useNavigate } from '@tanstack/react-router';
import { getTerminology, getTerminologyPlural } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

const ITEMS_PER_PAGE = 20;

const isInactive = (course: PackageDetailDTO) =>
    course.enrollment_status === 'INACTIVE' || course.enrollment_status === 'TERMINATED';

/**
 * Shows a small status pill when the learner is NOT actively enrolled in this
 * course's batch — e.g. admin marked them INACTIVE but their plan is still active,
 * or the enrollment was terminated. Returns null for ACTIVE / INVITED / missing
 * statuses (those don't need a flag here).
 */
const EnrollmentStatusPill = ({
    status,
}: {
    status?: PackageDetailDTO['enrollment_status'];
}) => {
    if (!status || status === 'ACTIVE' || status === 'INVITED') return null;
    const label = status === 'TERMINATED' ? 'Enrollment Terminated' : 'Course Inactive';
    return (
        <span className="rounded-full bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-700 ring-1 ring-danger-200">
            {label}
        </span>
    );
};

const formatDate = (iso?: string | null): string | null => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

// Static tone classes (don't construct Tailwind class names dynamically — JIT
// only picks up complete literal strings).
const DAYS_TONE = {
    success: { text: 'text-success-700', bar: 'bg-success-500' },
    warning: { text: 'text-warning-700', bar: 'bg-warning-500' },
    danger: { text: 'text-danger-700', bar: 'bg-danger-500' },
} as const;

/**
 * Days-access indicator — shows how many days of access remain out of the
 * original validity window, with a tiny progress bar. Renders nothing if the
 * row has no expiry_date.
 */
const DaysAccessBar = ({ course }: { course: PackageDetailDTO }) => {
    if (!course.expiry_date) return null;
    const now = Date.now();
    const expiry = new Date(course.expiry_date).getTime();
    if (Number.isNaN(expiry)) return null;
    const enrolled = course.enrolled_date ? new Date(course.enrolled_date).getTime() : null;
    const daysRemaining = Math.max(0, Math.floor((expiry - now) / (1000 * 60 * 60 * 24)));
    const totalDays =
        enrolled && expiry > enrolled
            ? Math.max(1, Math.floor((expiry - enrolled) / (1000 * 60 * 60 * 24)))
            : Math.max(daysRemaining, 1);
    const percent = Math.min(100, Math.max(0, (daysRemaining / totalDays) * 100));
    const tone =
        daysRemaining >= 180 ? 'success' : daysRemaining >= 30 ? 'warning' : 'danger';
    const c = DAYS_TONE[tone];
    return (
        <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-neutral-500">Access remaining</span>
                <span className={`font-semibold ${c.text}`}>{daysRemaining} days</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                    className={`h-full ${c.bar} transition-all duration-500`}
                    // Width is data-driven and inherently dynamic.
                    style={{ width: `${percent}%` }}
                />
            </div>
        </div>
    );
};

const InactiveSinceLine = ({ course }: { course: PackageDetailDTO }) => {
    const when = formatDate(course.enrollment_status_updated_at);
    if (!when) return null;
    return (
        <p className="mt-2 text-xs text-danger-700">Marked inactive on {when}</p>
    );
};

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
    const [levelMenuOpen, setLevelMenuOpen] = useState(false);
    const [progressPage, setProgressPage] = useState(0);
    const [completedPage, setCompletedPage] = useState(0);
    const [pastPage, setPastPage] = useState(0);

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
        return <p>Student details unavailable</p>;
    }

    if (isLoadingProgress || isLoadingCompleted || isLoadingPast) {
        return <DashboardLoader />;
    }

    const allActiveCourses: PackageDetailDTO[] = [
        ...(progressCourses?.content || []),
        ...(completedCourses?.content || []),
    ];

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

    return (
        <div className="flex flex-col gap-6">
            {/* Action buttons */}
            <div className="flex items-center gap-3">
                <MyButton
                    buttonType="primary"
                    scale="small"
                    onClick={() => setAssignOpen(true)}
                >
                    + Assign to {getTerminology(ContentTerms.Course, SystemTerms.Course)}
                </MyButton>
                <MyButton
                    buttonType="secondary"
                    scale="small"
                    onClick={() => setDeassignOpen(true)}
                    disable={allActiveCourses.length === 0}
                >
                    Remove from {getTerminology(ContentTerms.Course, SystemTerms.Course)}
                </MyButton>
            </div>

            {/* Level Filter — Popover with inline (non-portal) content so clicks inside
                the menu stay within the side-panel sheet's DOM and don't trigger its
                click-outside dismissal. */}
            {availableLevels.length > 0 && (() => {
                const selectedLevel = availableLevels.find((l) => l.id === selectedLevelId);
                const triggerLabel = selectedLevel?.level_name ?? 'All levels';
                return (
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-600">Filter:</span>
                        <Popover open={levelMenuOpen} onOpenChange={setLevelMenuOpen}>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    className={cn(
                                        'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors focus:outline-none',
                                        selectedLevelId
                                            ? 'border-primary-300 bg-primary-50 text-primary-700 hover:border-primary-400'
                                            : 'border-neutral-300 bg-white text-neutral-600 hover:border-primary-200'
                                    )}
                                >
                                    <FunnelSimple className="size-3.5" />
                                    <span className="capitalize">{triggerLabel}</span>
                                    <CaretDown className="size-3.5" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent
                                portal={false}
                                align="start"
                                className="w-56 p-1"
                            >
                                <div className="max-h-72 overflow-y-auto">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleLevelFilter(null);
                                            setLevelMenuOpen(false);
                                        }}
                                        className={cn(
                                            'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs font-medium hover:bg-primary-50',
                                            selectedLevelId === null
                                                ? 'bg-primary-50 text-primary-700'
                                                : 'text-neutral-700'
                                        )}
                                    >
                                        All levels
                                        {selectedLevelId === null && (
                                            <Check className="size-3.5 text-primary-600" />
                                        )}
                                    </button>
                                    {availableLevels.map((level) => (
                                        <button
                                            key={level.id}
                                            type="button"
                                            onClick={() => {
                                                handleLevelFilter(level.id);
                                                setLevelMenuOpen(false);
                                            }}
                                            className={cn(
                                                'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs font-medium capitalize hover:bg-primary-50',
                                                selectedLevelId === level.id
                                                    ? 'bg-primary-50 text-primary-700'
                                                    : 'text-neutral-700'
                                            )}
                                        >
                                            {level.level_name}
                                            {selectedLevelId === level.id && (
                                                <Check className="size-3.5 text-primary-600" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                        {selectedLevelId && (
                            <button
                                type="button"
                                onClick={() => handleLevelFilter(null)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-700"
                                aria-label="Clear level filter"
                            >
                                <X className="size-3.5" />
                                Clear
                            </button>
                        )}
                    </div>
                );
            })()}

            {/* Split the in-progress page client-side: ACTIVE rows render in their
                normal section; INACTIVE/TERMINATED rows are collected into a
                dedicated "Inactive Courses" section below. Pagination still applies
                to the underlying page; for typical learners (1-2 inactive courses
                in the whole institute) this is fine. */}
            {(() => {
                const progressContent = progressCourses?.content || [];
                const activeProgress = progressContent.filter((c) => !isInactive(c));
                const inactiveCourses = progressContent.filter(isInactive);
                const courseTerm = getTerminologyPlural(ContentTerms.Course, SystemTerms.Course);
                const getSessionNameFn = (course: PackageDetailDTO) => {
                    if (!course.package_session_id) return null;
                    const details = getDetailsFromPackageSessionId({
                        packageSessionId: course.package_session_id,
                    });
                    return details?.session.session_name || null;
                };
                return (
                    <>
                        {/* In Progress Courses */}
                        <CourseSection
                            title={`In Progress ${courseTerm}`}
                            courses={activeProgress}
                            emptyMessage={`No ${courseTerm.toLowerCase()} in progress`}
                            onCourseClick={handleCourseClick}
                            getSessionName={getSessionNameFn}
                            renderBadge={(course) => (
                                <div className="flex items-center gap-2">
                                    {course.level_name && (
                                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium capitalize text-neutral-600">
                                            {course.level_name}
                                        </span>
                                    )}
                                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                                        {Number(Math.min(Math.max(course.percentage_completed ?? 0, 0), 100).toFixed(2))}% Completed
                                    </span>
                                </div>
                            )}
                            renderExtra={(course) => (
                                <>
                                    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                                        <div
                                            className="h-2 rounded-full bg-blue-500 transition-all duration-500"
                                            style={{
                                                width: `${Math.min(Math.max(course.percentage_completed ?? 0, 0), 100)}%`,
                                            }}
                                        />
                                    </div>
                                    <DaysAccessBar course={course} />
                                </>
                            )}
                            page={progressPage}
                            totalPages={progressCourses?.totalPages || 0}
                            onPageChange={setProgressPage}
                        />

                        {/* Completed Courses */}
                        <CourseSection
                            title={`Completed ${courseTerm}`}
                            courses={completedCourses?.content || []}
                            emptyMessage={`No completed ${courseTerm.toLowerCase()}`}
                            onCourseClick={handleCourseClick}
                            getSessionName={getSessionNameFn}
                            renderBadge={(course) => (
                                <div className="flex items-center gap-2">
                                    {course.level_name && (
                                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium capitalize text-neutral-600">
                                            {course.level_name}
                                        </span>
                                    )}
                                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                                        Completed
                                    </span>
                                </div>
                            )}
                            renderExtra={(course) => <DaysAccessBar course={course} />}
                            page={completedPage}
                            totalPages={completedCourses?.totalPages || 0}
                            onPageChange={setCompletedPage}
                        />

                        {/* Past Courses */}
                        <CourseSection
                            title={`Past ${courseTerm}`}
                            courses={pastCourses?.content || []}
                            emptyMessage={`No past ${courseTerm.toLowerCase()}`}
                            onCourseClick={handleCourseClick}
                            getSessionName={getSessionNameFn}
                            renderBadge={(course) => (
                                <div className="flex items-center gap-2">
                                    {course.level_name && (
                                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium capitalize text-neutral-600">
                                            {course.level_name}
                                        </span>
                                    )}
                                </div>
                            )}
                            renderExtra={(course) => <DaysAccessBar course={course} />}
                            page={pastPage}
                            totalPages={pastCourses?.totalPages || 0}
                            onPageChange={setPastPage}
                        />

                        {/* Inactive Courses — surfaces enrollments where the admin has
                            deactivated this learner from a course they still have plan/
                            access to. Pulled client-side from the PROGRESS response. */}
                        <CourseSection
                            title={`Inactive ${courseTerm}`}
                            courses={inactiveCourses}
                            emptyMessage={`No inactive ${courseTerm.toLowerCase()}`}
                            onCourseClick={handleCourseClick}
                            getSessionName={getSessionNameFn}
                            renderBadge={(course) => (
                                <div className="flex items-center gap-2">
                                    {course.level_name && (
                                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium capitalize text-neutral-600">
                                            {course.level_name}
                                        </span>
                                    )}
                                    <EnrollmentStatusPill status={course.enrollment_status} />
                                </div>
                            )}
                            renderExtra={(course) => (
                                <>
                                    <InactiveSinceLine course={course} />
                                    <DaysAccessBar course={course} />
                                </>
                            )}
                            page={0}
                            totalPages={0}
                            onPageChange={() => {}}
                        />
                    </>
                );
            })()}

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

const CourseSection = ({
    title,
    courses,
    emptyMessage,
    renderBadge,
    renderExtra,
    page,
    totalPages,
    onPageChange,
    onCourseClick,
    getSessionName,
}: {
    title: string;
    courses: PackageDetailDTO[];
    emptyMessage: string;
    renderBadge: (course: PackageDetailDTO) => React.ReactNode;
    renderExtra?: (course: PackageDetailDTO) => React.ReactNode;
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onCourseClick?: (course: PackageDetailDTO) => void;
    getSessionName?: (course: PackageDetailDTO) => string | null;
}) => {
    return (
        <div className="flex flex-col gap-4">
            <h3 className="border-b border-neutral-200 pb-2 text-lg font-semibold text-neutral-800">
                {title}
            </h3>
            <div className="flex flex-col gap-4">
                {courses.length > 0 ? (
                    <>
                        {courses.map((course) => {
                            const sessionName = getSessionName?.(course);
                            return (
                            <div
                                key={course.id + (course.package_session_id || '')}
                                className={`flex flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${onCourseClick ? 'cursor-pointer hover:border-primary-300' : ''}`}
                                onClick={() => onCourseClick?.(course)}
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h4 className="font-semibold text-neutral-900">
                                            {course.package_name || 'Unnamed Course'}
                                        </h4>
                                        {sessionName && (
                                            <p className="mt-0.5 text-xs text-neutral-500">
                                                {getTerminology(ContentTerms.Session, SystemTerms.Session)}: {sessionName}
                                            </p>
                                        )}
                                    </div>
                                    {renderBadge(course)}
                                </div>
                                {renderExtra?.(course)}
                            </div>
                            );
                        })}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 pt-2">
                                <button
                                    onClick={() => onPageChange(page - 1)}
                                    disabled={page === 0}
                                    className="rounded px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent"
                                >
                                    Previous
                                </button>
                                <span className="text-sm text-neutral-500">
                                    Page {page + 1} of {totalPages}
                                </span>
                                <button
                                    onClick={() => onPageChange(page + 1)}
                                    disabled={page >= totalPages - 1}
                                    className="rounded px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="rounded-lg bg-neutral-50 py-6 text-center text-neutral-500">
                        {emptyMessage}
                    </div>
                )}
            </div>
        </div>
    );
};
