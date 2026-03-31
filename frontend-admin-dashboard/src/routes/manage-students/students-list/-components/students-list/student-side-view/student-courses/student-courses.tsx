import { useState } from 'react';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import {
    useLearnerPackagesQuery,
    type PackageDetailDTO,
} from '@/routes/manage-students/students-list/-services/getLearnerPackages';
import { getInstituteId } from '@/constants/helper';
import { MyButton } from '@/components/design-system/button';
import { AssignCourseDialog } from './assign-course-dialog';
import { DeassignCourseDialog } from './deassign-course-dialog';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_LEVELS_BY_INSTITUTE } from '@/constants/urls';

const ITEMS_PER_PAGE = 20;

export const StudentCourses = ({ isSubmissionTab, packageSessionId }: { isSubmissionTab?: boolean; packageSessionId?: string }) => {
    const { selectedStudent } = useStudentSidebar();
    const instituteId = getInstituteId();
    const userId = isSubmissionTab ? selectedStudent?.id || '' : selectedStudent?.user_id || '';
    const queryClient = useQueryClient();

    const [assignOpen, setAssignOpen] = useState(false);
    const [deassignOpen, setDeassignOpen] = useState(false);
    const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
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
                    + Assign to Course
                </MyButton>
                <MyButton
                    buttonType="secondary"
                    scale="small"
                    onClick={() => setDeassignOpen(true)}
                    disable={allActiveCourses.length === 0}
                >
                    Remove from Course
                </MyButton>
            </div>

            {/* Level Filter */}
            {availableLevels.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-neutral-600">Filter:</span>
                    <button
                        onClick={() => handleLevelFilter(null)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                            selectedLevelId === null
                                ? 'bg-primary-500 text-white'
                                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                        }`}
                    >
                        All
                    </button>
                    {availableLevels.map((level) => (
                        <button
                            key={level.id}
                            onClick={() => handleLevelFilter(level.id)}
                            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                                selectedLevelId === level.id
                                    ? 'bg-primary-500 text-white'
                                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                            }`}
                        >
                            {level.level_name}
                        </button>
                    ))}
                </div>
            )}

            {/* In Progress Courses */}
            <CourseSection
                title="In Progress Courses"
                courses={progressCourses?.content || []}
                emptyMessage="No courses in progress"
                renderBadge={(course) => (
                    <div className="flex items-center gap-2">
                        {course.level_name && (
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium capitalize text-neutral-600">
                                {course.level_name}
                            </span>
                        )}
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                            {((course.percentage_completed ?? 0) * 100).toFixed(0)}% Completed
                        </span>
                    </div>
                )}
                renderExtra={(course) => (
                    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                        <div
                            className="h-2 rounded-full bg-blue-500 transition-all duration-500"
                            style={{
                                width: `${Math.min((course.percentage_completed ?? 0) * 100, 100)}%`,
                            }}
                        />
                    </div>
                )}
                page={progressPage}
                totalPages={progressCourses?.totalPages || 0}
                onPageChange={setProgressPage}
            />

            {/* Completed Courses */}
            <CourseSection
                title="Completed Courses"
                courses={completedCourses?.content || []}
                emptyMessage="No completed courses"
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
                page={completedPage}
                totalPages={completedCourses?.totalPages || 0}
                onPageChange={setCompletedPage}
            />

            {/* Past Courses */}
            <CourseSection
                title="Past Courses"
                courses={pastCourses?.content || []}
                emptyMessage="No past courses"
                renderBadge={(course) => (
                    <div className="flex items-center gap-2">
                        {course.level_name && (
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium capitalize text-neutral-600">
                                {course.level_name}
                            </span>
                        )}
                    </div>
                )}
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

const CourseSection = ({
    title,
    courses,
    emptyMessage,
    renderBadge,
    renderExtra,
    page,
    totalPages,
    onPageChange,
}: {
    title: string;
    courses: PackageDetailDTO[];
    emptyMessage: string;
    renderBadge: (course: PackageDetailDTO) => React.ReactNode;
    renderExtra?: (course: PackageDetailDTO) => React.ReactNode;
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}) => {
    return (
        <div className="flex flex-col gap-4">
            <h3 className="border-b border-neutral-200 pb-2 text-lg font-semibold text-neutral-800">
                {title}
            </h3>
            <div className="flex flex-col gap-4">
                {courses.length > 0 ? (
                    <>
                        {courses.map((course) => (
                            <div
                                key={course.id + (course.package_session_id || '')}
                                className="flex flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h4 className="font-semibold text-neutral-900">
                                            {course.package_name || 'Unnamed Course'}
                                        </h4>
                                    </div>
                                    {renderBadge(course)}
                                </div>
                                {renderExtra?.(course)}
                            </div>
                        ))}
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
