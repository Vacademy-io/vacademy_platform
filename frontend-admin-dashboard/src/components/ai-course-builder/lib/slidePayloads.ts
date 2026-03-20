import type {
    Slide,
    TextData,
    VideoSlide,
    DocumentSlide,
    QuizSlide,
    AssignmentSlide,
    QuestionSlide,
} from '../types/index';

// Helper function to generate unique titles
const generateUniqueTitle = (baseTitle: string, existingSlides: Slide[]): string => {
    const existingTitles = existingSlides.map((slide) => slide.title.toLowerCase());
    let counter = 1;
    let title = baseTitle;

    while (existingTitles.includes(title.toLowerCase())) {
        title = `${baseTitle} ${counter}`;
        counter++;
    }

    return title;
};

// Helper function to create default text data
const createDefaultTextData = (content: string = ''): TextData => ({
    id: crypto.randomUUID(),
    type: 'TEXT',
    content: content,
});

// Helper function to get default slide status
const getDefaultStatus = (): 'DRAFT' | 'PUBLISHED' => 'DRAFT';

/**
 * Creates a presentation slide payload (using document_slide with PRESENTATION type)
 */
export function createPresentationSlidePayload(
    chapterName: string,
    existingSlides: Slide[] = [],
    titleOverride?: string
): Slide {
    const slideId = crypto.randomUUID();
    const title =
        titleOverride || generateUniqueTitle(`${chapterName} - Presentation`, existingSlides);

    return {
        id: slideId,
        source_id: '',
        source_type: 'PRESENTATION',
        title: title,
        image_file_id: '',
        description: 'Interactive presentation slide',
        status: getDefaultStatus(),
        slide_order: 0,
        is_loaded: true,
        new_slide: true,
        notify: false,
        is_ai_generated: false,
        manual_modifications: true,
        document_slide: {
            id: crypto.randomUUID(),
            type: 'PRESENTATION',
            data: '', // Will be set to S3 file ID when content is saved
            title: title,
            cover_file_id: '',
            total_pages: 1,
            published_data: '',
            published_document_total_pages: 1,
        },
        video_slide: null,
        quiz_slide: null,
        assignment_slide: null,
        question_slide: null,
    };
}

/**
 * Creates a document slide payload
 */
export function createDocumentSlidePayload(
    chapterName: string,
    existingSlides: Slide[] = [],
    titleOverride?: string
): Slide {
    const slideId = crypto.randomUUID();
    const title = titleOverride || generateUniqueTitle(`${chapterName} - Document`, existingSlides);

    return {
        id: slideId,
        source_id: '',
        source_type: 'DOCUMENT',
        title: title,
        image_file_id: '',
        description: 'Document slide',
        status: getDefaultStatus(),
        slide_order: 0,
        is_loaded: true,
        new_slide: true,
        notify: false,
        is_ai_generated: false,
        manual_modifications: true,
        document_slide: {
            id: crypto.randomUUID(),
            type: 'DOCUMENT',
            data: '', // Will be set when content is uploaded
            title: title,
            cover_file_id: '',
            total_pages: 1,
            published_data: '',
            published_document_total_pages: 1,
        },
        video_slide: null,
        quiz_slide: null,
        assignment_slide: null,
        question_slide: null,
    };
}

/**
 * Creates a PDF slide payload
 */
export function createPdfSlidePayload(
    chapterName: string,
    existingSlides: Slide[] = [],
    titleOverride?: string
): Slide {
    const slideId = crypto.randomUUID();
    const title = titleOverride || generateUniqueTitle(`${chapterName} - PDF`, existingSlides);

    return {
        id: slideId,
        source_id: '',
        source_type: 'PDF',
        title: title,
        image_file_id: '',
        description: 'PDF document slide',
        status: getDefaultStatus(),
        slide_order: 0,
        is_loaded: true,
        new_slide: true,
        notify: false,
        is_ai_generated: false,
        manual_modifications: true,
        document_slide: {
            id: crypto.randomUUID(),
            type: 'PDF',
            data: '', // Will be set when PDF is uploaded
            title: title,
            cover_file_id: '',
            total_pages: 1,
            published_data: '',
            published_document_total_pages: 1,
        },
        video_slide: null,
        quiz_slide: null,
        assignment_slide: null,
        question_slide: null,
    };
}

