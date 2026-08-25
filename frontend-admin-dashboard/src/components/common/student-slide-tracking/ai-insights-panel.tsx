import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_AI_PROCESSED_LOGS } from '@/constants/urls';
import { getAiInsightsSettings } from '@/services/ai-insights-settings';
import { Sparkle, WarningCircle } from '@phosphor-icons/react';

/**
 * The AI insight report for one learner's attempt at one slide, shown inside the
 * admin activity-log dialog.
 *
 * Reads `activity_log.processed_json` — the output of the LLM-analytics pipeline
 * (see docs/LLM_ANALYSIS.md) that until now only the learner could see, and only
 * for assessments. Read-only: this never triggers generation. Reports appear once
 * the hourly scheduler has processed the attempt, so a just-submitted quiz shows
 * "not ready" rather than silently spending credits on an admin's behalf.
 *
 * Hidden entirely unless the institute has turned on AI_INSIGHTS_SETTING
 * .adminActivityInsightsEnabled.
 */

interface ProcessedLogItem {
    id: string;
    user_id: string;
    slide_id: string | null;
    source_id: string;
    source_type: string;
    status: string;
    processed_json: string;
    created_at: string | null;
    updated_at: string | null;
}

interface TopicAnalysisItem {
    topic: string;
    questions_count?: number;
    correct?: number;
    accuracy?: number;
    avg_time_seconds?: number;
    mastery_level?: string;
}

interface MisconceptionItem {
    question_summary?: string;
    student_answer?: string;
    correct_answer?: string;
    misconception?: string;
    remediation?: string;
}

interface ProcessedInsights {
    performance_analysis?: string;
    strengths?: Record<string, number>;
    weaknesses?: Record<string, number>;
    areas_of_improvement?: string;
    improvement_path?: string;
    topic_analysis?: TopicAnalysisItem[];
    misconception_analysis?: MisconceptionItem[];
    blooms_taxonomy?: Record<string, { total?: number; correct?: number }>;
    behavioral_insights?: {
        time_management?: string;
        difficulty_response?: string;
        fatigue_indicator?: string;
        skip_pattern?: string;
    };
    /** Failure-marker rows are stored in the same column as `{"error": "..."}`. */
    error?: string;
}

const MASTERY_TONE: Record<string, string> = {
    Expert: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    Proficient: 'bg-blue-50 text-blue-700 ring-blue-200',
    Developing: 'bg-amber-50 text-amber-700 ring-amber-200',
    Beginner: 'bg-red-50 text-red-700 ring-red-200',
};

const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const accuracyTone = (pct: number) =>
    pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : pct >= 35 ? 'bg-amber-500' : 'bg-red-500';

const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="mt-6 px-4">
        <div className="rounded-lg border border-violet-100 bg-violet-50/30">
            <div className="flex items-center gap-2 border-b border-violet-100 px-4 py-3">
                <Sparkle size={16} weight="fill" className="text-violet-500" />
                <h3 className="text-sm font-semibold text-neutral-900">AI Insights</h3>
            </div>
            <div className="px-4 py-4">{children}</div>
        </div>
    </div>
);

const Note = ({ children }: { children: React.ReactNode }) => (
    <p className="flex items-start gap-2 text-xs text-neutral-500">
        <WarningCircle size={14} className="mt-px shrink-0" />
        <span>{children}</span>
    </p>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        {children}
    </h4>
);

