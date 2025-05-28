import { SubjectDefaultImage } from "@/assets/svgs";
import { CourseType } from "@/stores/study-library/use-study-library-store";
import { CourseMenuOptions } from "./course-menu-options";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { AddCourseData } from "../../../../components/common/study-library/add-course/add-course-form";
import { useEffect, useState } from "react";
import { getPublicUrl } from "@/services/upload_file";

export const CourseCard = ({
    course,
    onDelete,
    onEdit,
}: {
    course: CourseType;
    onDelete: (courseId: string) => void;
    onEdit: ({ courseId, requestData }: { requestData: AddCourseData; courseId?: string }) => void;
}) => {
    const router = useRouter();
    const currentPath = router.state.location.pathname;
    const navigate = useNavigate();
    const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);

    const handleCourseCardClick = (e: React.MouseEvent) => {
        if (
            e.target instanceof Element &&
            (e.target.closest(".menu-options-container") ||
                e.target.closest(".drag-handle-container") ||
                e.target.closest('[role="menu"]') ||
                e.target.closest('[role="dialog"]'))
        ) {
            return;
        }

        navigate({
            to: `${currentPath}/levels`,
            search: {
                courseId: course.id,
            },
        });
    };

    useEffect(() => {
        const fetchImageUrl = async () => {
            if (course?.thumbnail_file_id) {
                try {
                    const url = await getPublicUrl(course?.thumbnail_file_id);
                    setImageUrl(url);
                } catch (error) {
                    console.error("Failed to fetch image URL:", error);
                }
            }
        };

        fetchImageUrl();
    }, [course?.thumbnail_file_id]);

    return (
        <div
            className={`} relative flex h-[300px] cursor-pointer flex-col gap-4 rounded-xl border p-5 shadow-md`}
            onClick={handleCourseCardClick}
        >
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt={course.package_name}
                    className={`size-full h-[85%] rounded-lg object-cover`}
                />
            ) : (
                <SubjectDefaultImage className={`size-full h-[85%] rounded-lg object-cover`} />
            )}
            <div className="flex w-full justify-between gap-3">
                <div className="text-semibold w-full text-wrap text-center text-subtitle font-semibold text-neutral-600">
                    {course.package_name}
                </div>
                <CourseMenuOptions onDelete={onDelete} onEdit={onEdit} course={course} />
            </div>
        </div>
    );
};
