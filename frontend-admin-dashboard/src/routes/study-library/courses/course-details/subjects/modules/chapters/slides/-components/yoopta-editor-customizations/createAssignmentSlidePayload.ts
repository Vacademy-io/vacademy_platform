import type {
    AssignmentSlidePayload,
    QuizSlidePayload,
    Slide,
} from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-hooks/use-slides';
import {
    generateUniqueAssignmentSlideTitle,
    generateUniqueQuizSlideTitle,
} from '../../-helper/slide-naming-utils';
import { getSlideStatusForUser } from '../../non-admin/hooks/useNonAdminSlides';

export function createAssignmentSlidePayload(
    allSlides: Slide[] = [],
    titleOverride?: string
): AssignmentSlidePayload {
    const slideId = crypto.randomUUID();
    const title =
        titleOverride?.trim() ||
        generateUniqueAssignmentSlideTitle(allSlides) ||
        'Untitled Assignment';

    const date = new Date();
    const isoDate = date.toISOString();

    console.log('[Assignment Payload] Creating assignment slide payload:', {
        title,
        live_date: isoDate,
        end_date: isoDate,
        dateType: typeof isoDate,
        isValidISO: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(isoDate),
    });

    const slideStatus = getSlideStatusForUser();

    return {
        id: slideId,
        source_id: '',
        source_type: 'ASSIGNMENT',
        title: title,
        image_file_id: '',
        description: 'Assignment',
        status: slideStatus,
        slide_order: 0,
        video_slide: null,
        document_slide: null,
        question_slide: null,
        assignment_slide: {
            id: crypto.randomUUID(),
            parent_rich_text: {
                id: '',
                type: 'TEXT',
                content: '',
            },
            text_data: {
                id: '',
                type: 'TEXT',
                content: '',
            },
            live_date: isoDate,
            end_date: isoDate,
            re_attempt_count: 0,
            comma_separated_media_ids: '',
            questions: [],
        },
        quiz_slide: null,
        is_loaded: true,
        new_slide: true,
    };
}

/**
 * Creates a payload for a new quiz slide without questions
 */
export function createQuizSlidePayload(
    allSlides: Slide[] = [],
    titleOverride?: string
): QuizSlidePayload {
    const slideId = crypto.randomUUID();
    const title =
        titleOverride?.trim() || generateUniqueQuizSlideTitle(allSlides) || 'Untitled Quiz';

    console.log('[Quiz Payload] Creating quiz slide payload:', {
        title,
        slideId,
    });

    const slideStatus = getSlideStatusForUser();

    return {
        id: slideId,
        source_id: '',
        source_type: 'QUIZ',
        title: title,
        image_file_id: '',
        description: 'Quiz',
        status: slideStatus,
        slide_order: 0,
        video_slide: null,
        document_slide: null,
        question_slide: null,
        assignment_slide: null,
        quiz_slide: {
            id: crypto.randomUUID(),
            title: title,
            description: {
                id: '',
                content: '',
                type: 'TEXT',
            },
            questions: [],
        },
        is_loaded: true,
        new_slide: true,
    };
}