const AiInsightsPanel = ({ slideId, userId }: { slideId: string; userId: string }) => {
    const { data: settings } = useQuery({
        queryKey: ['ai-insights-settings'],
        queryFn: getAiInsightsSettings,
        staleTime: 5 * 60_000,
    });
    const enabled = Boolean(settings?.adminActivityInsightsEnabled);

    const { data: logs, isLoading } = useQuery({
        queryKey: ['ai-processed-logs-admin', slideId, userId],
        queryFn: async () => {
            const res = await authenticatedAxiosInstance({
                method: 'GET',
                url: GET_AI_PROCESSED_LOGS,
                params: { userId, slideId },
            });
            return (res.data?.activity_logs ?? []) as ProcessedLogItem[];
        },
        // Only ask once the institute has opted in — otherwise the panel is not
        // rendered and the request would be wasted.
        enabled: enabled && Boolean(slideId && userId),
        staleTime: 60_000,
    });

    const report = useMemo<ProcessedInsights | null>(() => {
        // The endpoint returns every processed row for this learner + slide. Only
        // the LLM rows carry insights; plain activity rows never reach 'processed'
        // but the guard keeps this honest if that ever changes.
        const latest = (logs ?? []).find((l) => l.source_type?.startsWith('llm_'));
        if (!latest?.processed_json) return null;
        try {
            return JSON.parse(latest.processed_json) as ProcessedInsights;
        } catch {
            return null;
        }
    }, [logs]);

    if (!enabled || !slideId || !userId) return null;

    if (isLoading) {
        return (
            <Shell>
                <p className="text-xs text-neutral-500">Loading insights…</p>
            </Shell>
        );
    }

    if (!report) {
        return (
            <Shell>
                <Note>
                    No AI report yet for this attempt. Reports are generated hourly after a
                    learner submits.
                </Note>
            </Shell>
        );
    }

    // A failed run stores {"error": "...", "timestamp": "..."} in the same column.
    if (report.error && !report.performance_analysis) {
        return (
            <Shell>
                <Note>The AI report for this attempt could not be generated. It will be retried.</Note>
            </Shell>
        );
    }

    const topics = report.topic_analysis ?? [];
    const misconceptions = report.misconception_analysis ?? [];
    const strengths = Object.entries(report.strengths ?? {});
    const weaknesses = Object.entries(report.weaknesses ?? {});
    const blooms = Object.entries(report.blooms_taxonomy ?? {}).filter(
        ([, v]) => (v?.total ?? 0) > 0
    );
    const behaviours = Object.entries(report.behavioral_insights ?? {}).filter(
        ([, v]) => Boolean(v)
    );

    return (
        <Shell>
            <div className="space-y-5">
                {report.performance_analysis && (
                    <div>
                        <SectionTitle>Performance</SectionTitle>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-700">
                            {report.performance_analysis}
                        </p>
                    </div>
                )}

                {(strengths.length > 0 || weaknesses.length > 0) && (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {strengths.length > 0 && (
                            <div>
                                <SectionTitle>Strengths</SectionTitle>
                                <div className="flex flex-wrap gap-1.5">
                                    {strengths.map(([topic, score]) => (
                                        <span
                                            key={topic}
                                            className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 ring-1 ring-emerald-200"
                                        >
                                            {topic} · {Math.round(Number(score) || 0)}%
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {weaknesses.length > 0 && (
                            <div>
                                <SectionTitle>Needs work</SectionTitle>
                                <div className="flex flex-wrap gap-1.5">
                                    {weaknesses.map(([topic, score]) => (
                                        <span
                                            key={topic}
                                            className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700 ring-1 ring-red-200"
                                        >
                                            {topic} · {Math.round(Number(score) || 0)}%
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {topics.length > 0 && (
                    <div>
                        <SectionTitle>Topic breakdown</SectionTitle>
                        <div className="space-y-2">
                            {topics.map((t) => {
                                const pct = Math.max(0, Math.min(100, Math.round(t.accuracy ?? 0)));
                                return (
                                    <div key={t.topic} className="flex items-center gap-3">
                                        <span className="w-40 shrink-0 truncate text-xs text-neutral-700">
                                            {t.topic}
                                        </span>
                                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
                                            <div
                                                className={`h-full rounded-full ${accuracyTone(pct)}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-neutral-600">
                                            {pct}%
                                        </span>
                                        {t.mastery_level && (
                                            <span
                                                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ${
                                                    MASTERY_TONE[t.mastery_level] ??
                                                    'bg-neutral-50 text-neutral-600 ring-neutral-200'
                                                }`}
                                            >
                                                {t.mastery_level}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {blooms.length > 0 && (
                    <div>
                        <SectionTitle>Cognitive levels</SectionTitle>
                        <div className="flex flex-wrap gap-1.5">
                            {blooms
                                .sort(
                                    ([a], [b]) =>
                                        BLOOM_ORDER.indexOf(a.toLowerCase()) -
                                        BLOOM_ORDER.indexOf(b.toLowerCase())
                                )
                                .map(([level, v]) => (
                                    <span
                                        key={level}
                                        className="rounded bg-white px-2 py-0.5 text-xs text-neutral-700 ring-1 ring-neutral-200"
                                    >
                                        {cap(level)} · {v.correct ?? 0}/{v.total ?? 0}
                                    </span>
                                ))}
                        </div>
                    </div>
                )}

                {misconceptions.length > 0 && (
                    <div>
                        <SectionTitle>Misconceptions</SectionTitle>
                        <div className="space-y-2">
                            {misconceptions.map((m, i) => (
                                <div
                                    key={i}
                                    className="rounded-md border border-neutral-200 bg-white px-3 py-2"
                                >
                                    {m.question_summary && (
                                        <p className="text-xs font-medium text-neutral-900">
                                            {m.question_summary}
                                        </p>
                                    )}
                                    {(m.student_answer || m.correct_answer) && (
                                        <p className="mt-1 text-xs text-neutral-600">
                                            <span className="text-red-600">
                                                {m.student_answer || '—'}
                                            </span>
                                            {' → '}
                                            <span className="text-emerald-700">
                                                {m.correct_answer || '—'}
                                            </span>
                                        </p>
                                    )}
                                    {m.misconception && (
                                        <p className="mt-1 text-xs text-neutral-700">
                                            {m.misconception}
                                        </p>
                                    )}
                                    {m.remediation && (
                                        <p className="mt-1 text-xs italic text-neutral-500">
                                            {m.remediation}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {behaviours.length > 0 && (
                    <div>
                        <SectionTitle>Behaviour</SectionTitle>
                        <dl className="space-y-1">
                            {behaviours.map(([key, value]) => (
                                <div key={key} className="text-xs">
                                    <dt className="inline font-medium text-neutral-700">
                                        {cap(key.replace(/_/g, ' '))}:{' '}
                                    </dt>
                                    <dd className="inline text-neutral-600">{value}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                )}

                {report.areas_of_improvement && (
                    <div>
                        <SectionTitle>Areas to improve</SectionTitle>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-700">
                            {report.areas_of_improvement}
                        </p>
                    </div>
                )}

                <p className="border-t border-violet-100 pt-3 text-[11px] text-neutral-400">
                    Generated by AI from this attempt. Review before sharing with the learner or
                    their guardian.
                </p>
            </div>
        </Shell>
    );
};

export default AiInsightsPanel;
