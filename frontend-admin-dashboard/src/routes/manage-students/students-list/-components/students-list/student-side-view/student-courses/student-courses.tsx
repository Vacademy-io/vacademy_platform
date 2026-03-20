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
import { useQueryClient } from '@tanstack/react-query';

export const StudentCourses = ({ isSubmissionTab }: { isSubmissionTab?: boolean }) => {
    const { selectedStudent } = useStudentSidebar();
    const instituteId = getInstituteId();
    const userId = isSubmissionTab ? selectedStudent?.id || '' : selectedStudent?.user_id || '';
    const queryClient = useQueryClient();

    const [assignOpen, setAssignOpen] = useState(false);
    const [deassignOpen, setDeassignOpen] = useState(false);

    const {
        data: progressCourses,
        isLoading: isLoadingProgress,
    } = useLearnerPackagesQuery({
        instituteId: instituteId || '',
        userId,
        type: 'PROGRESS',
    });

    const {
        data: completedCourses,
        isLoading: isLoadingCompleted,
    } = useLearnerPackagesQuery({
        instituteId: instituteId || '',
        userId,
        type: 'COMPLETED',
    });

    if (!selectedStudent || !instituteId) {
        return <p>Student details unavailable</p>;
    }

    if (isLoadingProgress || isLoadingCompleted) {
        return <DashboardLoader />;
    }

    const allCourses: PackageDetailDTO[] = [
        ...(progressCourses?.content || []),
        ...(completedCourses?.content || []),
    ];

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['GET_LEARNER_PACKAGES'] });
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
                    disable={allCourses.length === 0}
                >
                    Remove from Course
                </MyButton>
            </div>

            {/* In Progress Courses */}
            <div className="flex flex-col gap-4">
                <h3 className="border-b border-neutral-200 pb-2 text-lg font-semibold text-neutral-800">
                    In Progress Courses
                </h3>
                <div className="flex flex-col gap-4">
                    {progressCourses?.content && progressCourses.content.length > 0 ? (
                        progressCourses.content.map((course) => (
                            <div
                                key={course.id}
                                className="flex flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h4 className="font-semibold text-neutral-900">
                                            {course.package_name || 'Unnamed Course'}
                                        </h4>
                                        <p className="mt-1 text-sm text-neutral-500">
                                            {course.level_name}
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                                        {((course.percentage_completed ?? 0) * 100).toFixed(0)}%
                                        Completed
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                                    <div
                                        className="h-2 rounded-full bg-blue-500 transition-all duration-500"
                                        style={{
                                            width: `${Math.min((course.percentage_completed ?? 0) * 100, 100)}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="rounded-lg bg-neutral-50 py-6 text-center text-neutral-500">
                            No courses in progress
                        </div>
                    )}
                </div>
            </div>

            {/* Completed Courses */}
            <div className="flex flex-col gap-4">
                <h3 className="border-b border-neutral-200 pb-2 text-lg font-semibold text-neutral-800">
                    Completed Courses
                </h3>
                <div className="flex flex-col gap-4">
                    {completedCourses?.content && completedCourses.content.length > 0 ? (
                        completedCourses.content.map((course) => (
                            <div
                                key={course.id}
                                className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                            >
                                <div>
                                    <h4 className="font-semibold text-neutral-900">
                                        {course.package_name || 'Unnamed Course'}
                                    </h4>
                                    <p className="mt-1 text-sm text-neutral-500">
                                        {course.level_name}
                                    </p>
                                </div>
                                <div className="flex items-center justify-center rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                                    Completed
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="rounded-lg bg-neutral-50 py-6 text-center text-neutral-500">
                            No completed courses
                        </div>
                    )}
                </div>
            </div>

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
                courses={allCourses}
                open={deassignOpen}
                onOpenChange={setDeassignOpen}
                onSuccess={handleRefresh}
            />
        </div>
    );
};
