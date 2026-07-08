// Client for the AI coding-question generator (ai_service).
// POSTs a rough idea + options and returns a full coding-question config that
// the admin reviews (and the dialog self-verifies) before saving.

import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GENERATE_CODING_QUESTION } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import type { LangId } from '../constants/code-editor';

export interface GenerateCodingQuestionRequest {
    idea: string;
    allowed_languages: LangId[];
    difficulty: 'easy' | 'medium' | 'hard';
    num_test_cases: number;
    idempotency_key?: string;
}

export interface GeneratedTestCase {
    label?: string;
    input: string;
    accepted_outputs: string[];
    visible: boolean;
}

export interface GeneratedCodingQuestion {
    title: string;
    problem_html: string;
    allowed_languages: LangId[];
    starter_code: Partial<Record<LangId, string>>;
    test_cases: GeneratedTestCase[];
    solution: { language: LangId; source_code: string };
    settings: {
        max_points: number;
        cpu_seconds: number;
        memory_kb: number;
        session_time_minutes: number | null;
    };
    model_used: string;
}

export async function generateCodingQuestion(
    req: GenerateCodingQuestionRequest
): Promise<GeneratedCodingQuestion> {
    const instituteId = getCurrentInstituteId();
    const res = await authenticatedAxiosInstance.post<GeneratedCodingQuestion>(
        GENERATE_CODING_QUESTION,
        req,
        { params: instituteId ? { instituteId } : undefined }
    );
    return res.data;
}