/**
 * Creates a video slide payload
 */
export function createVideoSlidePayload(
    chapterName: string,
    existingSlides: Slide[] = [],
    titleOverride?: string
): Slide {
    const slideId = crypto.randomUUID();
    const title = titleOverride || generateUniqueTitle(`${chapterName} - Video`, existingSlides);

    return {
        id: slideId,
        source_id: '',
        source_type: 'VIDEO',
        title: title,
        image_file_id: '',
        description: 'Video lesson slide',
        status: getDefaultStatus(),
        slide_order: 0,
        is_loaded: true,
        new_slide: true,
        notify: false,
        is_ai_generated: false,
        manual_modifications: true,
        video_slide: {
            id: crypto.randomUUID(),
            description: 'Video lesson',
            title: title,
            url: '',
            video_length_in_millis: 0,
            published_url: '',
            published_video_length_in_millis: 0,
            source_type: 'VIDEO',
            embedded_type: '',
            embedded_data: '',
            questions: [],
        },
        document_slide: null,
        quiz_slide: null,
        assignment_slide: null,
        question_slide: null,
    };
}

/**
 * Creates a quiz slide payload
 */
export function createQuizSlidePayload(
    chapterName: string,
    existingSlides: Slide[] = [],
    titleOverride?: string
): Slide {
    const slideId = crypto.randomUUID();
    const title = titleOverride || generateUniqueTitle(`${chapterName} - Quiz`, existingSlides);

    return {
        id: slideId,
        source_id: '',
        source_type: 'QUIZ',
        title: title,
        image_file_id: '',
        description: 'Quiz slide',
        status: getDefaultStatus(),
        slide_order: 0,
        is_loaded: true,
        new_slide: true,
        notify: false,
        is_ai_generated: false,
        manual_modifications: true,
        quiz_slide: {
            id: crypto.randomUUID(),
            title: title,
            description: createDefaultTextData('Quiz description'),
            questions: [],
            parent_rich_text: createDefaultTextData(''),
            explanation_text_data: createDefaultTextData(''),
            media_id: '',
            question_response_type: 'OPTION',
            access_level: 'INSTITUTE',
            evaluation_type: 'AUTO',
            default_question_time_mins: 1,
            re_attempt_count: 0,
            source_type: 'QUIZ',
        },
        video_slide: null,
        document_slide: null,
        assignment_slide: null,
        question_slide: null,
    };
}

/**
 * Creates an assignment slide payload
 */
export function createAssignmentSlidePayload(
    chapterName: string,
    existingSlides: Slide[] = [],
    titleOverride?: string
): Slide {
    const slideId = crypto.randomUUID();
    const title =
        titleOverride || generateUniqueTitle(`${chapterName} - Assignment`, existingSlides);

    const date = new Date();
    const isoDate = date.toISOString();

    return {
        id: slideId,
        source_id: '',
        source_type: 'ASSIGNMENT',
        title: title,
        image_file_id: '',
        description: 'Assignment slide',
        status: getDefaultStatus(),
        slide_order: 0,
        is_loaded: true,
        new_slide: true,
        notify: false,
        is_ai_generated: false,
        manual_modifications: true,
        assignment_slide: {
            id: crypto.randomUUID(),
            parent_rich_text: createDefaultTextData(''),
            text_data: createDefaultTextData(''),
            live_date: isoDate,
            end_date: isoDate,
            re_attempt_count: 0,
            comma_separated_media_ids: '',
            questions: [],
        },
        video_slide: null,
        document_slide: null,
        quiz_slide: null,
        question_slide: null,
    };
}

