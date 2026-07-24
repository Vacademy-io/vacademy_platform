import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    CALL_INTELLIGENCE_ANALYZE,
    CALL_INTELLIGENCE_BY_CALL,
    CALL_INTELLIGENCE_BY_LEAD,
    CALL_INTELLIGENCE_COUNSELLOR_ANALYTICS,
    CALL_INTELLIGENCE_COUNSELLOR_COACHING,
    CALL_INTELLIGENCE_TEAM_ANALYTICS,
    CALL_INTELLIGENCE_TEAM_COACHING,
    CALL_INTELLIGENCE_TRANSCRIPT,
} from '@/constants/urls';

// ─── Types (mirror the admin-core CallIntelligenceDto / AnalyticsDto) ──────────

export interface CallActionItem {
    text?: string;
    owner?: 'CALLER' | 'LEAD' | 'UNSPECIFIED' | string;
    due_hint?: string | null;
    priority?: 'HIGH' | 'MEDIUM' | 'LOW' | string;
}

export interface CallObjection {
    objection?: string;
    handled?: boolean;
    resolution?: string | null;
}

export interface RatingQuality {
    key?: string;
    score?: number;
    comment?: string;
}

/** The full nested LLM analysis (analysis_json). All optional — it's model output. */
export interface CallAnalysis {
    schema_version?: string;
    language?: { primary?: string; code_switching?: boolean };
    inferred_goal?: { objective?: string; call_type?: string; confidence?: number };
    general_summary?: string;
    action_items?: CallActionItem[];
    generic_status?: string;
    call_analysis?: {
        key_topics?: string[];
        objections?: CallObjection[];
        questions_by_lead?: string[];
        commitments?: string[];
        risk_flags?: string[];
    };
    sentiment?: { lead?: string; caller?: string; trajectory?: string };
    caller_self_goal_rating?: { score?: number; rationale?: string; qualities?: RatingQuality[] };
    call_output_rating?: { score?: number; rationale?: string; conversion_likelihood?: string };
    next_best_action?: string;
    coaching_tips?: string[];
    talk_ratio?: { caller_pct?: number; lead_pct?: number };
    highlights?: { quote?: string; label?: string }[];
}

export type CallIntelligenceStatus =
    | 'PENDING'
    | 'TRANSCRIBING'
    | 'ANALYZING'
    | 'COMPLETED'
    | 'FAILED'
    | 'SKIPPED';

export interface CallIntelligenceDto {
    id: string;
    callLogId: string;
    instituteId: string;
    counsellorUserId?: string | null;
    responseId?: string | null;
    userId?: string | null;
    source?: string | null; // MANUAL | TELEPHONY | AI
    direction?: string | null;
    durationSeconds?: number | null;

    status: CallIntelligenceStatus | string;
    skipReason?: string | null;

    detectedLanguage?: string | null;
    inferredGoal?: string | null;
    callType?: string | null;
    generalSummary?: string | null;
    genericStatus?: string | null;
    callerSelfGoalRating?: number | null;
    callOutputRating?: number | null;
    conversionLikelihood?: string | null;
    leadSentiment?: string | null;

    analysis?: CallAnalysis | null;

    creditsCharged?: number | null;
    schemaVersion?: string | null;
    completedAt?: string | null;
}

/** Full transcript of one call, proxied through admin-core from S3. */
export interface CallTranscriptDto {
    callLogId: string;
    detectedLanguage?: string | null;
    /** Transcript in the spoken language (hi/en/mixed). */
    sourceText?: string | null;
    /** English translation pass. */
    englishText?: string | null;
}

export interface CounsellorStat {
    counsellorUserId: string;
    totalAnalyzed: number;
    avgCallerSelfGoalRating?: number | null;
    avgCallOutputRating?: number | null;
}

export interface CallIntelligenceAnalyticsDto {
    totalAnalyzed: number;
    avgCallerSelfGoalRating?: number | null;
    avgCallOutputRating?: number | null;
    statusDistribution: Record<string, number>;
    sentimentDistribution: Record<string, number>;
    perCounsellor?: CounsellorStat[] | null;
}

