import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';

const ASSIST_BASE = `${BASE_URL}/admin-core-service/v1/telephony/ai-agents/assist`;

/** Flat cost per assist operation (mirrors backend AiAgentAssistService.COST). */
export const AGENT_ASSIST_CREDIT_COST = 1;

export interface AssistDimension {
    key: string;
    label: string;
    score: number;
    comment?: string;
}

export interface AssistSuggestion {
    title: string;
    detail?: string;
    addition: string;
}

export interface AssistDerived {
    opening_line?: string;
    extraction_questions?: string[];
    dispositions?: string[];
}

export interface AssistAnalysis {
    score: number;
    persona?: string;
    dimensions?: AssistDimension[];
    suggestions?: AssistSuggestion[];
    derived?: AssistDerived;
    /** draft / improve / feedback also return the (new) prompt. */
    prompt?: string;
    /** feedback only. */
    change_summary?: string;
    call_insights?: string[];
}

const post = async (path: string, body: Record<string, unknown>): Promise<AssistAnalysis> => {
    const { data } = await authenticatedAxiosInstance.post<AssistAnalysis>(
        `${ASSIST_BASE}/${path}`,
        body
    );
    return data;
};

export const draftAgentPrompt = (instituteId: string, brief: string, language?: string) =>
    post('draft', { instituteId, brief, language });

export const analyzeAgentPrompt = (instituteId: string, prompt: string) =>
    post('analyze', { instituteId, prompt });

export const improveAgentPrompt = (instituteId: string, prompt: string, additions: string[]) =>
    post('improve', { instituteId, prompt, additions });

export const feedbackReviseAgentPrompt = (
    instituteId: string,
    agentId: string | undefined,
    prompt: string,
    feedback: string
) => post('feedback', { instituteId, agentId, prompt, feedback });
