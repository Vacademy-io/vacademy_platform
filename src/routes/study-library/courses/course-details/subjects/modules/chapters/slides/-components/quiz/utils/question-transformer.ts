import { BackendQuestion, TransformedQuestion } from '../types';

// Helper function to parse auto_evaluation_json
export const parseValidAnswers = (question: BackendQuestion): number[] => {
    try {
        if (question.auto_evaluation_json) {
            const evaluationData = JSON.parse(question.auto_evaluation_json);
            console.log('[QuestionTransformer] Parsed auto_evaluation_json:', {
                evaluationData,
                correctAnswers: evaluationData.correctAnswers,
            });
            return evaluationData.correctAnswers || [];
        }
    } catch (error) {
        console.warn('[QuizPreview] Failed to parse auto_evaluation_json:', error);
    }
    return [];
};

// Helper function to get question text
export const getQuestionText = (question: BackendQuestion): string => {
    return (
        question.parent_rich_text?.content ||
        question.text?.content ||
        question.text_data?.content ||
        question.questionName ||
        ''
    );
};

// Helper function to transform options
export const transformOptions = (
    options: BackendQuestion['options'],
    validAnswers: number[]
): Array<{ id: string; name: string; isSelected: boolean }> => {
    if (!options || options.length === 0) return [];

    return options.map((opt, idx: number) => ({
        id: opt.id || `opt-${idx}`,
        name: opt.text?.content || opt.content || '',
        isSelected: validAnswers.includes(idx),
    }));
};

// Helper function to extract subjective answer from auto_evaluation_json
const extractSubjectiveAnswer = (question: BackendQuestion, questionType: string): string => {
    if (!question.auto_evaluation_json) return '';

    try {
        const evaluationData = JSON.parse(question.auto_evaluation_json);
        console.log(
            '[QuestionTransformer] Parsed auto_evaluation_json for',
            questionType,
            ':',
            evaluationData
        );

        let subjectiveAnswerText = '';
        if (questionType === 'ONE_WORD') {
            subjectiveAnswerText = evaluationData?.data?.answer || evaluationData?.answer || '';
        } else if (questionType === 'LONG_ANSWER') {
            subjectiveAnswerText =
                evaluationData?.data?.answer?.content ||
                evaluationData?.answer?.content ||
                evaluationData?.answer ||
                '';
        }

        console.log('[QuestionTransformer] Extracted subjectiveAnswerText:', subjectiveAnswerText);
        return subjectiveAnswerText;
    } catch (error) {
        console.warn('[QuizPreview] Failed to parse auto_evaluation_json:', error);
        return '';
    }
};

// Helper function to create base transformed question
const createBaseTransformedQuestion = (
    question: BackendQuestion | any,
    questionText: string,
    questionType: string,
    validAnswers: number[]
): TransformedQuestion => {
    // Prefer explanation_text_data, then explanation_text, then explanation
    const explanation =
        (question.explanation_text_data && question.explanation_text_data.content) ||
        (question.explanation_text && question.explanation_text.content) ||
        question.explanation ||
        '';

    // For comprehension types, set questionName to passage and ensure parentRichTextContent is set from parent_rich_text.content if present
    let finalQuestionName = questionText;
    let parentRichTextContent = '';
    if (
        (questionType === 'CMCQS' || questionType === 'CMCQM' || questionType === 'CNUMERIC') &&
        (question.parent_rich_text?.content ||
            question.comprehensionText ||
            question.passage ||
            question.text?.content ||
            question.text_data?.content)
    ) {
        parentRichTextContent =
            question.parent_rich_text?.content ||
            question.comprehensionText ||
            question.passage ||
            question.text?.content ||
            question.text_data?.content ||
            '';
        finalQuestionName = question.text?.content || question.questionName || '';
    } else {
        parentRichTextContent = '';
        finalQuestionName = question.text?.content || question.questionName || '';
    }

    console.log('[QuestionTransformer] Creating base transformed question:', {
        questionId: question.id,
        questionText: finalQuestionName,
        questionType: questionType,
        explanation: explanation,
        explanationLength: explanation.length,
        explanation_text: question.explanation_text,
        explanation_text_data: question.explanation_text_data,
        hasExplanation: !!explanation,
        backendExplanation: question.explanation,
        backendExplanationText: question.explanation_text,
        backendExplanationTextData: question.explanation_text_data,
    });

    return {
        questionName: finalQuestionName,
        questionType,
        questionPenalty: question.penalty || question.questionPenalty || '0',
        questionDuration: {
            min: '0',
            hrs: '0',
        },
        questionMark: question.mark || question.questionMark || '1',
        id: question.id,
        status: question.status,
        validAnswers: validAnswers.length > 0 ? validAnswers : undefined,
        explanation: explanation,
        canSkip: question.can_skip || question.canSkip || false,
        tags: question.tags || [],
        level: question.level,
        questionPoints: question.questionPoints,
        reattemptCount: question.reattemptCount,
        decimals: question.decimals,
        numericType: question.numericType,
        parentRichTextContent: parentRichTextContent,
        singleChoiceOptions: [],
        multipleChoiceOptions: [],
        trueFalseOptions: [],
        subjectiveAnswerText: '',
        marks: question.marks ?? null,
        negativeMarking: question.negative_marking ?? null,
    };
};

