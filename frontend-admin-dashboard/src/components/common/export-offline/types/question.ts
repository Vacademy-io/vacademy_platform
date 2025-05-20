export interface Section {
    id: string;
    title: string;
    description: string;
    totalMarks: number;
    duration: number;
    questions: Question[];
}

export interface Question {
    question_id: string;
    question: {
        id: string;
        type: string;
        content: string;
    };
    options_with_explanation: Array<{
        id: string;
        text: {
            content: string;
        };
    }>;
    marking_json: string;
    question_type: string;
    section_id: string;
    question_duration: number;
    question_order: number;
}

export type CustomFieldType = "blank" | "blocks" | "input" | "checkbox";
export interface CustomField {
    label: string;
    enabled: boolean;
    type: CustomFieldType;
    numberOfBlocks?: number;
}
