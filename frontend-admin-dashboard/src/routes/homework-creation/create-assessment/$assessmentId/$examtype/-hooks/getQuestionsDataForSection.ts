import { useSuspenseQuery } from "@tanstack/react-query";
import { getQuestionDataForSection } from "../-services/assessment-services";

interface QuestionData {
    question_id: string;
    question: {
        content: string;
    };
    question_type: string;
    question_duration: string | number;
    marking_json: string;
}

export interface AdaptiveMarking {
    questionId: string;
    questionName: string;
    questionType: string;
    questionMark: string;
    questionPenalty: string;
    questionDuration: {
        hrs: string;
        min: string;
    };
}

export const useQuestionsForSection = (
    assessmentId: string,
    sectionId: string,
): { adaptiveMarking: AdaptiveMarking[]; isLoading: boolean } => {
    const { data: questionsData, isLoading } = useSuspenseQuery(
        getQuestionDataForSection({
            assessmentId,
            sectionIds: sectionId,
        }),
    );

    // Map questions to adaptive_marking_for_each_question format
    const adaptiveMarking = (questionsData[sectionId] || []).map(
        (questionData: QuestionData): AdaptiveMarking => {
            const markingJson = questionData.marking_json
                ? JSON.parse(questionData.marking_json)
                : {};
            return {
                questionId: questionData.question_id || "",
                questionName: questionData.question?.content || "",
                questionType: questionData.question_type || "",
                questionMark: markingJson.data?.totalMark || "0",
                questionPenalty: markingJson.data?.negativeMark || "0",
                questionDuration: {
                    hrs:
                        typeof questionData.question_duration === "number"
                            ? String(Math.floor(questionData.question_duration / 60))
                            : "0",
                    min:
                        typeof questionData.question_duration === "number"
                            ? String(questionData.question_duration % 60)
                            : "0",
                },
            };
        },
    );

    return { adaptiveMarking, isLoading };
};