// Helper function to handle subjective questions
const handleSubjectiveQuestion = (
    transformed: TransformedQuestion,
    question: BackendQuestion | any,
    questionType: string,
    validAnswers: number[],
    subjectiveAnswerText: string
): void => {
    console.log('[QuestionTransformer] Processing subjective question:', {
        questionType,
        validAnswers,
        subjectiveAnswerText,
    });

    // Remove default validAnswers for subjective questions
    if (validAnswers.length === 0 || (validAnswers.length === 1 && validAnswers[0] === 0)) {
        transformed.validAnswers = undefined;
        console.log('[QuestionTransformer] Removed default validAnswers for subjective question');
    }

    // Set subjective answer text
    if (subjectiveAnswerText) {
        transformed.subjectiveAnswerText = subjectiveAnswerText;
    } else if (question.subjectiveAnswerText) {
        transformed.subjectiveAnswerText = question.subjectiveAnswerText;
    } else if (question.answerText) {
        // Check for answerText field from form
        transformed.subjectiveAnswerText = question.answerText;
    }

    console.log(`[QuestionTransformer] ${questionType} question processed:`, {
        subjectiveAnswerText: transformed.subjectiveAnswerText,
        questionData: question,
    });
};

// Helper function to handle numeric questions
const handleNumericQuestion = (transformed: TransformedQuestion, validAnswers: number[]): void => {
    transformed.subjectiveAnswerText = validAnswers.join(', ');
};

