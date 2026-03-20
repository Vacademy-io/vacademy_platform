/* eslint-disable */
import { QuestionType } from '@/constants/dummy-data';
import {
    getEvaluationJSON,
    transformResponseDataToMyQuestionsSchema,
    transformResponseDataToMyQuestionsSchemaSingleQuestion,
} from '@/routes/assessment/question-papers/-utils/helper';
// Lazily load heavy libs at call sites
import { AssignmentSlide, Slide } from '../-hooks/use-slides';
import { MyQuestion } from '@/types/assessments/question-paper-form';
import { convertDateFormat } from '@/routes/assessment/create-assessment/$assessmentId/$examtype/-components/StepComponents/Step1BasicInfo';
import { convertToUTC } from '@/routes/homework-creation/create-assessment/$assessmentId/$examtype/-utils/helper';
import { AssignmentFormType } from '../-form-schemas/assignmentFormSchema';
import { parseHtmlToString } from '@/lib/utils';



export const convertHtmlToPdf = async (
    htmlString: string
): Promise<{ pdfBlob: Blob; totalPages: number }> => {
    // Create temporary div to hold the HTML content
    const tempDiv: HTMLElement = document.createElement('div');
    tempDiv.innerHTML = htmlString;

    // Pre-process images
    const imageElements = tempDiv.querySelectorAll('img');
    for (const img of Array.from(imageElements)) {
        // Fix zero width/height images
        if (img.width === 0 || img.height === 0) {
            img.width = 400;
            img.height = 300;
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
        }

        // Make sure image has proper loading attributes
        img.crossOrigin = 'anonymous';
        img.loading = 'eager';
    }

    // Create an offscreen container that's outside the viewport
    tempDiv.style.position = 'absolute';
    tempDiv.style.top = '-9999px';
    tempDiv.style.left = '-9999px';
    tempDiv.style.width = '210mm'; // A4 width
    tempDiv.style.backgroundColor = 'white';
    tempDiv.style.padding = '10mm';
    // Don't constrain height

    // Append to body temporarily
    document.body.appendChild(tempDiv);

    try {
        // Wait for any potential image loading and layout
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Initialize PDF
        const { default: jsPDF } = await import('jspdf');
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            compress: true,
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        // Get content HTML element with content
        const content = tempDiv.querySelector('body') || tempDiv;
        const contentHeight = content.scrollHeight;

        // Capture the entire content in one go
        const { default: html2canvas } = await import('html2canvas');
        const canvas = await html2canvas(content, {
            scale: 1.5,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: content.scrollWidth,
            height: contentHeight,
            windowWidth: content.scrollWidth,
            windowHeight: contentHeight,
            allowTaint: true,
        });

        // How many pages do we need?
        const pageHeightInPx = 277 * 3.78 * 1.5; // A4 height in px (with scale)
        const totalPages = Math.ceil(canvas.height / pageHeightInPx);

        // Add each page to the PDF
        for (let i = 0; i < totalPages; i++) {
            // Add new page if not the first page
            if (i > 0) {
                pdf.addPage();
            }

            // Set white background for the page
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');

            // Create a temporary canvas for this page slice
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = canvas.width;
            tempCanvas.height = pageHeightInPx;

            if (tempCtx) {
                // Fill with white background
                tempCtx.fillStyle = '#ffffff';
                tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

                // Position for this slice
                const sourceY = i * pageHeightInPx;
                const sourceHeight = Math.min(pageHeightInPx, canvas.height - sourceY);

                // Draw portion of original canvas to this temp canvas
                tempCtx.drawImage(
                    canvas,
                    0,
                    sourceY,
                    canvas.width,
                    sourceHeight,
                    0,
                    0,
                    canvas.width,
                    sourceHeight
                );

                // Get optimized image data for this page
                const pageImgData = optimizeImage(tempCanvas);

                // Add to PDF - keep original dimensions
                pdf.addImage({
                    imageData: pageImgData,
                    format: 'JPEG',
                    x: 0,
                    y: 0,
                    width: pdfWidth,
                    height: pdfHeight, // Use full page height
                    compression: 'FAST',
                    rotation: 0,
                });
            }
        }

        // Generate the PDF blob
        const pdfOutput = pdf.output('datauristring');
        const pdfBlob = await fetch(pdfOutput).then((res) => res.blob());
        return {
            pdfBlob: new Blob([pdfBlob], { type: 'application/pdf' }),
            totalPages,
        };
    } finally {
        // Clean up
        if (document.body.contains(tempDiv)) {
            document.body.removeChild(tempDiv);
        }
    }
};

