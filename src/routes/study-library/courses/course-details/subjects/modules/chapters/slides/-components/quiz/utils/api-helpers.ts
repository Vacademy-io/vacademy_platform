import { UploadQuestionPaperFormType } from '@/routes/assessment/question-papers/-components/QuestionPaperUpload';
import { QuizSlidePayload, QuizSlideQuestion } from '../../../-hooks/use-slides';
import { Slide } from '../types';

// Helper function to create option structure
const createOptionStructure = (option: any) => ({
    id: option.id || crypto.randomUUID(),
    quiz_slide_question_id: '',
    text: { id: '', type: 'TEXT', content: option.name || '' },
    explanation_text: { id: '', type: 'TEXT', content: '' },
    explanation_text_data: { id: '', type: 'TEXT', content: '' }, // Added for backend compatibility
    media_id: '',
});

// Helper to get correct answer indices for MCQ/CMCQ/TRUE_FALSE
const getCorrectAnswerIndices = (question: any): number[] => {
    let opts = [];
    if (question.questionType === 'MCQS' || question.questionType === 'CMCQS') {
        opts = (question.singleChoiceOptions || question.csingleChoiceOptions || []).slice(0, 4);
    } else if (question.questionType === 'MCQM' || question.questionType === 'CMCQM') {
        opts = (question.multipleChoiceOptions || question.cmultipleChoiceOptions || []).slice(
            0,
            4
        );
    } else if (question.questionType === 'TRUE_FALSE') {
        opts = question.trueFalseOptions || [];
    }
    return opts
        .map((opt: any, idx: number) => (opt.isSelected ? idx : null))
        .filter((idx: number | null) => idx !== null);
};

// Helper function to determine question response type and evaluation type
const getQuestionResponseConfig = (
    questionType: string
): { questionResponseType: string; evaluationType: string } => {
    switch (questionType) {
        case 'NUMERIC':
        case 'CNUMERIC':
            return { questionResponseType: 'NUMERIC', evaluationType: 'AUTO' };
        case 'LONG_ANSWER':
            return { questionResponseType: 'TEXT', evaluationType: 'MANUAL' };
        case 'ONE_WORD':
            return { questionResponseType: 'TEXT', evaluationType: 'AUTO' };
        default:
            return { questionResponseType: 'OPTION', evaluationType: 'AUTO' };
    }
};

// Helper function to transform options based on question type
const transformOptionsByType = (
    question: any
): Array<{
    id: string;
    quiz_slide_question_id: string;
    text: { id: string; type: string; content: string };
    explanation_text: { id: string; type: string; content: string };
    explanation_text_data: { id: string; type: string; content: string };
    media_id: string;
}> => {
    switch (question.questionType) {
        case 'MCQS':
            return (question.singleChoiceOptions || []).slice(0, 4).map(createOptionStructure);
        case 'MCQM':
            return (question.multipleChoiceOptions || []).slice(0, 4).map(createOptionStructure);
        case 'CMCQS':
            return (question.csingleChoiceOptions || []).slice(0, 4).map(createOptionStructure);
        case 'CMCQM':
            return (question.cmultipleChoiceOptions || []).slice(0, 4).map(createOptionStructure);
        case 'TRUE_FALSE':
            return (question.trueFalseOptions || []).map(createOptionStructure);
        default:
            return (question.singleChoiceOptions || []).slice(0, 4).map(createOptionStructure);
    }
};

// Helper function to create auto evaluation JSON
const createAutoEvaluationJson = (question: any): string => {
    if (
        question.questionType === 'MCQS' ||
        question.questionType === 'MCQM' ||
        question.questionType === 'CMCQS' ||
        question.questionType === 'CMCQM' ||
        question.questionType === 'TRUE_FALSE'
    ) {
        // Use selected indices for correct answers
        const correctAnswers = getCorrectAnswerIndices(question);
        if (correctAnswers.length > 0) {
            return JSON.stringify({ correctAnswers });
        }
    }
    if (question.questionType === 'LONG_ANSWER' || question.questionType === 'ONE_WORD') {
        if (question.subjectiveAnswerText && question.subjectiveAnswerText.trim() !== '') {
            const autoEvaluationJson = JSON.stringify({
                data: {
                    answer:
                        question.questionType === 'LONG_ANSWER'
                            ? { content: question.subjectiveAnswerText }
                            : question.subjectiveAnswerText,
                },
            });
            return autoEvaluationJson;
        } else if (question.validAnswers && question.validAnswers.length > 0) {
            return JSON.stringify({ correctAnswers: question.validAnswers });
        }
    } else if (question.validAnswers && question.validAnswers.length > 0) {
        return JSON.stringify({ correctAnswers: question.validAnswers });
    }
    return '';
};