// Helper function to handle options for different question types
const handleQuestionOptions = (
    transformed: TransformedQuestion,
    question: BackendQuestion | any,
    questionType: string,
    validAnswers: number[]
): void => {
    console.log('[QuestionTransformer] handleQuestionOptions called:', {
        questionType,
        hasSingleChoiceOptions: !!question.singleChoiceOptions?.length,
        hasMultipleChoiceOptions: !!question.multipleChoiceOptions?.length,
        hasTrueFalseOptions: !!question.trueFalseOptions?.length,
        hasCSingleChoiceOptions: !!question.csingleChoiceOptions?.length,
        hasCMultipleChoiceOptions: !!question.cmultipleChoiceOptions?.length,
        hasOptions: !!question.options?.length,
        optionsLength: question.options?.length || 0,
        validAnswers,
    });

    // First check if it's form data (has the options arrays)
    if (question.singleChoiceOptions && question.singleChoiceOptions.length > 0) {
        transformed.singleChoiceOptions = question.singleChoiceOptions;
        console.log('[QuestionTransformer] Using singleChoiceOptions from form data');
    } else if (question.multipleChoiceOptions && question.multipleChoiceOptions.length > 0) {
        transformed.multipleChoiceOptions = question.multipleChoiceOptions;
        console.log('[QuestionTransformer] Using multipleChoiceOptions from form data');
    } else if (question.trueFalseOptions && question.trueFalseOptions.length > 0) {
        transformed.trueFalseOptions = question.trueFalseOptions;
        console.log('[QuestionTransformer] Using trueFalseOptions from form data');
    } else if (question.csingleChoiceOptions && question.csingleChoiceOptions.length > 0) {
        // Handle comprehensive single choice options
        transformed.singleChoiceOptions = question.csingleChoiceOptions;
        console.log('[QuestionTransformer] Using csingleChoiceOptions from form data');
    } else if (question.cmultipleChoiceOptions && question.cmultipleChoiceOptions.length > 0) {
        // Handle comprehensive multiple choice options
        transformed.multipleChoiceOptions = question.cmultipleChoiceOptions;
        console.log('[QuestionTransformer] Using cmultipleChoiceOptions from form data');
    }
    // Then check if it's backend data (has the options field)
    else if (question.options && question.options.length > 0) {
        const options = transformOptions(question.options, validAnswers);
        console.log('[QuestionTransformer] Using options from backend data:', options);

        if (questionType === 'MCQS' || questionType === 'CMCQS') {
            transformed.singleChoiceOptions = options;
            console.log('[QuestionTransformer] Set singleChoiceOptions for', questionType);
        } else if (questionType === 'MCQM' || questionType === 'CMCQM') {
            transformed.multipleChoiceOptions = options;
            console.log('[QuestionTransformer] Set multipleChoiceOptions for', questionType);
        } else if (questionType === 'TRUE_FALSE') {
            transformed.trueFalseOptions = options;
            console.log('[QuestionTransformer] Set trueFalseOptions for', questionType);
        }
    } else {
        console.log('[QuestionTransformer] No options found for question type:', questionType);
    }
};

// Main function to transform a single question
export const transformQuestion = (question: BackendQuestion | any): TransformedQuestion => {
    console.log('[QuestionTransformer] Starting transformation for question:', {
        id: question.id,
        questionType:
            question.question_type || question.question_response_type || question.questionType,
        hasOptions: !!question.options,
        optionsLength: question.options?.length || 0,
        hasAutoEvaluationJson: !!question.auto_evaluation_json,
        autoEvaluationJson: question.auto_evaluation_json,
        explanation: question.explanation,
        explanation_text: question.explanation_text,
        explanation_text_data: question.explanation_text_data,
        hasExplanation: !!(
            question.explanation ||
            question.explanation_text?.content ||
            question.explanation_text_data?.content
        ),
    });

    const validAnswers = parseValidAnswers(question);
    const questionText = getQuestionText(question);
    const questionType =
        question.question_type ||
        question.question_response_type ||
        question.questionType ||
        'MCQS';

    // Extract subjective answer from backend data
    const subjectiveAnswerText = extractSubjectiveAnswer(question, questionType);

    // Create base transformed question
    const transformed = createBaseTransformedQuestion(
        question,
        questionText,
        questionType,
        validAnswers
    );

    // Handle different question types
    if (questionType === 'NUMERIC' || questionType === 'CNUMERIC') {
        handleNumericQuestion(transformed, validAnswers);
    } else if (questionType === 'ONE_WORD' || questionType === 'LONG_ANSWER') {
        handleSubjectiveQuestion(
            transformed,
            question,
            questionType,
            validAnswers,
            subjectiveAnswerText
        );
    }

    // Handle options for all question types
    handleQuestionOptions(transformed, question, questionType, validAnswers);

    console.log('[QuestionTransformer] Final transformed question:', {
        questionType: transformed.questionType,
        hasSingleChoiceOptions: !!transformed.singleChoiceOptions?.length,
        hasMultipleChoiceOptions: !!transformed.multipleChoiceOptions?.length,
        hasTrueFalseOptions: !!transformed.trueFalseOptions?.length,
        validAnswers: transformed.validAnswers,
        subjectiveAnswerText: transformed.subjectiveAnswerText,
        explanation: transformed.explanation,
        explanationLength: transformed.explanation?.length || 0,
        hasExplanation: !!transformed.explanation,
    });

    return transformed;
};