export interface CoachingWeakCounsellor {
    counsellorUserId: string;
    name?: string | null;
    avgScore?: number | null;
}
export interface CoachingQualityAvg {
    key: string;
    avgScore?: number | null;
    count: number;
    /** Team coaching only: counsellors weakest in this quality. */
    weakCounsellors?: CoachingWeakCounsellor[] | null;
}
export interface CoachingTipStat {
    text: string;
    count: number;
}
export interface CoachingObjectionStat {
    objection: string;
    count: number;
    handledCount: number;
}
export interface CoachingRecentCall {
    callLogId: string;
    callStartedAt?: string | null;
    callerSelfGoalRating?: number | null;
    callOutputRating?: number | null;
    genericStatus?: string | null;
    summary?: string | null;
}
export interface CallIntelligenceCoachingDto {
    counsellorUserId?: string | null;
    totalAnalyzed: number;
    avgCallerSelfGoalRating?: number | null;
    avgCallOutputRating?: number | null;
    qualityAverages: CoachingQualityAvg[];
    topCoachingTips: CoachingTipStat[];
    topObjections: CoachingObjectionStat[];
    sentimentDistribution: Record<string, number>;
    recentCalls: CoachingRecentCall[];
}

// ─── API ───────────────────────────────────────────────────────────────────────

/** Intelligence for a single call. Returns null on 404 (not analyzed / not enabled). */
export const fetchCallIntelligence = async (
    callLogId: string
): Promise<CallIntelligenceDto | null> => {
    try {
        const { data } = await authenticatedAxiosInstance.get<CallIntelligenceDto>(
            CALL_INTELLIGENCE_BY_CALL(callLogId)
        );
        return data ?? null;
    } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) return null;
        throw err;
    }
};

/** Full transcript for a single call. Returns null on 404 (not analyzed). */
export const fetchCallTranscript = async (
    callLogId: string
): Promise<CallTranscriptDto | null> => {
    try {
        const { data } = await authenticatedAxiosInstance.get<CallTranscriptDto>(
            CALL_INTELLIGENCE_TRANSCRIPT(callLogId)
        );
        return data ?? null;
    } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) return null;
        throw err;
    }
};

/** Queue on-demand (re)analysis for a call. Resolves once accepted; the row then
 *  progresses PENDING → COMPLETED, observed by polling fetchCallIntelligence. */
export const triggerCallIntelligence = async (callLogId: string): Promise<void> => {
    await authenticatedAxiosInstance.post(CALL_INTELLIGENCE_ANALYZE(callLogId));
};

export const fetchLeadCallIntelligence = async (
    responseId: string
): Promise<CallIntelligenceDto[]> => {
    const { data } = await authenticatedAxiosInstance.get<CallIntelligenceDto[]>(
        CALL_INTELLIGENCE_BY_LEAD(responseId)
    );
    return data ?? [];
};

export const fetchCounsellorCallIntelligence = async (
    counsellorUserId?: string,
    from?: number,
    to?: number
): Promise<CallIntelligenceAnalyticsDto> => {
    const { data } = await authenticatedAxiosInstance.get<CallIntelligenceAnalyticsDto>(
        CALL_INTELLIGENCE_COUNSELLOR_ANALYTICS(counsellorUserId, from, to)
    );
    return data;
};

export const fetchCounsellorCoaching = async (
    counsellorUserId?: string,
    from?: number,
    to?: number
): Promise<CallIntelligenceCoachingDto> => {
    const { data } = await authenticatedAxiosInstance.get<CallIntelligenceCoachingDto>(
        CALL_INTELLIGENCE_COUNSELLOR_COACHING(counsellorUserId, from, to)
    );
    return data;
};

export const fetchTeamCoaching = async (
    instituteId: string,
    from?: number,
    to?: number
): Promise<CallIntelligenceCoachingDto> => {
    const { data } = await authenticatedAxiosInstance.get<CallIntelligenceCoachingDto>(
        CALL_INTELLIGENCE_TEAM_COACHING(instituteId, from, to)
    );
    return data;
};

export const fetchTeamCallIntelligence = async (
    instituteId: string,
    from?: number,
    to?: number
): Promise<CallIntelligenceAnalyticsDto> => {
    const { data } = await authenticatedAxiosInstance.get<CallIntelligenceAnalyticsDto>(
        CALL_INTELLIGENCE_TEAM_ANALYTICS(instituteId, from, to)
    );
    return data;
};
