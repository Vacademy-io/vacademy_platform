import { Slide } from '../-hooks/use-slides';

/**
 * Slide type mappings for generating unique names
 */
export const SLIDE_TYPE_NAMES = {
    // Document types
    DOC: 'Document',
    PRESENTATION: 'Presentation',
    JUPYTER: 'Jupyter Notebook',
    SCRATCH: 'Scratch Project',
    CODE: 'Code Editor',

    // Video types
    VIDEO: 'Video',

    // Audio types
    AUDIO: 'Audio',

    // Question types
    QUESTION: 'Question',

    // Assignment types
    ASSIGNMENT: 'Assignment',

    // PDF types
    PDF: 'PDF Document',
} as const;

/**
 * Get the slide type for naming based on slide properties
 */
export function getSlideTypeForNaming(slide: Partial<Slide>): string {
    // Handle document slides
    if (slide.source_type === 'DOCUMENT' && slide.document_slide?.type) {
        const docType = slide.document_slide.type;
        switch (docType) {
            case 'DOC':
                return SLIDE_TYPE_NAMES.DOC;
            case 'PRESENTATION':
                return SLIDE_TYPE_NAMES.PRESENTATION;
            case 'JUPYTER':
                return SLIDE_TYPE_NAMES.JUPYTER;
            case 'SCRATCH':
                return SLIDE_TYPE_NAMES.SCRATCH;
            case 'CODE':
                return SLIDE_TYPE_NAMES.CODE;
            default:
                return SLIDE_TYPE_NAMES.DOC;
        }
    }

    // Handle video slides
    if (slide.source_type === 'VIDEO') {
        return SLIDE_TYPE_NAMES.VIDEO;
    }

    // Handle question slides
    if (slide.source_type === 'QUESTION') {
        return SLIDE_TYPE_NAMES.QUESTION;
    }

    // Handle assignment slides
    if (slide.source_type === 'ASSIGNMENT') {
        return SLIDE_TYPE_NAMES.ASSIGNMENT;
    }

    // Handle audio slides
    if (slide.source_type === 'AUDIO') {
        return SLIDE_TYPE_NAMES.AUDIO;
    }

    // Default fallback
    return 'Slide';
}

/**
 * Count existing slides of the same type
 */
export function countSlidesOfType(allSlides: Slide[], targetSlideType: string): number {
    return allSlides.filter((slide) => {
        const slideType = getSlideTypeForNaming(slide);
        return slideType === targetSlideType;
    }).length;
}

/**
 * Generate a unique slide name based on type and existing titles
 */
export function generateUniqueSlideTitle(
    allSlides: Slide[],
    slideType: string,
    customPrefix?: string
): string {
    const typeForNaming = customPrefix || slideType;
    const existingTitles = new Set(allSlides.map((slide) => slide.title?.trim() || ''));

    let counter = 1;
    let candidateTitle = `${typeForNaming} ${counter}`;

    while (existingTitles.has(candidateTitle)) {
        counter++;
        candidateTitle = `${typeForNaming} ${counter}`;
    }

    return candidateTitle;
}

/**
 * Generate a unique slide name for document slides
 */
export function generateUniqueDocumentSlideTitle(allSlides: Slide[], documentType: string): string {
    let slideTypeName: string;

    switch (documentType) {
        case 'DOC':
            slideTypeName = SLIDE_TYPE_NAMES.DOC;
            break;
        case 'PRESENTATION':
            slideTypeName = SLIDE_TYPE_NAMES.PRESENTATION;
            break;
        case 'JUPYTER':
            slideTypeName = SLIDE_TYPE_NAMES.JUPYTER;
            break;
        case 'SCRATCH':
            slideTypeName = SLIDE_TYPE_NAMES.SCRATCH;
            break;
        case 'CODE':
            slideTypeName = SLIDE_TYPE_NAMES.CODE;
            break;
        default:
            slideTypeName = SLIDE_TYPE_NAMES.DOC;
    }

    return generateUniqueSlideTitle(allSlides, slideTypeName);
}

/**
 * Generate a unique slide name for video slides
 */
export function generateUniqueVideoSlideTitle(allSlides: Slide[]): string {
    return generateUniqueSlideTitle(allSlides, SLIDE_TYPE_NAMES.VIDEO);
}

/**
 * Generate a unique slide name for question slides
 */
export function generateUniqueQuestionSlideTitle(allSlides: Slide[]): string {
    return generateUniqueSlideTitle(allSlides, SLIDE_TYPE_NAMES.QUESTION);
}

/**
 * Generate a unique slide name for assignment slides
 */
export function generateUniqueAssignmentSlideTitle(allSlides: Slide[]): string {
    return generateUniqueSlideTitle(allSlides, SLIDE_TYPE_NAMES.ASSIGNMENT);
}

/**
 * Generate a unique slide name for quiz slides
 */
export function generateUniqueQuizSlideTitle(allSlides: Slide[]): string {
    return generateUniqueSlideTitle(allSlides, 'Quiz');
}

/**
 * Generate a unique slide name for audio slides
 */
export function generateUniqueAudioSlideTitle(allSlides: Slide[]): string {
    return generateUniqueSlideTitle(allSlides, SLIDE_TYPE_NAMES.AUDIO);
}

type SlideOrderInput = Pick<Slide, 'slide_order'> & Partial<Pick<Slide, 'id'>>;

export function getNextSlideOrder(slides: SlideOrderInput[] = []): number {
    if (!slides || slides.length === 0) return 0;
    let max = -1;
    for (const s of slides) {
        const v = typeof s.slide_order === 'number' ? s.slide_order : -1;
        if (v > max) max = v;
    }
    return max + 1;
}

export function buildAppendReorderPayload(
    newSlideId: string,
    currentSlides: Pick<Slide, 'id' | 'slide_order'>[] = []
): { slide_id: string; slide_order: number }[] {
    const others = (currentSlides || [])
        .filter((s) => s.id !== newSlideId)
        .slice()
        .sort((a, b) => (a.slide_order ?? 0) - (b.slide_order ?? 0));
    return [
        ...others.map((s, idx) => ({ slide_id: s.id, slide_order: idx })),
        { slide_id: newSlideId, slide_order: others.length },
    ];
}