// Modified optimizeImage function with white background
const optimizeImage = (canvas: HTMLCanvasElement): string => {
    // Create a new canvas with optimal dimensions
    const optimizedCanvas = document.createElement('canvas');
    const ctx = optimizedCanvas.getContext('2d');

    // Set dimensions to A4 at 200 DPI (same as ExportHandler)
    optimizedCanvas.width = 1654;
    optimizedCanvas.height = 2339;

    if (ctx) {
        // Fill with white background first
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, optimizedCanvas.width, optimizedCanvas.height);

        // Enable image smoothing for better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw original canvas onto optimized canvas
        ctx.drawImage(
            canvas,
            0,
            0,
            canvas.width,
            canvas.height,
            0,
            0,
            optimizedCanvas.width,
            optimizedCanvas.height
        );
    }

    // Convert to compressed JPEG instead of PNG - same as ExportHandler
    return optimizedCanvas.toDataURL('image/jpeg', 0.8);
};

export function updateDocumentDataInSlides<T>(
    data: Slide[],
    slide: Slide,
    formData: T,
    setActiveItem: (item: Slide) => void
): Slide[] {
    return data.map((item) => {
        if (item.id === slide.id) {
            const changedData: Slide = {
                ...item,
                // document_data: JSON.stringify(formData),
            };
            setActiveItem(changedData);
            return changedData;
        }
        return item;
    });
}

