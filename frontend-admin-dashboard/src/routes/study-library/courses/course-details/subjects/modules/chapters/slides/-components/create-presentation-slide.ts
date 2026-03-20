// import type { SlideType } from '../constant/slideType';
import { slideType } from '@/routes/manage-students/students-list/-components/students-list/student-side-view/student-learning-progress/chapter-details/topic-details/topic-details';

import { generateUniqueDocumentSlideTitle } from '../-helper/slide-naming-utils';
import { DocumentSlidePayload, Slide } from '../-hooks/use-slides';
import { getSlideStatusForUser } from '../non-admin/hooks/useNonAdminSlides';
// import { SlideType } from './slide-type-sheet';

/**
 * Creates a payload for a new presentation slide with excalidraw source type
 */
export function createPresentationSlidePayload(
    slideType: slideType,
    allSlides: Slide[] = []
): DocumentSlidePayload {
    // Create a new slide ID
    const slideId = crypto.randomUUID();

    // Generate unique title based on existing slides
    const uniqueTitle = generateUniqueDocumentSlideTitle(allSlides, 'PRESENTATION');

    // Get the correct status based on user role
    const slideStatus = getSlideStatusForUser();

    // Create the presentation slide payload
    return {
        id: slideId,
        title: uniqueTitle,
        image_file_id: '',
        description: '',
        slide_order: null,
        document_slide: {
            id: crypto.randomUUID(),
            type: 'PRESENTATION',
            data: null, // Will be set to S3 file ID when first saved
            title: uniqueTitle,
            cover_file_id: '',
            total_pages: 1,
            published_data: slideStatus === 'PUBLISHED' ? null : null, // Will be set when content is saved
            published_document_total_pages: 1,
        },
        status: slideStatus,
        new_slide: true,
        notify: false,
    };
}