/**
 * Creates a question slide payload
 */
export function createQuestionSlidePayload(
    chapterName: string,
    existingSlides: Slide[] = [],
    titleOverride?: string
): Slide {
    const slideId = crypto.randomUUID();
    const title = titleOverride || generateUniqueTitle(`${chapterName} - Question`, existingSlides);

    return {
        id: slideId,
        source_id: '',
        source_type: 'QUESTION',
        title: title,
        image_file_id: '',
        description: 'Question slide',
        status: getDefaultStatus(),
        slide_order: 0,
        is_loaded: true,
        new_slide: true,
        notify: false,
        is_ai_generated: false,
        manual_modifications: true,
        question_slide: {
            id: crypto.randomUUID(),
            parent_rich_text: createDefaultTextData(''),
            text_data: createDefaultTextData(''),
            explanation_text_data: createDefaultTextData(''),
            media_id: '',
            question_response_type: 'OPTION',
            question_type: 'MCQ',
            access_level: 'INSTITUTE',
            auto_evaluation_json: '',
            evaluation_type: 'AUTO',
            default_question_time_mins: 1,
            re_attempt_count: 0,
            points: 1,
            options: [],
            source_type: 'QUESTION',
        },
        video_slide: null,
        document_slide: null,
        quiz_slide: null,
        assignment_slide: null,
    };
}

/**
 * Creates a Jupyter Notebook slide payload
 */
export function createJupyterNotebookSlidePayload(
    chapterName: string,
    existingSlides: Slide[] = [],
    titleOverride?: string
): Slide {
    const slideId = crypto.randomUUID();
    const title = titleOverride || 'Jupyter Notebook';

    const jupyterData = JSON.stringify({
        projectName: '',
        contentUrl: '',
        contentBranch: 'main',
        notebookLocation: 'root',
        activeTab: 'settings',
        editorType: 'jupyterEditor',
        timestamp: Date.now(),
    });

    return {
        id: slideId,
        source_id: crypto.randomUUID(),
        source_type: 'DOCUMENT',
        title,
        image_file_id: '',
        description: 'Interactive Jupyter notebook environment',
        status: 'DRAFT',
        slide_order: 0,
        video_slide: null,
        document_slide: {
            id: crypto.randomUUID(),
            type: 'JUPYTER',
            data: jupyterData,
            title,
            cover_file_id: '',
            total_pages: 1,
            published_data: '',
            published_document_total_pages: 1,
        },
        question_slide: null,
        assignment_slide: null,
        quiz_slide: null,
        is_loaded: true,
        new_slide: true,
        content: '',
        is_ai_generated: true,
        manual_modifications: false,
    };
}

/**
 * Creates a Scratch Project slide payload
 */
export function createScratchProjectSlidePayload(
    chapterName: string,
    existingSlides: Slide[] = [],
    titleOverride?: string
): Slide {
    const slideId = crypto.randomUUID();
    const title = titleOverride || 'Scratch Project';

    const scratchData = JSON.stringify({
        projectId: '',
        scratchUrl: '',
        embedType: 'project',
        autoStart: false,
        hideControls: false,
        editorType: 'scratchEditor',
        timestamp: Date.now(),
    });

    return {
        id: slideId,
        source_id: crypto.randomUUID(),
        source_type: 'DOCUMENT',
        title,
        image_file_id: '',
        description: 'Interactive Scratch programming environment',
        status: 'DRAFT',
        slide_order: 0,
        video_slide: null,
        document_slide: {
            id: crypto.randomUUID(),
            type: 'SCRATCH',
            data: scratchData,
            title,
            cover_file_id: '',
            total_pages: 1,
            published_data: '',
            published_document_total_pages: 1,
        },
        question_slide: null,
        assignment_slide: null,
        quiz_slide: null,
        is_loaded: true,
        new_slide: true,
        content: '',
        is_ai_generated: true,
        manual_modifications: false,
    };
}

