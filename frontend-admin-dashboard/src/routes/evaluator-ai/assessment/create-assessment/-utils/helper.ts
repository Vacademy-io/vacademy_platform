import { Steps } from "@/types/assessments/assessment-data-type";
import sectionDetailsSchema from "./section-details-sechma";
import { z } from "zod";
import { AdaptiveMarking } from "../-hooks/getQuestionsDataForSection";

interface QuestionAndMarking {
    question_id?: string | undefined;
    marking_json?: string | undefined;
    question_duration_in_min?: number | undefined;
    question_order?: number | undefined;
}

interface Section {
    section_description_html: string;
    section_name: string;
    section_id: string;
    section_duration: number;
    section_order: number;
    total_marks: number;
    cutoff_marks: number;
    problem_randomization: boolean;
    question_and_marking: QuestionAndMarking[];
}

export function getStepKey({
    assessmentDetails,
    currentStep,
    key,
}: {
    assessmentDetails: Steps;
    currentStep: number;
    key: string;
}) {
    // Get the step_keys for the current step
    const stepKeys = assessmentDetails[currentStep]?.step_keys;

    if (!stepKeys) {
        return undefined; // Return undefined if step_keys does not exist
    }

    // Find the value for the key in step_keys
    for (const keyValuePair of stepKeys) {
        if (keyValuePair[key]) {
            return keyValuePair[key]; // Return "REQUIRED" or "OPTIONAL"
        }
    }

    return undefined; // Return undefined if the key is not found
}

export const parseHTMLIntoString = (htmlString: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, "text/html");
    return doc;
};

export const copyToClipboard = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
    } catch (err) {
        console.log("Failed to copy text. Please try again.");
    }
};

export function calculateTotalMarks(questions: AdaptiveMarking[]) {
    let totalMarks = 0;

    questions.forEach((question) => {
        const questionMark = parseFloat(question.questionMark);

        if (!isNaN(questionMark)) {
            totalMarks += questionMark;
        }
    });

    return String(totalMarks);
}

export const convertStep2Data = (data: z.infer<typeof sectionDetailsSchema>) => {
    return data.section.map((section, index) => ({
        section_description_html: section.section_description || "",
        section_name: section.sectionName,
        section_id: section.sectionId || "",
        section_duration:
            parseInt(section.section_duration.hrs) * 60 + parseInt(section.section_duration.min),
        section_order: index + 1,
        total_marks: parseInt(section.total_marks) || 0,
        cutoff_marks: section.cutoff_marks.checked ? parseInt(section.cutoff_marks.value) || 0 : 0,
        problem_randomization: section.problem_randomization,
        question_and_marking: section.adaptive_marking_for_each_question.map((question) => ({
            question_id: question.questionId,
            marking_json: JSON.stringify({
                data: {
                    totalMark: question.questionMark || "",
                },
            }),
        })),
    }));
};

export function classifySections(oldSectionData: Section[], newSectionData: Section[]) {
    const added_sections: Section[] = [];
    const updated_sections: Section[] = [];
    const deleted_sections: Section[] = [];

    // Step 1: Create a map for easy lookup by sectionId
    const oldSectionMap = oldSectionData.reduce(
        (acc, section) => {
            acc[section.section_id] = section;
            return acc;
        },
        {} as { [key: string]: Section },
    );

    const newSectionMap = new Set(newSectionData.map((section) => section.section_id));

    // Step 2: Process new sections
    newSectionData.forEach((newSection, index) => {
        const oldSection = oldSectionMap[newSection.section_id];

        if (!newSection.section_id || !oldSection) {
            // Case 1: New section (either section_id is empty or doesn't exist in old data)
            added_sections.push({
                ...newSection,
                section_order: index + 1,
                total_marks: newSection.total_marks || 0,
                question_and_marking: newSection.question_and_marking?.map((item) => ({
                    ...item,
                    is_added: true,
                    is_deleted: false,
                    is_updated: false,
                })),
            });
        } else {
            // Case 2: Section exists in both old and new data - check for updates
            const hasChanged =
                oldSection?.section_description_html !== newSection.section_description_html ||
                oldSection?.section_name !== newSection.section_name ||
                oldSection?.section_duration !== newSection.section_duration ||
                oldSection?.total_marks !== newSection.total_marks ||
                oldSection?.cutoff_marks !== newSection.cutoff_marks ||
                oldSection?.problem_randomization !== newSection.problem_randomization;

            // Create maps for quick lookup
            const oldQuestionsMap = new Map(
                oldSection?.question_and_marking?.map((q) => [q.question_id, q]),
            );
            const newQuestionsMap = new Map(
                newSection?.question_and_marking?.map((q) => [q.question_id, q]),
            );

            const updatedQuestionAndMarking: QuestionAndMarking[] = [];

            // 1️⃣ Check for updated and deleted questions
            oldQuestionsMap.forEach((oldQuestion, questionId) => {
                if (newQuestionsMap.has(questionId)) {
                    const newQuestion = newQuestionsMap.get(questionId);
                    const isChanged = JSON.stringify(oldQuestion) !== JSON.stringify(newQuestion);
                    if (isChanged) {
                        updatedQuestionAndMarking.push({
                            ...newQuestion,
                        });
                    }
                } else {
                    // Question exists in oldData but not in newData (deleted)
                    updatedQuestionAndMarking.push({
                        ...oldQuestion,
                    });
                }
            });

            // 2️⃣ Check for newly added questions
            newQuestionsMap.forEach((newQuestion, questionId) => {
                if (!oldQuestionsMap.has(questionId)) {
                    updatedQuestionAndMarking.push({
                        ...newQuestion,
                    });
                }
            });

            // If there are any updates or section-level changes, add to updated_sections
            if (hasChanged || updatedQuestionAndMarking.length > 0) {
                updated_sections.push({
                    ...newSection,
                    section_order: index + 1,
                    question_and_marking: updatedQuestionAndMarking,
                });
            }
        }
    });

    // Step 3: Identify deleted sections
    oldSectionData.forEach((oldSection) => {
        if (!newSectionMap.has(oldSection.section_id)) {
            deleted_sections.push({
                ...oldSection,
                question_and_marking: oldSection.question_and_marking?.map((item) => ({
                    ...item,
                    is_added: false,
                    is_deleted: true,
                    is_updated: false,
                })),
            });
        }
    });

    return { added_sections, updated_sections, deleted_sections };
}

export const isQuillContentEmpty = (content: string) => {
    if (!content) return true;

    // Check for common Quill empty patterns
    if (content === "<p><br></p>" || content === "<p></p>") return true;

    // Strip all HTML tags and check if there's any text content left
    const textOnly = content.replace(/<[^>]*>/g, "").trim();
    return textOnly.length === 0;
};
