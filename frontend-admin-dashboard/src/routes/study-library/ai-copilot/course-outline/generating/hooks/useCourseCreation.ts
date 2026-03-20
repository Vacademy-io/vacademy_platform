import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { SessionProgress } from '../../../shared/types';
import { createCourseWithContent, setProgressCallback } from '../services/courseCreationService';
import { getUserRoles, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { submitForReview } from '@/routes/study-library/courses/-services/approval-services';

/**
 * Custom hook for handling course creation
 */
export const useCourseCreation = (courseMetadata: any, sessionsWithProgress: SessionProgress[]) => {
    const navigate = useNavigate();
    const [isCreatingCourse, setIsCreatingCourse] = useState(false);
    const [creationProgress, setCreationProgress] = useState<string>('');

    // Set progress callback for the service
    useEffect(() => {
        setProgressCallback(setCreationProgress);
    }, []);

    const handleCreateCourse = async (status?: 'ACTIVE' | 'DRAFT') => {
        if (!courseMetadata) {
            toast.error('Course metadata not found. Please regenerate the course outline.');
            return;
        }

        if (!sessionsWithProgress || sessionsWithProgress.length === 0) {
            toast.error('No sessions found. Please generate content first.');
            return;
        }

        setIsCreatingCourse(true);
        setCreationProgress('Initializing course creation...');

        try {
            // Extract course name - check multiple possible field names
            const courseName =
                courseMetadata.course_name ||
                courseMetadata.courseName ||
                courseMetadata.title ||
                'New Course';
            console.log('[Course Creation] Extracted course name:', courseName);

            setCreationProgress('Creating course...');
            // Extract metadata fields - using confirmed API structure with UI edit fallbacks
            const metadata = {
                aboutCourse:
                    courseMetadata.about_the_course_html || courseMetadata.aboutCourse || '',
                learningOutcome:
                    courseMetadata.why_learn_html || courseMetadata.learningOutcome || '',
                targetAudience:
                    courseMetadata.who_should_learn_html || courseMetadata.targetAudience || '',
                description:
                    courseMetadata.course_html_description || courseMetadata.description || '',

                // Images: The API returns both 'previewImageUrl' (direct S3 URL) and 'course_preview_image_media_id' (filename/ID)
                // We prefer the URL for display if available, but the ID is what we often need for backend references.
                // Our updated isValidFileId service now accepts URLs, so we can safely pass either.
                coursePreview:
                    courseMetadata.previewImageUrl ||
                    courseMetadata.course_preview_image_media_id ||
                    courseMetadata.coursePreview ||
                    '',
                courseBanner:
                    courseMetadata.bannerImageUrl ||
                    courseMetadata.course_banner_media_id ||
                    courseMetadata.courseBanner ||
                    '',

                courseMedia:
                    courseMetadata.mediaImageUrl ||
                    courseMetadata.courseMedia ||
                    (courseMetadata.course_media_id
                        ? typeof courseMetadata.course_media_id === 'string'
                            ? JSON.parse(courseMetadata.course_media_id)
                            : courseMetadata.course_media_id
                        : null),

                tags: courseMetadata.tags || [],
                levelStructure: courseMetadata.course_depth || courseMetadata.levelStructure || 2,
            };

            console.log('[Course Creation] Full courseMetadata object:', courseMetadata);
            console.log('[Course Creation] Course metadata being sent:', metadata);
            console.log('[Course Creation] Course name:', courseName);
            console.log('[Course Creation] Number of sessions:', sessionsWithProgress.length);
            console.log(
                '[Course Creation] Total slides:',
                sessionsWithProgress.reduce((sum, session) => sum + session.slides.length, 0)
            );

            // If user is a teacher and status is ACTIVE, we create as DRAFT first then submit
            const accessToken = getTokenFromCookie(TokenKey.accessToken);
            const roles = getUserRoles(accessToken);
            const isTeacher = roles.includes('TEACHER') && !roles.includes('ADMIN');

            const creationStatus = isTeacher && status === 'ACTIVE' ? 'DRAFT' : status;

            const result = await createCourseWithContent({
                courseName,
                sessions: sessionsWithProgress,
                courseMetadata: metadata,
                status: creationStatus,
                levelId: courseMetadata.level || undefined, // Pass the levelId from courseMetadata
            });

            setCreationProgress('Course created successfully!');
            toast.success('Course created successfully!');

            // Navigate to the course details page
            console.log('[Course Creation] Navigating to course:', result.courseId);

            if (isTeacher && status === 'ACTIVE') {
                setCreationProgress('Submitting for review...');
                try {
                    await submitForReview(result.courseId);
                    toast.success('Course submitted for review!');
                } catch (reviewError) {
                    console.error('Error submitting for review:', reviewError);
                    toast.error('Course created but failed to submit for review.');
                }
            }

            setTimeout(() => {
                navigate({
                    to: '/study-library/courses/course-details',
                    search: { courseId: result.courseId },
                });
            }, 1000);
        } catch (error) {
            console.error('Error creating course:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to create course';
            toast.error(errorMessage);
            setCreationProgress('');
        } finally {
            setIsCreatingCourse(false);
        }
    };

    return {
        handleCreateCourse,
        isCreatingCourse,
        creationProgress,
    };
};