/**
 * Creates a Code Editor slide payload
 */
export function createCodeEditorSlidePayload(
    chapterName: string,
    existingSlides: Slide[] = [],
    titleOverride?: string
): Slide {
    const slideId = crypto.randomUUID();
    const title = titleOverride || 'Code Editor';

    const codeData = JSON.stringify({
        language: 'python',
        theme: 'dark',
        code: '# Welcome to Python Code Editor\nprint("Hello, World!")',
        readOnly: false,
        showLineNumbers: true,
        fontSize: 14,
        editorType: 'codeEditor',
        timestamp: Date.now(),
    });

    return {
        id: slideId,
        source_id: crypto.randomUUID(),
        source_type: 'DOCUMENT',
        title,
        image_file_id: '',
        description: 'Interactive code editing environment',
        status: 'DRAFT',
        slide_order: 0,
        video_slide: null,
        document_slide: {
            id: crypto.randomUUID(),
            type: 'CODE',
            data: codeData,
            title,
            cover_file_id: '',
            total_pages: 1,
            published_data: '',
            published_document_total_pages: 1,
        },
        question_slide: null,
        assignment_slide: null,
        quiz_slide: null,
        is_loaded: true,
        new_slide: true,
        content: '',
        is_ai_generated: true,
        manual_modifications: false,
    };
}

/**
 * Helper function to convert AI simple slide to rich slide structure
 */
export function convertAISlideToRichSlide(
    aiSlide: { name: string; type?: string; content?: string },
    chapterName: string
): Slide {
    const slideType = aiSlide.type || 'document';
    const existingSlides: Slide[] = []; // Empty array for new slides

    let slide: Slide;

    switch (slideType) {
        case 'video':
        case 'youtube':
            slide = createVideoSlidePayload(chapterName, existingSlides, aiSlide.name);
            // Set video content if available
            if (aiSlide.content && slide.video_slide) {
                slide.video_slide.url = aiSlide.content;
                slide.video_slide.published_url = aiSlide.content;
            }
            break;
        case 'pdf':
            slide = createPdfSlidePayload(chapterName, existingSlides, aiSlide.name);
            break;
        case 'assessment':
        case 'quiz':
            slide = createQuizSlidePayload(chapterName, existingSlides, aiSlide.name);
            break;
        case 'assignment':
            slide = createAssignmentSlidePayload(chapterName, existingSlides, aiSlide.name);
            break;
        case 'presentation':
            slide = createPresentationSlidePayload(chapterName, existingSlides, aiSlide.name);
            break;
        case 'jupyter-notebook':
            slide = createJupyterNotebookSlidePayload(chapterName, existingSlides, aiSlide.name);
            break;
        case 'scratch-project':
            slide = createScratchProjectSlidePayload(chapterName, existingSlides, aiSlide.name);
            break;
        case 'code-editor':
            slide = createCodeEditorSlidePayload(chapterName, existingSlides, aiSlide.name);
            break;
        case 'document':
        case 'text':
        default:
            slide = createDocumentSlidePayload(chapterName, existingSlides, aiSlide.name);
            break;
    }

    // Mark all AI-generated slides consistently
    slide.is_ai_generated = true;
    slide.manual_modifications = false;

    // Set AI-generated content if available
    if (aiSlide.content) {
        slide.ai_content = aiSlide.content;
    }

    return slide;
}

export const slideTypeOptions = [
    { value: 'presentation', label: 'Presentation', icon: '📊' },
    { value: 'document', label: 'Document', icon: '📄' },
    { value: 'pdf', label: 'PDF', icon: '📑' },
    { value: 'video', label: 'Video', icon: '🎥' },
    { value: 'quiz', label: 'Quiz', icon: '❓' },
    { value: 'assignment', label: 'Assignment', icon: '✍️' },
    { value: 'question', label: 'Question', icon: '❔' },
];
