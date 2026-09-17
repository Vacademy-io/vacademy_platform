import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { SessionProgress } from '../../../shared/types';
import { createCourseWithContent, setProgressCallback } from '../services/courseCreationService';
import { getUserRoles, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { submitForReview } from '@/routes/study-library/courses/-services/approval-services';
import { savePackageSettingKey } from '@/services/package-settings';
import {
    TUTOR_MODE_SETTING_KEY,
    compileTutorPlans,
    getInstituteTutorDefaults,
    newCompileRunId,
    type TutorModeSetting,
} from '@/services/tutor';

/**
 * Live AI Tutor: after the copilot persists a course, mark it tutor-enabled and
 * compile every teachable slide.
 *
 * The prompt page's choices survive in their OWN sessionStorage keys
 * (`coursePersonalizedTeaching`, `courseLanguage`, `courseKbGrounding`): the
 * generating page deletes `courseConfig` as soon as the outline loads, long
 * before the course is created. The institute's Tutor Mode defaults decide
 * whether images are generated and whether tutor mode is available at all.
 * Never throws; failures are shown, not swallowed.
 */
async function startTutorPreparation(courseId: string, t: TFunction): Promise<void> {
    try {
        if (sessionStorage.getItem('coursePersonalizedTeaching') === '0') return;
        const institute: TutorModeSetting | null = await getInstituteTutorDefaults().catch(
            () => null
        );
        if (institute?.enabled === false) return; // tutor mode switched off for the institute
        const language = (sessionStorage.getItem('courseLanguage') || 'English')
            .toLowerCase()
            .startsWith('hi')
            ? 'hi'
            : 'en';
        let kb: { knowledge_base_id?: string; mode?: 'STRICT' | 'BLENDED' } | null = null;
        try {
            kb = JSON.parse(sessionStorage.getItem('courseKbGrounding') || 'null');
        } catch {
            kb = null;
        }
        const kbGrounding = kb?.knowledge_base_id
            ? { knowledge_base_id: kb.knowledge_base_id, mode: kb.mode ?? 'STRICT' }
            : null;
        const generateImages = institute?.generateImages !== false;
        await savePackageSettingKey(
            courseId,
            TUTOR_MODE_SETTING_KEY,
            {
                enabled: true,
                defaultOn: institute?.defaultOn !== false,
                generateImages,
                languages: [language, language === 'en' ? 'hi' : 'en'],
                kbGrounding,
            },
            'Tutor Mode'
        );
        toast.info(t('tutorPreparing'));
        let ready = 0;
        let failed = 0;
        await compileTutorPlans(
            courseId,
            {
                language,
                generate_images: generateImages,
                compile_run_id: newCompileRunId(),
                ...(kbGrounding ? { kb_grounding: kbGrounding } : {}),
            },
            (ev) => {
                if (ev.type === 'PLAN_READY' || ev.type === 'PLAN_UP_TO_DATE') ready += 1;
                if (ev.type === 'PLAN_ERROR') failed += 1;
            }
        );
        if (failed === 0) toast.success(t('tutorReady', { count: ready }));
        else toast.warning(t('tutorPartial', { ready, failed }));
    } catch (error) {
        console.warn('[Course Creation] Tutor preparation failed:', error);
        const msg = error instanceof Error ? error.message : t('unknownError');
        toast.error(t('tutorPrepFailed', { msg }));
    }
}

/**
 * Custom hook for handling course creation
 */
export const useCourseCreation = (courseMetadata: any, sessionsWithProgress: SessionProgress[]) => {
    const navigate = useNavigate();
    const { t } = useTranslation('studyLibraryUseCourseCreation');
    const [isCreatingCourse, setIsCreatingCourse] = useState(false);
    const [creationProgress, setCreationProgress] = useState<string>('');

    // Set progress callback for the service
    useEffect(() => {
        setProgressCallback(setCreationProgress);
    }, []);

    const handleCreateCourse = async (status?: 'ACTIVE' | 'DRAFT') => {
        if (!courseMetadata) {
            toast.error(t('metadataMissing'));
            return;
        }

        if (!sessionsWithProgress || sessionsWithProgress.length === 0) {
            toast.error(t('noSessions'));
            return;
        }

        setIsCreatingCourse(true);
        setCreationProgress(t('progress.initializing'));

        try {
            // Extract course name - check multiple possible field names
            const courseName =
                courseMetadata.course_name ||
                courseMetadata.courseName ||
                courseMetadata.title ||
                t('defaultCourseName');
            console.log('[Course Creation] Extracted course name:', courseName);

            setCreationProgress(t('progress.creating'));
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

            setCreationProgress(t('progress.created'));
            toast.success(t('progress.created'));
            // Clear saved draft since course is now created
            localStorage.removeItem('aiCourseDraft');

            // Live AI Tutor: enable tutor mode on the new course and compile its
            // teaching plans in the background. Best-effort — the course exists
            // either way, and the Tutor Mode tab can prepare it later.
            void startTutorPreparation(result.courseId, t);

            // Navigate to the course details page
            console.log('[Course Creation] Navigating to course:', result.courseId);

            if (isTeacher && status === 'ACTIVE') {
                setCreationProgress(t('progress.submitting'));
                try {
                    await submitForReview(result.courseId);
                    toast.success(t('reviewSubmitted'));
                } catch (reviewError) {
                    console.error('Error submitting for review:', reviewError);
                    toast.error(t('reviewSubmitFailed'));
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
            const errorMessage = error instanceof Error ? error.message : t('createFailed');
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
