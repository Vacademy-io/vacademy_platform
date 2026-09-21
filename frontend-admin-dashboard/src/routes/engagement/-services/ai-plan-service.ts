import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { AI_SERVICE_BASE_URL } from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';
import type { EngagementSlotRequest } from '../-types/types';

/**
 * AI planner — drafts a whole engagement plan for review.
 *
 * Nothing here publishes. The draft comes back in the composer's own slot shape and
 * is saved through the normal engagement API once the teacher has looked at it.
 */

const ROOT = `${AI_SERVICE_BASE_URL}/engagement/plan`;

export interface AiPlanMix {
    question_of_day: boolean;
    text_question: boolean;
    poll: boolean;
    reading: boolean;
    game: boolean;
}

export interface AiPlanBrief {
    title?: string;
    topic?: string;
    audience?: string;
    language: string;
    difficulty: 'easy' | 'medium' | 'hard';
    start_date: string;
    days: number;
    per_day_items: number;
    start_time: string;
    end_time: string;
    reveal_time?: string;
    notify_time?: string;
    completion_points: number;
    correct_points: number;
    mix: AiPlanMix;
    grounding_texts: { title?: string; text: string }[];
    kb_id?: string;
}

export interface AiPlanDraft {
    title: string;
    slots: EngagementSlotRequest[];
    model: string;
    days_planned: number;
    items_planned: number;
    grounded: boolean;
}

/** Flat credit price of a draft; mirrors tool_cost_estimator on the AI service. */
export const DRAFT_CREDITS = 10;
/** Per generated picture; mirrors html_document_image. */
export const IMAGE_CREDITS = 2;

/**
 * Idempotency keys are minted ONCE per attempt by the caller and reused on retry.
 * A key generated inside this function would be fresh on every call, so a retry
 * after a timeout would be billed as a second draft.
 */
export function newIdempotencyKey(prefix: string): string {
    const rand = Math.random().toString(36).slice(2, 10);
    return `${prefix}-${Date.now()}-${rand}`;
}

export async function draftAiPlan(
    brief: AiPlanBrief,
    idempotencyKey: string
): Promise<AiPlanDraft> {
    const { data } = await authenticatedAxiosInstance.post<AiPlanDraft>(`${ROOT}/draft`, {
        ...brief,
        institute_id: getInstituteId(),
        idempotency_key: idempotencyKey,
    });
    return data;
}

export async function illustrateReading(
    title: string,
    contentHtml: string,
    idempotencyKey: string,
    maxImages = 2
): Promise<{ content_html: string; images_generated: number }> {
    const { data } = await authenticatedAxiosInstance.post<{
        content_html: string;
        images_generated: number;
    }>(`${ROOT}/illustrate`, {
        institute_id: getInstituteId(),
        title,
        content_html: contentHtml,
        max_images: maxImages,
        idempotency_key: idempotencyKey,
    });
    return data;
}

/** How many image placeholders a drafted reading carries. */
export function countImagePlaceholders(html: string | undefined): number {
    if (!html) return 0;
    return (html.match(/data-img-prompt=/g) ?? []).length;
}