// Helper function to calculate question time in milliseconds
const calculateQuestionTimeInMillis = (question: any): number => {
    const duration = question.questionDuration;
    if (duration) {
        const hours = parseInt(duration.hrs || '0') * 60 * 60 * 1000; // Convert hours to milliseconds
        const minutes = parseInt(duration.min || '0') * 60 * 1000; // Convert minutes to milliseconds
        return hours + minutes;
    }
    return 0; // Default to 0 if no duration specified
};

// Helper function to create question structure
const createQuestionStructure = (
    question: any,
    index: number,
    options: any[],
    questionResponseType: string,
    evaluationType: string
): QuizSlideQuestion => {
    const explanationContent = question.explanation || '';
    let textContent = question.questionName || '';
    let parentRichTextContent = '';
    let parentRichTextId = '';
    let textId = '';
    let textDataId = '';
    let explanationTextId = '';
    let explanationTextDataId = '';

    if (
        question.questionType === 'CMCQS' ||
        question.questionType === 'CMCQM' ||
        question.questionType === 'CNUMERIC'
    ) {
        parentRichTextContent =
            question.comprehensionText ||
            question.passage ||
            question.parentRichTextContent ||
            question.text?.content ||
            question.text_data?.content ||
            '';
        parentRichTextId =
            question.parent_rich_text?.id || question.parentRichTextId || crypto.randomUUID();
        textContent = question.questionName || question.questionText || '';
        textId = question.text?.id || question.textId || crypto.randomUUID();
        textDataId = question.text_data?.id || question.textDataId || crypto.randomUUID();
    } else {
        parentRichTextContent = '';
        parentRichTextId = crypto.randomUUID();
        textContent = question.questionName || question.questionText || '';
        textId = question.text?.id || question.textId || crypto.randomUUID();
        textDataId = question.text_data?.id || question.textDataId || crypto.randomUUID();
    }
    explanationTextId =
        question.explanation_text?.id || question.explanationTextId || crypto.randomUUID();
    explanationTextDataId =
        question.explanation_text_data?.id || question.explanationTextDataId || crypto.randomUUID();

    console.log('[API Helpers] Creating question structure:', {
        questionId: question.id,
        questionName: question.questionName,
        explanation: explanationContent,
        explanationLength: explanationContent.length,
        questionType: question.questionType,
        index: index,
    });

    const questionStructure = {
        id: question.id || crypto.randomUUID(),
        parent_rich_text: {
            id: parentRichTextId,
            type: 'TEXT',
            content: parentRichTextContent,
        },
        text: { id: textId, type: 'TEXT', content: textContent },
        text_data: { id: textDataId, type: 'TEXT', content: textContent },
        explanation_text: {
            id: explanationTextId,
            type: 'TEXT',
            content: explanationContent,
        },
        explanation_text_data: {
            id: explanationTextDataId,
            type: 'TEXT',
            content: explanationContent,
        },
        media_id: '',
        status: question.status || 'ACTIVE',
        question_response_type: questionResponseType,
        question_type: question.questionType,
        questionType: question.questionType, // Fix: Add questionType field for backend compatibility
        access_level: 'INSTITUTE',
        auto_evaluation_json: createAutoEvaluationJson(question),
        evaluation_type: evaluationType,
        question_time_in_millis: calculateQuestionTimeInMillis(question),
        question_order: index + 1,
        quiz_slide_id: '', // This will be set by the caller
        can_skip: question.canSkip || false,
        new_question: true, // Added for backend compatibility
        marks: question.marks != null ? question.marks : (question.questionMark ? parseFloat(question.questionMark) : null),
        negative_marking: question.negativeMarking != null ? question.negativeMarking : (question.questionPenalty ? parseFloat(question.questionPenalty) : null),
        options: options,
    };

    console.log('[API Helpers] Created question structure:', {
        questionId: questionStructure.id,
        explanation_text: questionStructure.explanation_text,
        explanation_text_data: questionStructure.explanation_text_data,
        hasExplanation: !!explanationContent,
        explanationContent: explanationContent,
    });

    return questionStructure;
};

