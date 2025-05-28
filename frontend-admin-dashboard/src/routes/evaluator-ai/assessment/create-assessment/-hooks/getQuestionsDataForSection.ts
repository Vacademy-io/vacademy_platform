import { useSuspenseQuery } from "@tanstack/react-query";
import { getAssessmentDetails } from "../-services/assessment-services";

export interface SectionResponse {
    id: string;
    name: string;
    description: {
        id: string;
        type: string;
        content: string;
    };
    total_marks: number;
    cut_of_marks: number;
    marks_per_question: number;
    section_order: number;
    questions: Array<{
        id: string;
        question_text: {
            id: string;
            type: string;
            content: string;
        };
        question_response_type: string;
        question_type: string;
        evaluation_type: string;
        explanation: {
            id: string;
            type: string;
            content: string;
        };
        marking_json: string;
        question_order: number;
        new_question: boolean;
    }>;
    new_section: boolean;
}
export interface ApiResponse {
    basic_details: {
        status: string;
        test_creation: {
            assessment_name: string;
            subject_id: string;
            assessment_instructions_html: string;
        };
        test_boundation: {
            start_date: string;
            end_date: string;
        };
        assessment_preview_time: number;
        switch_sections: boolean;
        submission_type: string;
        evaluation_type: string;
        raise_reattempt_request: boolean;
        raise_time_increase_request: boolean;
        has_omr_mode: boolean;
        default_reattempt_count: number;
        source: string;
        source_id: string;
    };
    sections: SectionResponse[];
}

export interface AdaptiveMarking {
    questionId?: string;
    questionName: string;
    questionMark: string;
}

export function useQuestionsForSection(
    assessmentId: string,
    sectionId: string,
): { adaptiveMarking: AdaptiveMarking[]; isLoading: boolean } {
    const { data: questionsData, isLoading } = useSuspenseQuery(
        getAssessmentDetails({
            assessmentId,
        }),
    );
    // Find the section with the specified ID
    const section = questionsData.sections.find((section) => section.id === sectionId);

    // If section is not found, return an empty array
    if (!section) {
        return { adaptiveMarking: [], isLoading };
    }

    // Map questions to AdaptiveMarking format
    const adaptiveMarking = section.questions.map((question) => {
        // Check if marking_json is a valid JSON string and extract marks
        let questionMark = section.marks_per_question.toString();

        try {
            if (question.marking_json) {
                const markingData = JSON.parse(question.marking_json);
                if (markingData && typeof markingData.marks !== "undefined") {
                    questionMark = markingData.marks.toString();
                }
            }
        } catch (error) {
            // In case of parsing error, use the section's marks_per_question
            console.error(`Error parsing marking_json for question ${question.id}`, error);
        }

        return {
            questionId: question.id,
            questionName: question.question_text.content || "",
            questionMark: questionMark,
        };
    });

    return { adaptiveMarking, isLoading };
}

// Example usage:
// const adaptiveMarkings = getQuestionForSection(apiResponseData, "section123");
