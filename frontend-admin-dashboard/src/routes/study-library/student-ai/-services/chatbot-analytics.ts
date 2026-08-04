import { keepPreviousData, useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import type { TableData } from '@/components/design-system/table';

/**
 * Read-only admin views over Student AI (learner chatbot) activity.
 *
 * Backed by admin_core_service `/ai-usage/v1/chatbot/**`, which reads the
 * chat_sessions / chat_messages / learning_analytics tables the Python
 * ai_service writes into the same database. Institute scope comes from the
 * `clientId` header axiosInstance attaches, so an admin only ever sees their
 * own institute's chats.
 */
const AI_USAGE_BASE = `${BASE_URL}/admin-core-service/ai-usage/v1`;

// ── Types ──────────────────────────────────────────────────────────────────

export interface CountByValue {
    value: string;
    count: number;
}

export interface TopicCount {
    topic: string;
    /** doubt | quiz_score */
    eventType: string;
    count: number;
}

export interface DailyActivityRow {
    /** yyyy-MM-dd */
    date: string;
    sessions: number;
    studentMessages: number;
}

export interface ChatbotSummary {
    sessions: number;
    activeSessions: number;
    uniqueStudents: number;
    sessionsAllTime: number;
    uniqueStudentsAllTime: number;
    totalMessages: number;
    studentMessages: number;
    aiMessages: number;
    quizzesGenerated: number;
    quizzesSubmitted: number;
    toolCalls: number;
    avgMessagesPerSession: number;
    doubtsAsked: number;
    quizzesTaken: number;
    avgQuizScorePct: number | null;
    modeBreakdown: CountByValue[];
    contextBreakdown: CountByValue[];
    topTopics: TopicCount[];
    dailyActivity: DailyActivityRow[];
}

export interface ChatbotSessionRow {
    sessionId: string;
    userId: string;
    studentName: string;
    studentEmail: string | null;
    /** slide | course_details | general */
    contextType: string | null;
    contextTitle: string | null;
    /** text | voice_interview | voice_doubt | voice_oral_test */
    sessionMode: string | null;
    status: string | null;
    /** Epoch millis. */
    createdAt: number | null;
    /** Epoch millis. */
    lastActive: number | null;
    messageCount: number;
    studentMessageCount: number;
    lastStudentMessage: string | null;
    quizCount: number;
}

/** One message in a transcript (shared shape with the AI Usage drill-down). */
export interface ChatTranscriptMessage {
    id: string;
    /** user | assistant | tool_call | tool_result | quiz | quiz_feedback | summary */
    type: string;
    content: string;
    /** Raw metadata JSON string — may be null. */
    metadata: string | null;
    /** Epoch millis. */
    createdAt: number | null;
}

interface SpringPage<T> {
    content: T[];
    totalPages: number;
    totalElements: number;
    number: number;
    size: number;
    last: boolean;
}

const toTableData = <T>(page: SpringPage<T>): TableData<T> => ({
    content: page?.content ?? [],
    total_pages: page?.totalPages ?? 0,
    page_no: page?.number ?? 0,
    page_size: page?.size ?? 0,
    total_elements: page?.totalElements ?? 0,
    last: page?.last ?? true,
});

export interface ChatbotFilters {
    /** Lookback window in days — converted to the epoch-millis range the API takes. */
    days: number;
    search?: string;
    status?: string;
    sessionMode?: string;
}

const dateRange = (days: number) => {
    const endDate = Date.now();
    return { startDate: endDate - days * 24 * 60 * 60 * 1000, endDate };
};

// ── Fetchers ───────────────────────────────────────────────────────────────

export const fetchChatbotSummary = async (days: number): Promise<ChatbotSummary> => {
    const response = await authenticatedAxiosInstance.get<ChatbotSummary>(
        `${AI_USAGE_BASE}/chatbot/summary`,
        { params: dateRange(days) }
    );
    return response.data;
};

export const fetchChatbotSessions = async (
    page: number,
    pageSize: number,
    filters: ChatbotFilters
): Promise<TableData<ChatbotSessionRow>> => {
    const response = await authenticatedAxiosInstance.get<SpringPage<ChatbotSessionRow>>(
        `${AI_USAGE_BASE}/chatbot/sessions`,
        {
            params: {
                page,
                size: pageSize,
                search: filters.search?.trim() || undefined,
                status: filters.status || undefined,
                sessionMode: filters.sessionMode || undefined,
                ...dateRange(filters.days),
            },
        }
    );
    return toTableData(response.data);
};

export const fetchChatTranscript = async (sessionId: string): Promise<ChatTranscriptMessage[]> => {
    const response = await authenticatedAxiosInstance.get<ChatTranscriptMessage[]>(
        `${AI_USAGE_BASE}/conversations/${sessionId}/messages`
    );
    return response.data ?? [];
};

// ── Query hooks ────────────────────────────────────────────────────────────

export const useChatbotSummaryQuery = (days: number) =>
    useQuery({
        queryKey: ['chatbot-analysis', 'summary', days],
        queryFn: () => fetchChatbotSummary(days),
        staleTime: 60_000,
    });

export const useChatbotSessionsQuery = (page: number, pageSize: number, filters: ChatbotFilters) =>
    useQuery({
        queryKey: ['chatbot-analysis', 'sessions', page, pageSize, filters],
        queryFn: () => fetchChatbotSessions(page, pageSize, filters),
        // Keeps the previous page visible while the next one loads, so the table
        // doesn't collapse to a skeleton on every page change.
        placeholderData: keepPreviousData,
    });

export const useChatTranscriptQuery = (sessionId: string | null) =>
    useQuery({
        queryKey: ['chatbot-analysis', 'transcript', sessionId],
        queryFn: () => fetchChatTranscript(sessionId as string),
        enabled: !!sessionId,
    });

// ── Display helpers ────────────────────────────────────────────────────────

export const SESSION_MODE_LABELS: Record<string, string> = {
    text: 'Text chat',
    voice_interview: 'Mock interview',
    voice_doubt: 'Voice doubt',
    voice_oral_test: 'Oral test',
};

export const CONTEXT_TYPE_LABELS: Record<string, string> = {
    slide: 'Study material',
    course_details: 'Course page',
    general: 'General',
};

export const DAY_RANGE_OPTIONS = [
    { label: 'Last 7 days', value: '7' },
    { label: 'Last 30 days', value: '30' },
    { label: 'Last 90 days', value: '90' },
    { label: 'Last 365 days', value: '365' },
];

export const prettifyLabel = (value: string | null | undefined): string =>
    value ? value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—';

export const formatDateTime = (ms: number | null): string =>
    ms
        ? new Date(ms).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          })
        : '—';
