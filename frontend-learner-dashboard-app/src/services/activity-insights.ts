import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { BASE_URL } from "@/constants/urls";

/**
 * Per-activity AI insight reports for the signed-in learner.
 *
 * These are the same `activity_log.processed_json` reports the LLM-analytics pipeline
 * already produces for every quiz / question / assignment attempt (see
 * docs/LLM_ANALYSIS.md). Until now only assessments surfaced one, on the assessment
 * report screen; this backs the "Activity Insights" tab in My Reports.
 *
 * Read-only. Nothing here triggers generation — reports appear once the hourly
 * scheduler has analysed the attempt, so opening the tab never spends credits.
 *
 * Visibility is governed solely by the existing `canViewReports` permission that
 * already gates My Reports. There is deliberately no second switch: a learner who
 * can open My Reports can open this tab within it.
 */

const INSIGHTS_LIST_URL = `${BASE_URL}/admin-core-service/llm-analytics/my/insights`;

export interface ActivityInsightSummary {
    id: string;
    source_type: string;
    slide_id: string | null;
    source_id: string;
    /** Slide title. Null when the slide has since been deleted. */
    title: string | null;
    created_at: string | null;
}

export interface ActivityInsightsPage {
    insights: ActivityInsightSummary[];
    page: number;
    total_pages: number;
    total_elements: number;
}

const EMPTY_PAGE: ActivityInsightsPage = {
    insights: [],
    page: 0,
    total_pages: 0,
    total_elements: 0,
};

/** Human label for a report row, derived from the log's source type. */
export const insightTypeLabel = (sourceType: string): string => {
    switch (sourceType) {
        case "llm_quiz":
            return "Quiz";
        case "llm_question":
            return "Question";
        case "llm_assignment":
            return "Assignment";
        case "llm_assessment":
            return "Assessment";
        default:
            return "Activity";
    }
};

// ── Reports ──────────────────────────────────────────────────────────────────

export const fetchActivityInsights = async (
    page: number,
    size = 12
): Promise<ActivityInsightsPage> => {
    try {
        const response = await authenticatedAxiosInstance({
            method: "GET",
            url: INSIGHTS_LIST_URL,
            params: { page, size },
        });
        const data = response.data ?? {};
        return {
            insights: Array.isArray(data.insights) ? data.insights : [],
            page: data.page ?? 0,
            total_pages: data.total_pages ?? 0,
            total_elements: data.total_elements ?? 0,
        };
    } catch {
        return EMPTY_PAGE;
    }
};

export interface ActivityInsightDetail {
    id: string;
    source_type: string;
    slide_id: string | null;
    source_id: string;
    /** Slide title, so a deep link shows the activity's real name. */
    title: string | null;
    processed_json: string;
    created_at: string | null;
}

export const fetchActivityInsight = async (
    activityLogId: string
): Promise<ActivityInsightDetail | null> => {
    const response = await authenticatedAxiosInstance({
        method: "GET",
        url: `${INSIGHTS_LIST_URL}/${encodeURIComponent(activityLogId)}`,
    });
    return response.data ?? null;
};
