// Adapter: recording assessment artifact questions  →  quiz-slide questions.
//
// The recording AI artifact gives each question as the compact
// `GeneratedQuestion` shape ({ question, options[], correctAnswerIndex,
// explanation }) where `question` and each option are HTML strings (the
// assessment preview renders them with dangerouslySetInnerHTML).
//
// The quiz slide backend wants the verbose `QuizSlideQuestion` shape. Rather
// than hand-roll that here, we map each GeneratedQuestion onto the
// upload-question-paper *form* shape and run it through the canonical
// `transformFormQuestionsToBackend` encoder — the same one the quiz editor
// uses. That keeps the correct-answer encoding (auto_evaluation_json with
// option IDs) identical to every other quiz slide in the product.

import type { UploadQuestionPaperFormType } from '@/routes/assessment/question-papers/-components/QuestionPaperUpload';
import {
    transformFormQuestionsToBackend,
} from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/quiz/utils/api-helpers';
import type { QuizSlideQuestion } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-hooks/use-slides';
import type { GeneratedQuestion } from '../../-services/utils';

type FormQuestions = UploadQuestionPaperFormType['questions'];

/**
 * Convert recording-generated MCQs into quiz-slide questions.
 * Every generated question is single-correct (MCQS). A null correctAnswerIndex
 * (the AI couldn't decide) yields a question with no marked answer — the
 * encoder leaves auto_evaluation_json empty and the teacher can set it later
 * in the slide editor; we never guess a wrong "correct" option.
 */
export const transformGeneratedQuestions = (
    questions: GeneratedQuestion[]
): QuizSlideQuestion[] => {
    const formQuestions = questions.map((q) => ({
        id: q.id || crypto.randomUUID(),
        questionName: q.question || '',
        questionType: 'MCQS',
        explanation: q.explanation || '',
        questionPenalty: '0',
        questionDuration: { hrs: '0', min: '0' },
        canSkip: false,
        singleChoiceOptions: (q.options || []).map((opt, i) => ({
            id: crypto.randomUUID(),
            name: opt || '',
            isSelected: q.correctAnswerIndex === i,
        })),
    }));

    // The form shape we build is a faithful subset of a real form question;
    // the encoder only reads these fields. Cast through unknown since we
    // intentionally omit fields the encoder never touches.
    return transformFormQuestionsToBackend(formQuestions as unknown as FormQuestions);
};

/** How many of the given questions have a usable correct answer set. */
export const countAnswerable = (questions: GeneratedQuestion[]): number =>
    questions.filter(
        (q) =>
            q.correctAnswerIndex !== null &&
            q.correctAnswerIndex >= 0 &&
            q.correctAnswerIndex < (q.options?.length ?? 0)
    ).length;
