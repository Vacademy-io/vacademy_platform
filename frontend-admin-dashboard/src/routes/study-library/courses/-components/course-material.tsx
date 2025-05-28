import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect, useState } from 'react';
import { UploadStudyMaterialButton } from './upload-study-material/upload-study-material-button';
import { CreateStudyDocButton } from './upload-study-material/create-study-doc-button';
import { useSidebar } from '@/components/ui/sidebar';
import { getCourses } from '@/utils/helpers/study-library-helpers.ts/get-list-from-stores/getCourses';
import { CourseCard } from './course-card';
import { AddCourseButton } from '@/components/common/study-library/add-course/add-course-button';
import { useAddCourse } from '@/services/study-library/course-operations/add-course';
import { AddCourseData } from '../../../../components/common/study-library/add-course/add-course-form';
import { useDeleteCourse } from '@/services/study-library/course-operations/delete-course';
import { useUpdateCourse } from '@/services/study-library/course-operations/update-course';
import { useStudyLibraryStore } from '@/stores/study-library/use-study-library-store';
import { toast } from 'sonner'; // Import Toaster from sonner
import useIntroJsTour from '@/hooks/use-intro';
import { StudyLibraryIntroKey } from '@/constants/storage/introKey';
import { studyLibrarySteps } from '@/constants/intro/steps';
import { EmptyCoursePage } from '@/svgs';

export const CourseMaterial = () => {
    const { setNavHeading } = useNavHeadingStore();
    const { open } = useSidebar();
    const { studyLibraryData } = useStudyLibraryStore();
    const [courses, setCourses] = useState(getCourses());

    const addCourseMutation = useAddCourse();
    const deleteCourseMutation = useDeleteCourse();
    const updateCourseMutation = useUpdateCourse();

    useIntroJsTour({
        key: StudyLibraryIntroKey.createCourseStep,
        steps: studyLibrarySteps.createCourseStep,
        partial: true,
    });

    const handleAddCourse = ({ requestData }: { requestData: AddCourseData }) => {
        addCourseMutation.mutate(
            { requestData: requestData },
            {
                onSuccess: () => {
                    toast.success('Course added successfully');
                },
                onError: (error) => {
                    toast.error(error.message || 'Failed to add course');
                },
            }
        );
    };

    const handleCourseDelete = (courseId: string) => {
        deleteCourseMutation.mutate(courseId, {
            onSuccess: () => {
                toast.success('Course deleted successfully');
            },
            onError: (error) => {
                toast.error(error.message || 'Failed to delete course');
            },
        });
    };

    const handleCourseUpdate = ({
        courseId,
        requestData,
    }: {
        requestData: AddCourseData;
        courseId?: string;
    }) => {
        updateCourseMutation.mutate(
            { courseId, requestData },
            {
                onSuccess: () => {
                    toast.success('Course updated successfully');
                },
                onError: (error) => {
                    toast.error(error.message || 'Failed to update course');
                },
            }
        );
    };

    useEffect(() => {
        setCourses(getCourses());
    }, [studyLibraryData]);

    useEffect(() => {
        setNavHeading('Learning Center');
    }, []);

    return (
        <div className="relative flex w-full flex-col gap-8 text-neutral-600">
            <div className="flex items-center gap-8">
                <div className="flex flex-col gap-2">
                    <div className="text-h3 font-semibold">Organize Your Courses</div>
                    <div className="text-subtitle">
                        Effortlessly organize, upload, and track educational resources in one place.
                        Provide students with easy access to the materials they need to succeed,
                        ensuring a seamless learning experience.
                    </div>
                </div>
                <div className="flex flex-col items-center gap-4">
                    <CreateStudyDocButton />
                    <UploadStudyMaterialButton />
                    <AddCourseButton onSubmit={handleAddCourse} />
                </div>
            </div>

            <div
                className={`grid ${
                    open ? 'grid-cols-3 gap-4' : 'grid-cols-4 gap-8'
                } w-full items-center justify-between gap-y-8`}
            >
                {courses.map((course, key) => (
                    <div key={key}>
                        <CourseCard
                            course={course}
                            onDelete={handleCourseDelete}
                            onEdit={handleCourseUpdate}
                        />
                    </div>
                ))}
            </div>
            <div>
                {courses.length === 0 && (
                    <div className="flex flex-1 flex-col items-center justify-center py-10">
                        <EmptyCoursePage />
                    </div>
                )}
            </div>
        </div>
    );
};