// Helper function to transform form questions to backend format
export const transformFormQuestionsToBackend = (
    questions: UploadQuestionPaperFormType['questions']
): QuizSlideQuestion[] => {
    return questions.map((question, index) => {
        const { questionResponseType, evaluationType } = getQuestionResponseConfig(
            question.questionType
        );
        const options = transformOptionsByType(question);

        return createQuestionStructure(
            question,
            index,
            options,
            questionResponseType,
            evaluationType
        );
    });
};

export interface QuizSettings {
    timeLimitInMinutes?: number | null;
    marksPerQuestion?: number;
    negativeMarking?: number;
}

// Helper function to create quiz slide payload for API
export const createQuizSlidePayload = (
    questions: UploadQuestionPaperFormType['questions'],
    activeItem: Slide,
    settings?: QuizSettings
): QuizSlidePayload => {
    const transformedQuestions = transformFormQuestionsToBackend(questions);

    console.log('[API Helpers] Creating quiz slide payload:', {
        activeItemId: activeItem.id,
        activeItemTitle: activeItem.title,
        questionsCount: questions.length,
        transformedQuestionsCount: transformedQuestions.length,
        questionsWithExplanations: transformedQuestions.filter(
            (q) => q.explanation_text.content || q.explanation_text_data.content
        ).length,
        allExplanations: transformedQuestions.map((q) => ({
            questionId: q.id,
            explanation_text: q.explanation_text,
            explanation_text_data: q.explanation_text_data,
            hasExplanation: !!(q.explanation_text.content || q.explanation_text_data.content),
            explanationContent: q.explanation_text.content,
            explanationDataContent: q.explanation_text_data.content,
        })),
    });

    const payload = {
        id: activeItem.id,
        source_id: activeItem.source_id || '',
        source_type: activeItem.source_type || 'QUIZ',
        title: activeItem.title || 'Quiz',
        image_file_id: activeItem.image_file_id || '',
        description: activeItem.description || '',
        status: activeItem.status || 'DRAFT',
        slide_order: activeItem.slide_order || 0,
        video_slide: null,
        document_slide: null,
        question_slide: null,
        assignment_slide: null,
        quiz_slide: {
            id: activeItem.quiz_slide?.id || crypto.randomUUID(),
            title: activeItem.quiz_slide?.title || activeItem.title || 'Quiz',
            description: activeItem.quiz_slide?.description || {
                id: '',
                content: '',
                type: 'TEXT',
            },
            time_limit_in_minutes:
                settings?.timeLimitInMinutes !== undefined
                    ? settings.timeLimitInMinutes
                    : (activeItem.quiz_slide?.time_limit_in_minutes ?? null),
            marks_per_question:
                settings?.marksPerQuestion !== undefined
                    ? settings.marksPerQuestion
                    : (activeItem.quiz_slide?.marks_per_question ?? 1),
            negative_marking:
                settings?.negativeMarking !== undefined
                    ? settings.negativeMarking
                    : (activeItem.quiz_slide?.negative_marking ?? 0),
            questions: transformedQuestions,
        },
        is_loaded: true,
        new_slide: false,
    };

    console.log('[API Helpers] Final payload created:', {
        payloadId: payload.id,
        quizSlideId: payload.quiz_slide.id,
        questionsInPayload: payload.quiz_slide.questions.length,
        explanationsInPayload: payload.quiz_slide.questions.map((q) => ({
            questionId: q.id,
            explanation_text: q.explanation_text,
            explanation_text_data: q.explanation_text_data,
            explanationContent: q.explanation_text.content,
            explanationDataContent: q.explanation_text_data.content,
        })),
    });

    return payload;
};
