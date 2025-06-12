import { z } from "zod";
import { useAdaptiveMarkingStore } from "../-hooks/sectionData";
import sectionDetailsSchema from "./section-details-sechma";

interface TransformedQuestion {
    id: string;
    question_text: {
        id: string;
        type: "html";
        content: string;
    };
    criteria_json: string;
    spelling_check: boolean;
    grammer_check: boolean;
    difficulty: string;
    question_response_type: string;
    question_type: string;
    evaluation_type: string;
    explanation: {
        id: string;
        type: "html";
        content: string;
    };
    marking_json: string;
    question_order: number;
    new_question: boolean;
}

interface TransformedSection {
    id: string;
    name: string;
    description: {
        id: string;
        type: "html";
        content: string;
    };
    total_marks: number;
    cut_of_marks: number;
    marks_per_question: number;
    section_order: number;
    questions: TransformedQuestion[];
    new_section: boolean;
}

export const transformFormData = (
    formData: z.infer<typeof sectionDetailsSchema>,
): TransformedSection[] => {
    const adaptiveMarkingStore = useAdaptiveMarkingStore.getState();

    // @ts-expect-error :Type html is not assignable to type string
    return formData.section.map((section, sectionIndex) => {
        // Get questions from the store instead of form data
        const storeQuestions = adaptiveMarkingStore.getSectionQuestions(sectionIndex);

        const questions = storeQuestions.map((question, questionIndex) => {
            const criteria = adaptiveMarkingStore.getQuestionCriteria(sectionIndex, questionIndex);

            return {
                id: question.questionId || `q-${sectionIndex}-${questionIndex}`,
                question_text: {
                    id: `qt-${sectionIndex}-${questionIndex}`,
                    type: "html",
                    content: question.questionName,
                },
                criteria_json: JSON.stringify(criteria),
                spelling_check: false,
                grammer_check: false,
                difficulty: "MEDIUM",
                question_response_type: "DESCRIPTIVE",
                question_type: "SUBJECTIVE",
                evaluation_type: "AI",
                explanation: {
                    id: `exp-${sectionIndex}-${questionIndex}`,
                    type: "html",
                    content: question.validAnswers || "",
                },
                marking_json: JSON.stringify({
                    total_marks: Number(question.questionMark),
                    criteria: criteria,
                }),
                question_order: questionIndex + 1,
                new_question: true,
            };
        });

        return {
            id: section.sectionId || `sec-${sectionIndex}`,
            name: section.sectionName,
            description: {
                id: `desc-${sectionIndex}`,
                type: "html",
                content: section.section_description,
            },
            total_marks: Number(section.total_marks),
            cut_of_marks: Number(section.cutoff_marks.value),
            marks_per_question: Number(section.marks_per_question),
            section_order: sectionIndex + 1,
            questions,
            new_section: true,
        };
    });
};