export const formatTimeStudyLibraryInSeconds = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs}:${mins < 10 ? '0' + mins : mins}:${secs < 10 ? '0' + secs : secs}`;
};

export function convertStudyLibraryQuestion(question: MyQuestion) {
    let options;
    if (question.questionType === QuestionType.MCQS) {
        options = question?.singleChoiceOptions?.map((opt, idx) => ({
            id: opt.id, // Assuming no direct mapping for option ID
            preview_id: idx, // Using index as preview_id
            question_id: null,
            text: {
                id: null, // Assuming no direct mapping for option text ID
                type: 'HTML', // Assuming option content is HTML
                content: opt?.name?.replace(/<\/?p>/g, ''), // Remove <p> tags from content
            },
            explanation_text: {
                id: null, // Assuming no direct mapping for explanation text ID
                type: 'HTML', // Assuming explanation for options is in HTML
                content: question.explanation, // Assuming no explanation provided for options
            },
        }));
    } else if (question?.questionType === QuestionType.TRUE_FALSE) {
        options = question?.trueFalseOptions?.map((opt, idx) => ({
            id: opt.id, // Assuming no direct mapping for option ID
            preview_id: idx, // Using index as preview_id
            text: {
                id: null, // Assuming no direct mapping for option text ID
                type: 'HTML', // Assuming option content is HTML
                content: idx === 0 ? 'TRUE' : 'FALSE', // First option is TRUE, second is FALSE
            },
            explanation_text: {
                id: null, // Assuming no direct mapping for explanation text ID
                type: 'HTML', // Assuming explanation for options is in HTML
                content: question.explanation, // Assuming no explanation provided for options
            },
        }));
    } else if (question?.questionType === QuestionType.MCQM) {
        options = question?.multipleChoiceOptions?.map((opt, idx) => ({
            id: opt.id, // Assuming no direct mapping for option ID
            preview_id: idx, // Using index as preview_id
            text: {
                id: null, // Assuming no direct mapping for option text ID
                type: 'HTML', // Assuming option content is HTML
                content: opt?.name?.replace(/<\/?p>/g, ''), // Remove <p> tags from content
            },
            explanation_text: {
                id: null, // Assuming no direct mapping for explanation text ID
                type: 'HTML', // Assuming explanation for options is in HTML
                content: question.explanation, // Assuming no explanation provided for options
            },
        }));
    } else if (question?.questionType === QuestionType.CMCQS) {
        options = question?.csingleChoiceOptions?.map((opt, idx) => ({
            id: opt.id, // Assuming no direct mapping for option ID
            preview_id: idx, // Using index as preview_id
            text: {
                id: null, // Assuming no direct mapping for option text ID
                type: 'HTML', // Assuming option content is HTML
                content: opt?.name?.replace(/<\/?p>/g, ''), // Remove <p> tags from content
            },
            explanation_text: {
                id: null, // Assuming no direct mapping for explanation text ID
                type: 'HTML', // Assuming explanation for options is in HTML
                content: question.explanation, // Assuming no explanation provided for options
            },
        }));
    } else if (question?.questionType === QuestionType.CMCQM) {
        options = question?.cmultipleChoiceOptions?.map((opt, idx) => ({
            id: opt.id, // Assuming no direct mapping for option ID
            preview_id: idx, // Using index as preview_id
            text: {
                id: null, // Assuming no direct mapping for option text ID
                type: 'HTML', // Assuming option content is HTML
                content: opt?.name?.replace(/<\/?p>/g, ''), // Remove <p> tags from content
            },
            explanation_text: {
                id: null, // Assuming no direct mapping for explanation text ID
                type: 'HTML', // Assuming explanation for options is in HTML
                content: question.explanation, // Assuming no explanation provided for options
            },
        }));
    }

    // Extract correct option indices as strings
    let correctOptionIds;

    if (question?.questionType === QuestionType.MCQS) {
        correctOptionIds = question?.singleChoiceOptions
            ?.map((opt, idx) => (opt.isSelected ? (opt.id ? opt.id : idx.toString()) : null))
            .filter((idx) => idx !== null); // Remove null values
    } else if (question?.questionType === QuestionType.MCQM) {
        correctOptionIds = question?.multipleChoiceOptions
            ?.map((opt, idx) => (opt.isSelected ? (opt.id ? opt.id : idx.toString()) : null))
            .filter((idx) => idx !== null); // Remove null values
    } else if (question?.questionType === QuestionType.CMCQS) {
        correctOptionIds = question?.csingleChoiceOptions
            ?.map((opt, idx) => (opt.isSelected ? (opt.id ? opt.id : idx.toString()) : null))
            .filter((idx) => idx !== null); // Remove null values
    } else if (question?.questionType === QuestionType.CMCQM) {
        correctOptionIds = question?.cmultipleChoiceOptions
            ?.map((opt, idx) => (opt.isSelected ? (opt.id ? opt.id : idx.toString()) : null))
            .filter((idx) => idx !== null); // Remove null values
    } else if (question?.questionType === QuestionType.TRUE_FALSE) {
        correctOptionIds = question?.trueFalseOptions
            ?.map((opt, idx) => (opt.isSelected ? (opt.id ? opt.id : idx.toString()) : null))
            .filter((idx) => idx !== null); // Remove null values
    }

    const auto_evaluation_json = getEvaluationJSON(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        question!,
        correctOptionIds,
        question?.validAnswers,
        question?.subjectiveAnswerText
    );

    return {
        id: question.id ? question.id : crypto.randomUUID(),
        parent_rich_text: generateTextBlock(question?.parentRichTextContent || ''),
        text_data: generateTextBlock(question?.questionName || ''),
        explanation_text_data: generateTextBlock(question?.explanation || ''),
        media_id: '',
        question_response_type: 'OPTION',
        question_type: question?.questionType,
        access_level: 'PUBLIC',
        auto_evaluation_json: auto_evaluation_json,
        evaluation_type: 'AUTO',
        question_time_in_millis: timestampToSeconds(question.timestamp) * 1000,
        question_order: 0,
        status: question?.status || 'ACTIVE',
        options: options?.map((opt, idx) => ({
            id: opt.id || null,
            preview_id: opt.id || idx,
            text: generateTextBlock(opt.text?.content || ''),
            explanationTextData: generateTextBlock(opt.explanation_text?.content || ''),
            mediaId: '',
        })),
        new_question: question.newQuestion === false ? false : true,
        can_skip: question.canSkip,
    };
}

export const converDataToVideoFormat = ({
    activeItem,
    status,
    notify,
    newSlide,
}: {
    activeItem: Slide;
    status: string;
    notify: boolean;
    newSlide: boolean;
}) => {
    // Check if this is a split screen slide and include embedded data
    const splitData = (activeItem as any).splitScreenData;
    const splitType = (activeItem as any).splitScreenType;
    const isSplitScreen = (activeItem as any).splitScreenMode;

    const videoSlideData = {
        id: activeItem?.video_slide?.id || '',
        description: activeItem?.video_slide?.description || '',
        title: activeItem?.video_slide?.title || '',
        url: '',
        video_length_in_millis: activeItem?.video_slide?.video_length_in_millis || 0,
        published_url: activeItem?.video_slide?.url || activeItem?.video_slide?.published_url || '',
        published_video_length_in_millis:
            activeItem?.video_slide?.published_video_length_in_millis || 0,
        source_type: '',
        questions:
            activeItem?.video_slide?.questions.map((question) =>
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                convertStudyLibraryQuestion(question)
            ) || [],
        // Include embedded data for split screen slides
        ...(isSplitScreen &&
            splitData &&
            splitType && {
                embedded_type: splitType.replace('SPLIT_', ''),
                embedded_data: JSON.stringify(splitData),
            }),
    };

    return {
        id: activeItem?.id || '',
        title: activeItem?.title || '',
        description: activeItem?.description || '',
        image_file_id: activeItem?.image_file_id || '',
        source_id: activeItem?.video_slide?.id || '',
        source_type: activeItem?.source_type || '',
        status: status,
        slide_order: 0,
        video_slide: videoSlideData,
        document_slide: null,
        question_slide: null,
        assignment_slide: null,
        is_loaded: true,
        new_slide: newSlide,
        notify,
    };
};

export const convertToAssignmentSlideBackendFormat = (assignmentSlide: AssignmentFormType) => {
    console.log('[Assignment Backend Format] Converting assignment slide:', {
        originalStartDate: assignmentSlide.startDate,
        originalEndDate: assignmentSlide.endDate,
        startDateType: typeof assignmentSlide.startDate,
        endDateType: typeof assignmentSlide.endDate,
    });

    const convertedStartDate = convertToUTC(assignmentSlide.startDate);
    const convertedEndDate = convertToUTC(assignmentSlide.endDate);

    console.log('[Assignment Backend Format] Converted dates:', {
        convertedStartDate,
        convertedEndDate,
        startDateValidISO: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(convertedStartDate),
        endDateValidISO: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(convertedEndDate),
    });

    return {
        id: assignmentSlide.id,
        parent_rich_text: {
            id: '',
            type: 'RICH_TEXT',
            content: assignmentSlide.taskDescription,
        },
        text_data: {
            id: '',
            type: 'TEXT',
            content: assignmentSlide.task,
        },
        live_date: convertedStartDate,
        end_date: convertedEndDate,
        re_attempt_count: assignmentSlide.reattemptCount,
        comma_separated_media_ids: '',
        questions: assignmentSlide.adaptive_marking_for_each_question.map((question, idx) => {
            return {
                id: question.questionId,
                text_data: {
                    id: '',
                    type: 'text',
                    content: question.questionName,
                },
                question_order: idx,
                status: 'ACTIVE',
                question_type: question.questionType,
                new_question: question.newQuestion,
            };
        }),
    };
};

export const converDataToAssignmentFormat = ({
    activeItem,
    status,
    notify,
    newSlide,
}: {
    activeItem: Slide;
    status: string;
    notify: boolean;
    newSlide: boolean;
}) => {
    return {
        id: activeItem?.id || '',
        title: activeItem?.title || '',
        description: activeItem?.description || '',
        image_file_id: activeItem?.image_file_id || '',
        source_id: activeItem?.source_id || '',
        source_type: activeItem?.source_type || '',
        status: status,
        slide_order: 0,
        video_slide: null,
        document_slide: null,
        question_slide: null,
        assignment_slide: activeItem.assignment_slide
            ? convertToAssignmentSlideBackendFormat(activeItem.assignment_slide as any)
            : null,
        is_loaded: true,
        new_slide: newSlide,
        notify,
    };
};

export function convertToQuestionSlideFormat(question: MyQuestion, sourceId?: string) {
    let options;
    if (question?.questionType === QuestionType.MCQS) {
        options = question?.singleChoiceOptions?.map((opt, idx) => ({
            id: opt.id, // Assuming no direct mapping for option ID
            preview_id: idx, // Using index as preview_id
            question_id: null,
            text: {
                id: null, // Assuming no direct mapping for option text ID
                type: 'HTML', // Assuming option content is HTML
                content: opt?.name?.replace(/<\/?p>/g, ''), // Remove <p> tags from content
            },
            explanation_text: {
                id: null, // Assuming no direct mapping for explanation text ID
                type: 'HTML', // Assuming explanation for options is in HTML
                content: question.explanation, // Assuming no explanation provided for options
            },
        }));
    } else if (question?.questionType === QuestionType.TRUE_FALSE) {
        options = question?.trueFalseOptions?.map((opt, idx) => ({
            id: opt.id, // Assuming no direct mapping for option ID
            text: {
                id: null, // Assuming no direct mapping for option text ID
                type: 'HTML', // Assuming option content is HTML
                content: idx === 0 ? 'TRUE' : 'FALSE', // First option is TRUE, second is FALSE
            },
            explanation_text: {
                id: null, // Assuming no direct mapping for explanation text ID
                type: 'HTML', // Assuming explanation for options is in HTML
                content: question.explanation, // Assuming no explanation provided for options
            },
        }));
    } else if (question?.questionType === QuestionType.MCQM) {
        options = question?.multipleChoiceOptions?.map((opt) => ({
            id: opt.id, // Assuming no direct mapping for option ID
            text: {
                id: null, // Assuming no direct mapping for option text ID
                type: 'HTML', // Assuming option content is HTML
                content: opt?.name?.replace(/<\/?p>/g, ''), // Remove <p> tags from content
            },
            explanation_text: {
                id: null, // Assuming no direct mapping for explanation text ID
                type: 'HTML', // Assuming explanation for options is in HTML
                content: question.explanation, // Assuming no explanation provided for options
            },
        }));
    } else if (question?.questionType === QuestionType.CMCQS) {
        options = question?.csingleChoiceOptions?.map((opt) => ({
            id: opt.id, // Assuming no direct mapping for option ID
            text: {
                id: null, // Assuming no direct mapping for option text ID
                type: 'HTML', // Assuming option content is HTML
                content: opt?.name?.replace(/<\/?p>/g, ''), // Remove <p> tags from content
            },
            explanation_text: {
                id: null, // Assuming no direct mapping for explanation text ID
                type: 'HTML', // Assuming explanation for options is in HTML
                content: question.explanation, // Assuming no explanation provided for options
            },
        }));
    } else if (question?.questionType === QuestionType.CMCQM) {
        options = question?.cmultipleChoiceOptions?.map((opt) => ({
            id: opt.id, // Assuming no direct mapping for option ID
            text: {
                id: null, // Assuming no direct mapping for option text ID
                type: 'HTML', // Assuming option content is HTML
                content: opt?.name?.replace(/<\/?p>/g, ''), // Remove <p> tags from content
            },
            explanation_text: {
                id: null, // Assuming no direct mapping for explanation text ID
                type: 'HTML', // Assuming explanation for options is in HTML
                content: question.explanation, // Assuming no explanation provided for options
            },
        }));
    }

    // Extract correct option indices as strings
    let correctOptionIds;

    if (question?.questionType === QuestionType.MCQS) {
        correctOptionIds = question?.singleChoiceOptions
            ?.map((opt, idx) => (opt.isSelected ? (opt.id ? opt.id : idx.toString()) : null))
            .filter((idx) => idx !== null); // Remove null values
    } else if (question?.questionType === QuestionType.MCQM) {
        correctOptionIds = question?.multipleChoiceOptions
            ?.map((opt, idx) => (opt.isSelected ? (opt.id ? opt.id : idx.toString()) : null))
            .filter((idx) => idx !== null); // Remove null values
    } else if (question?.questionType === QuestionType.CMCQS) {
        correctOptionIds = question?.csingleChoiceOptions
            ?.map((opt, idx) => (opt.isSelected ? (opt.id ? opt.id : idx.toString()) : null))
            .filter((idx) => idx !== null); // Remove null values
    } else if (question?.questionType === QuestionType.CMCQM) {
        correctOptionIds = question?.cmultipleChoiceOptions
            ?.map((opt, idx) => (opt.isSelected ? (opt.id ? opt.id : idx.toString()) : null))
            .filter((idx) => idx !== null); // Remove null values
    } else if (question?.questionType === QuestionType.TRUE_FALSE) {
        correctOptionIds = question?.trueFalseOptions
            ?.map((opt, idx) => (opt.isSelected ? (opt.id ? opt.id : idx.toString()) : null))
            .filter((idx) => idx !== null); // Remove null values
    }

    const auto_evaluation_json = getEvaluationJSON(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        question!,
        correctOptionIds,
        question?.validAnswers,
        question?.subjectiveAnswerText
    );

    return {
        id: sourceId ? sourceId : crypto.randomUUID(),
        parent_rich_text: generateTextBlock(question?.parentRichTextContent || ''),
        text_data: generateTextBlock(question?.questionName || ''),
        explanation_text_data: generateTextBlock(question?.explanation || ''),
        media_id: '',
        question_response_type: 'OPTION',
        question_type: question?.questionType,
        access_level: 'PUBLIC',
        auto_evaluation_json: auto_evaluation_json,
        evaluation_type: 'AUTO',
        default_question_time_mins: parseInt(question?.questionDuration?.min || '0'),
        re_attempt_count: question?.reattemptCount || '',
        points: '0',
        options: options?.map((opt, idx) => ({
            id: opt?.id || '',
            preview_id: opt?.id || idx,
            questionSlideId: '',
            text: generateTextBlock(opt?.text?.content || ''),
            explanationTextData: generateTextBlock(opt?.explanation_text?.content || ''),
            mediaId: '',
        })),
        source_type: 'QUESTION',
    };
}

export function convertToQuestionBackendSlideFormat({
    activeItem,
    status,
    notify,
    newSlide,
}: {
    activeItem: Slide;
    status: string;
    notify: boolean;
    newSlide: boolean;
}) {
    return {
        id: activeItem?.id || '',
        title: activeItem?.title || '',
        description: activeItem?.description || '',
        image_file_id: activeItem?.image_file_id || '',
        source_id: activeItem?.source_id || '',
        source_type: activeItem?.source_type || '',
        status: status,
        slide_order: 0,
        video_slide: null,
        document_slide: null,
        question_slide: activeItem.question_slide
            ? convertToQuestionSlideFormat(activeItem.question_slide as any, activeItem?.source_id)
            : null,
        assignment_slide: null,
        is_loaded: true,
        new_slide: newSlide,
        notify,
    };
}
export function convertToQuizBackendSlideFormat({
    activeItem,
    status,
    notify,
    newSlide,
}: {
    activeItem: Slide;
    status: string;
    notify: boolean;
    newSlide: boolean;
}) {
    return {
        id: activeItem?.id || '',
        title: activeItem?.title || '',
        description: activeItem?.description || '',
        image_file_id: activeItem?.image_file_id || '',
        source_id: activeItem?.source_id || '',
        source_type: activeItem?.source_type || 'QUIZE',
        status: status,
        slide_order: 0,
        video_slide: null,
        document_slide: null,
        question_slide: null,
        quiz_slide: activeItem?.quiz_slide
            ? convertToQuizSlideFormat(activeItem.quiz_slide.questions as any, activeItem?.source_id)
            : null,
        assignment_slide: null,
        is_loaded: true,
        new_slide: newSlide,
        notify,
    };
}

export function timestampToSeconds(timestamp: string | undefined): number {
    if (!timestamp) return 0;
    const [hours = 0, minutes = 0, seconds = 0] = timestamp.split(':').map(Number);
    return hours * 3600 + minutes * 60 + seconds;
}

const transformAssignmentSlide = (assignment: AssignmentSlide) => {
    return {
        id: assignment?.id,
        task: parseHtmlToString(assignment?.text_data?.content || ''),
        taskDescription: assignment?.parent_rich_text?.content || '',
        startDate: convertDateFormat(assignment?.live_date || ''),
        endDate: convertDateFormat(assignment?.end_date || ''),
        reattemptCount: String(assignment?.re_attempt_count || 0),
        uploaded_question_paper: null,
        adaptive_marking_for_each_question:
            assignment?.questions?.map((question) => {
                return {
                    questionId: question?.id || '',
                    questionName: question?.text_data?.content || '',
                    questionType: question?.question_type || '',
                    newQuestion: question?.new_question || false,
                };
            }) || [],
        totalParticipants: 0,
        submittedParticipants: 0,
    };
};

export function cleanVideoQuestions(data: Slide[]) {


    if (!data || !Array.isArray(data)) {

        return [];
    }

    // Fix null slide_order issues
    const dataWithFixedOrder = data.map((item, index) => {
        if (item.slide_order == null) {

            return { ...item, slide_order: index };
        }
        return item;
    });

    // Sort by slide_order to ensure proper ordering
    const sortedData = dataWithFixedOrder.sort(
        (a, b) => (a.slide_order || 0) - (b.slide_order || 0)
    );

    const cleanedData = sortedData.map((item, index) => {
        try {
            if (item.source_type === 'VIDEO' && item.video_slide) {
                // Check if this is a split screen video slide
                const videoSlide = item.video_slide as any;
                if (videoSlide.embedded_type && videoSlide.embedded_data) {
                    try {
                        // Parse the embedded data to reconstruct split screen slide
                        const splitScreenData = JSON.parse(videoSlide.embedded_data);

                        return {
                            ...item,
                            splitScreenMode: true,
                            splitScreenData: splitScreenData,
                            splitScreenType: `SPLIT_${videoSlide.embedded_type}`,
                            isNewSplitScreen: false, // Existing slides loaded from backend are not new
                            originalVideoSlide: {
                                ...videoSlide,
                                // Remove embedded fields from the original video slide
                                embedded_type: undefined,
                                embedded_data: undefined,
                            },
                            video_slide: {
                                ...videoSlide,
                                questions: transformResponseDataToMyQuestionsSchema(
                                    (videoSlide.questions as any) || []
                                ),
                            },
                        };
                    } catch (error) {

                        // Fall back to regular video slide if parsing fails
                        return {
                            ...item,
                            video_slide: {
                                ...item.video_slide,
                                questions: transformResponseDataToMyQuestionsSchema(
                                    (item.video_slide.questions as any) || []
                                ),
                            },
                        };
                    }
                }

                // Regular video slide processing
                return {
                    ...item,
                    video_slide: {
                        ...item.video_slide,

                        questions: transformResponseDataToMyQuestionsSchema(
                            (item.video_slide.questions as any) || []
                        ),
                    },
                };
            }
            if (item.source_type === 'QUESTION') {
                return {
                    ...item,
                    question_slide: transformResponseDataToMyQuestionsSchemaSingleQuestion(
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-expect-error
                        item.question_slide
                    ),
                };
            }
            if (item.source_type === 'ASSIGNMENT') {
                return {
                    ...item,
                    assignment_slide: transformAssignmentSlide(
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-expect-error
                        item.assignment_slide
                    ),
                };
            }
            if (item.source_type === 'QUIZE') {
                return {
                    ...item,
                    quiz_slide: {
                        ...item.quiz_slide,
                        questions: transformResponseDataToMyQuestionsSchema(
                            (item?.quiz_slide?.questions as any) || []
                        ),
                    },
                };
            }

            return item;
        } catch (error) {

            // Return the item as-is if transformation fails
            return item;
        }
    });

    return cleanedData;
}

export function convertToQuizSlideFormat(questionList: MyQuestion[], sourceId?: string) {
  const quizSlideId = sourceId ?? crypto.randomUUID();

  return {
    id: quizSlideId,
    title: 'Untitled Quiz',
    description: generateTextBlock(''),
    questions: questionList.map((q, index) => {
      // Get the appropriate options based on question type
      let options: any[] = [];
      let correctOptionIds: string[] = [];

      if (q.questionType === 'MCQS') {
        options = q.singleChoiceOptions?.map((opt, idx) => ({
          id: opt.id ?? crypto.randomUUID(),
          quiz_slide_question_id: '', // Backend will assign
          text: generateTextBlock(opt.name || ''),
          explanation_text: generateTextBlock(q.explanation || ''),
          media_id: '',
        })) || [];

        correctOptionIds = q.singleChoiceOptions
          ?.map((opt, idx) => (opt.isSelected ? opt.id ?? idx.toString() : null))
          .filter((id): id is string => id !== null) || [];
      } else if (q.questionType === 'MCQM') {
        options = q.multipleChoiceOptions?.map((opt, idx) => ({
          id: opt.id ?? crypto.randomUUID(),
          quiz_slide_question_id: '', // Backend will assign
          text: generateTextBlock(opt.name || ''),
          explanation_text: generateTextBlock(q.explanation || ''),
          media_id: '',
        })) || [];

        correctOptionIds = q.multipleChoiceOptions
          ?.map((opt, idx) => (opt.isSelected ? opt.id ?? idx.toString() : null))
          .filter((id): id is string => id !== null) || [];
      } else if (q.questionType === 'TRUE_FALSE') {
        options = q.trueFalseOptions?.map((opt, idx) => ({
          id: opt.id ?? crypto.randomUUID(),
          quiz_slide_question_id: '', // Backend will assign
          text: generateTextBlock(idx === 0 ? 'TRUE' : 'FALSE'),
          explanation_text: generateTextBlock(q.explanation || ''),
          media_id: '',
        })) || [];

        correctOptionIds = q.trueFalseOptions
          ?.map((opt, idx) => (opt.isSelected ? opt.id ?? idx.toString() : null))
          .filter((id): id is string => id !== null) || [];
      }

      return {
        id: q.id ?? crypto.randomUUID(),
        parent_rich_text: generateTextBlock(q.parentRichTextContent || ''),
        text: generateTextBlock(q.questionName || ''),
        explanation_text: generateTextBlock(q.explanation || ''),
        media_id: '',
        status: q.status ?? 'DRAFT',
        question_response_type: 'SINGLE', // or derive from q.responseType
        question_type: q.questionType || 'MCQ',
        access_level: 'INSTITUTE',
        auto_evaluation_json: JSON.stringify({ correct: correctOptionIds }),
        evaluation_type: 'AUTO',
        question_order: index,
        quiz_slide_id: quizSlideId,
        can_skip: q.canSkip ?? true,
        options,
      };
    }),
  };
}
export function generateTextBlock(content: string) {
  return {
    id: crypto.randomUUID(),
    type: 'HTML',
    content: content,
  };
}
