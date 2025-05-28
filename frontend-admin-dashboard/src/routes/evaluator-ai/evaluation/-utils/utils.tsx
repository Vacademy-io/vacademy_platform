interface EvaluationData {
    user_id: string;
    name: string;
    email: string;
    contact_number: string | null;
    response_id: string;
    section_wise_ans_extracted: SectionWiseAnsExtracted[];
    evaluation_result: EvaluationResult;
    status: "EXTRACTING_ANSWER" | "EVALUATING" | "EVALUATION_COMPLETED";
}

export interface SectionWiseAnsExtracted {
    section_id: string;
    section_name: string;
    question_wise_ans_extracted: QuestionWiseAnsExtracted[];
}

export interface QuestionWiseAnsExtracted {
    question_id: string;
    question_order: number;
    question_text: string;
    answer_html: string;
    status: string;
}

export interface EvaluationResult {
    total_marks_obtained: number;
    total_marks: number;
    overall_verdict: string;
    overall_description: string;
    section_wise_results: SectionWiseResult[];
}

export interface SectionWiseResult {
    section_id: string;
    section_name: string;
    marks_obtained: number;
    total_marks: number;
    verdict: string;
    question_wise_results: QuestionWiseResult[];
}

export interface QuestionWiseResult {
    question_id: string;
    question_order: number;
    question_text: string;
    marks_obtained: number;
    total_marks: number;
    feedback: string;
    description: string;
    verdict: string;
}
export interface ApiResponse {
    task_id: string;
    response: string; // JSON string
    status: string;
}

export interface Student {
    id: string;
    name: string;
    enrollmentId: string;
    assessment: string | null;
    assessmentId: string;
    responseId: string;
    status: "EXTRACTING_ANSWER" | "EVALUATING" | "EVALUATION_COMPLETED" | "WAITING";
    marks: string | null;
    extracted: SectionWiseAnsExtracted[];
}

export function parseEvaluationResults(data: ApiResponse): EvaluationData[] {
    try {
        const parsed = JSON.parse(data.response);
        return parsed.evaluation_data as EvaluationData[];
    } catch (error) {
        console.error("Failed to parse evaluation results:", error);
        return [];
    }
}

export function transformEvaluationData(
    pasrsedData: EvaluationData[],
    assessmentId: string,
): Student[] {
    if (!pasrsedData) return [];

    return pasrsedData.map((result, index) => {
        return {
            id: result.user_id || `temp-${index + 1}`,
            name: result.name || "Unknown Student",
            enrollmentId: result.user_id || `enroll-${index + 1}`,
            assessment: "Section 1",
            responseId: result.response_id,
            assessmentId: assessmentId,
            status: result.status,
            summary: result,
            extracted: result.section_wise_ans_extracted,
            marks: result.evaluation_result
                ? `${result.evaluation_result.total_marks_obtained}/${result.evaluation_result.total_marks}`
                : null,
        };
    });
}
