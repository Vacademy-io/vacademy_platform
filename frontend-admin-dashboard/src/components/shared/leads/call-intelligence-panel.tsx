import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
    Sparkle,
    Star,
    Lightbulb,
    Warning,
    Target,
    CheckCircle,
    Quotes,
    ArrowsClockwise,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    fetchCallIntelligence,
    fetchCallTranscript,
    triggerCallIntelligence,
    type CallIntelligenceDto,
} from './services/call-intelligence';
import { useCallIntelligenceEnabled } from './use-call-intelligence-enabled';

/** Statuses that mean the pipeline is still running — poll while in these. */
const IN_PROGRESS_STATUSES = new Set(['PENDING', 'TRANSCRIBING', 'ANALYZING']);

/**
 * Per-call AI analysis panel. Lazily fetches the call_intelligence row on first
 * expand (so a long call list stays one round-trip) and renders the data points:
 * the two ratings, a one-line goal + summary, status/sentiment chips, action
 * items, objections, coaching tips and notable quotes. In-progress / skipped /
 * failed states are surfaced explicitly so a counsellor knows why analysis isn't
 * shown yet.
 */

const STATUS_NOTE: Record<string, string> = {
    PENDING: 'Queued for analysis…',
    TRANSCRIBING: 'Transcribing the recording…',
    ANALYZING: 'Analyzing the conversation…',
    FAILED: 'Analysis could not be completed.',
};

const SKIP_NOTE: Record<string, string> = {
    INSUFFICIENT_CREDITS: 'Not analyzed — institute is out of AI credits.',
    NO_RECORDING: 'Not analyzed — no recording was available.',
    TOO_SHORT: 'Not analyzed — call too short.',
    EMPTY_TRANSCRIPT: 'Not analyzed — no speech detected in the recording.',
    NOT_CONNECTED: 'Not analyzed — call did not connect.',
    SOURCE_DISABLED: 'Not analyzed — this call source is disabled in settings.',
    DISABLED: 'Not analyzed — Call Intelligence is off for this institute.',
};

const STATUS_GENERIC_LABEL: Record<string, string> = {
    CONNECTED_POSITIVE: 'Positive',
    CONNECTED_NEUTRAL: 'Neutral',
    CONNECTED_NEGATIVE: 'Negative',
    CALLBACK_REQUESTED: 'Callback requested',
    NOT_INTERESTED: 'Not interested',
    INFORMATION_ONLY: 'Info only',
    NO_CLEAR_OUTCOME: 'No clear outcome',
    WRONG_NUMBER: 'Wrong number',
};

/** 0–10 rating → tone. */
function ratingTone(score?: number | null): string {
    if (score == null) return 'bg-neutral-100 text-neutral-600';
    if (score >= 7) return 'bg-success-50 text-success-700';
    if (score >= 4) return 'bg-warning-50 text-warning-700';
    return 'bg-danger-50 text-danger-700';
}

const SENTIMENT_TONE: Record<string, string> = {
    POSITIVE: 'bg-success-50 text-success-700',
    NEUTRAL: 'bg-neutral-100 text-neutral-600',
    NEGATIVE: 'bg-danger-50 text-danger-700',
};

function RatingChip({ label, score }: { label: string; score?: number | null }) {
    return (
        <div className={cn('flex items-center gap-1.5 rounded-md px-2 py-1', ratingTone(score))}>
            <Star className="size-4" weight="fill" />
            <span className="text-caption font-medium">{label}</span>
            <span className="text-body font-semibold">{score == null ? '—' : `${score}/10`}</span>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <p className="text-caption font-semibold uppercase tracking-wide text-neutral-500">
                {title}
            </p>
            {children}
        </div>
    );
}

function CompletedView({ ci }: { ci: CallIntelligenceDto }) {
    const a = ci.analysis ?? {};
    const goal = ci.inferredGoal ?? a.inferred_goal?.objective;
    const actionItems = a.action_items ?? [];
    const objections = (a.call_analysis?.objections ?? []).filter((o) => o.objection);
    const coaching = a.coaching_tips ?? [];
    const highlights = (a.highlights ?? []).filter((h) => h.quote);
    const genericLabel = ci.genericStatus
        ? STATUS_GENERIC_LABEL[ci.genericStatus] ?? ci.genericStatus
        : null;

    return (
        <div className="space-y-4">
            {/* Ratings + outcome chips */}
            <div className="flex flex-wrap items-center gap-2">
                <RatingChip label="Caller" score={ci.callerSelfGoalRating} />
                <RatingChip label="Outcome" score={ci.callOutputRating} />
                {genericLabel && (
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-caption text-primary-700">
                        {genericLabel}
                    </span>
                )}
                {ci.leadSentiment && (
                    <span
                        className={cn(
                            'rounded-full px-2 py-0.5 text-caption',
                            SENTIMENT_TONE[ci.leadSentiment] ?? 'bg-neutral-100 text-neutral-600'
                        )}
                    >
                        Lead: {ci.leadSentiment.toLowerCase()}
                    </span>
                )}
                {ci.conversionLikelihood && (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-caption text-neutral-600">
                        Conversion: {ci.conversionLikelihood.toLowerCase()}
                    </span>
                )}
            </div>

            {goal && (
                <div className="flex items-start gap-1.5 text-body text-neutral-600">
                    <Target className="mt-0.5 size-4 shrink-0 text-neutral-400" />
                    <span>
                        <span className="font-medium text-neutral-700">Goal:</span> {goal}
                    </span>
                </div>
            )}

            {ci.generalSummary && (
                <Section title="Summary">
                    <p className="text-body text-neutral-700">{ci.generalSummary}</p>
                </Section>
            )}

            {actionItems.length > 0 && (
                <Section title="Action items">
                    <ul className="space-y-1">
                        {actionItems.map((it, i) => (
                            <li
                                key={i}
                                className="flex items-start gap-1.5 text-body text-neutral-700"
                            >
                                <CheckCircle className="mt-0.5 size-4 shrink-0 text-success-500" />
                                <span>
                                    {it.text}
                                    {it.owner && it.owner !== 'UNSPECIFIED' && (
                                        <span className="text-neutral-400">
                                            {' '}
                                            · {it.owner.toLowerCase()}
                                        </span>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {objections.length > 0 && (
                <Section title="Objections">
                    <ul className="space-y-1">
                        {objections.map((o, i) => (
                            <li
                                key={i}
                                className="flex items-start gap-1.5 text-body text-neutral-700"
                            >
                                <Warning
                                    className={cn(
                                        'mt-0.5 size-4 shrink-0',
                                        o.handled ? 'text-success-500' : 'text-warning-500'
                                    )}
                                />
                                <span>
                                    {o.objection}
                                    {o.resolution && (
                                        <span className="text-neutral-400"> — {o.resolution}</span>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {coaching.length > 0 && (
                <Section title="Coaching tips">
                    <ul className="space-y-1">
                        {coaching.map((tip, i) => (
                            <li
                                key={i}
                                className="flex items-start gap-1.5 text-body text-neutral-700"
                            >
                                <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary-400" />
                                <span>{tip}</span>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {highlights.length > 0 && (
                <Section title="Notable moments">
                    <ul className="space-y-1">
                        {highlights.map((h, i) => (
                            <li
                                key={i}
                                className="flex items-start gap-1.5 text-body text-neutral-600"
                            >
                                <Quotes className="mt-0.5 size-4 shrink-0 text-neutral-400" />
                                <span className="italic">
                                    “{h.quote}”
                                    {h.label && (
                                        <span className="ml-1 not-italic text-neutral-400">
                                            ({h.label})
                                        </span>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {ci.detectedLanguage && (
                <p className="text-caption text-neutral-400">
                    Language: {ci.detectedLanguage}
                    {ci.creditsCharged != null && <> · {ci.creditsCharged} credits</>}
                </p>
            )}
        </div>
    );
}

/**
 * Transcript tab body. Mounted only when the tab is active (Radix unmounts
 * inactive tabs), so the transcript is fetched lazily on first open. Offers an
 * Original / English toggle when both passes exist and differ.
 */
function TranscriptView({ callLogId }: { callLogId: string }) {
    const [lang, setLang] = useState<'source' | 'english'>('source');
    const query = useQuery({
        queryKey: ['call-transcript', callLogId],
        queryFn: () => fetchCallTranscript(callLogId),
        staleTime: 5 * 60 * 1000,
    });

    if (query.isLoading) {
        return <p className="text-body text-neutral-500">Loading transcript…</p>;
    }
    if (query.isError) {
        return <p className="text-body text-danger-600">Couldn’t load the transcript.</p>;
    }

    const source = query.data?.sourceText?.trim() || null;
    const english = query.data?.englishText?.trim() || null;
    if (!source && !english) {
        return (
            <p className="text-body text-neutral-500">
                No transcript is available for this call.
            </p>
        );
    }

    const hasBoth = Boolean(source && english && source !== english);
    const text = lang === 'english' ? (english ?? source) : (source ?? english);

    return (
        <div className="space-y-2">
            {hasBoth && (
                <div className="flex items-center gap-1">
                    {(
                        [
                            ['source', 'Original'],
                            ['english', 'English'],
                        ] as const
                    ).map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setLang(value)}
                            className={cn(
                                'rounded-full px-2 py-0.5 text-caption',
                                lang === value
                                    ? 'bg-primary-100 font-medium text-primary-700'
                                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}
            <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-md border border-neutral-200 bg-white p-3 text-body text-neutral-700">
                {text}
            </div>
            {query.data?.detectedLanguage && (
                <p className="text-caption text-neutral-400">
                    Detected language: {query.data.detectedLanguage}
                </p>
            )}
        </div>
    );
}

export function CallIntelligencePanel({
    callLogId,
    className,
}: {
    callLogId: string;
    className?: string;
}) {
    const featureEnabled = useCallIntelligenceEnabled();
    const [expanded, setExpanded] = useState(false);
    const query = useQuery({
        queryKey: ['call-intelligence', callLogId],
        queryFn: () => fetchCallIntelligence(callLogId),
        enabled: expanded && featureEnabled,
        staleTime: 60 * 1000,
        // While the pipeline is running, poll so the panel updates live (and after
        // an on-demand Analyze, watch PENDING → COMPLETED without a manual refresh).
        refetchInterval: (q) =>
            IN_PROGRESS_STATUSES.has((q.state.data as CallIntelligenceDto | null)?.status ?? '')
                ? 5000
                : false,
    });

    const analyze = useMutation({
        mutationFn: () => triggerCallIntelligence(callLogId),
        onSuccess: () => {
            toast.success('Analysis queued — this updates automatically.');
            void query.refetch();
        },
        onError: (err: unknown) => {
            const status = (err as { response?: { data?: { status?: string } } })?.response?.data
                ?.status;
            toast.error(
                status === 'NO_RECORDING'
                    ? 'No recording is available for this call to analyze.'
                    : status === 'DISABLED'
                      ? 'Call Intelligence is turned off for this institute.'
                      : 'Could not queue analysis.'
            );
        },
    });

    // Hide the whole affordance when Call Intelligence is off for the institute —
    // showing it would just promise an analysis that never runs.
    if (!featureEnabled) return null;

    const AnalyzeButton = ({ label }: { label: string }) => (
        <button
            type="button"
            disabled={analyze.isPending}
            onClick={() => analyze.mutate()}
            className="mt-2 inline-flex items-center gap-1 rounded-md border border-primary-200 bg-white px-2 py-1 text-caption text-primary-700 hover:bg-primary-50 disabled:opacity-60"
        >
            <ArrowsClockwise className={cn('size-4', analyze.isPending && 'animate-spin')} />
            {analyze.isPending ? 'Queuing…' : label}
        </button>
    );

    if (!expanded) {
        return (
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(true);
                }}
                className={cn(
                    'inline-flex items-center gap-1 rounded-md border border-primary-100 bg-primary-50 px-2 py-1 text-caption text-primary-700 hover:bg-primary-100',
                    className
                )}
            >
                <Sparkle className="size-4" weight="fill" />
                View AI analysis
            </button>
        );
    }

    const ci = query.data;
    return (
        <div className={cn('rounded-md border border-primary-100 bg-primary-50/40 p-3', className)}>
            <div className="mb-2 flex items-center gap-1.5 text-body font-medium text-primary-700">
                <Sparkle className="size-4" weight="fill" />
                Call intelligence
            </div>
            {query.isLoading ? (
                <p className="text-body text-neutral-500">Loading analysis…</p>
            ) : query.isError ? (
                <p className="text-body text-danger-600">
                    Couldn’t reach the analysis service. If you’re on a backend without Call
                    Intelligence deployed, this endpoint won’t exist yet.
                </p>
            ) : !ci ? (
                <>
                    <p className="text-body text-neutral-500">
                        This call hasn’t been analyzed yet.
                    </p>
                    <AnalyzeButton label="Analyze this call" />
                </>
            ) : ci.status === 'COMPLETED' ? (
                <Tabs defaultValue="analysis">
                    <TabsList className="h-8 bg-primary-100/60">
                        <TabsTrigger value="analysis" className="text-caption">
                            Analysis
                        </TabsTrigger>
                        <TabsTrigger value="transcript" className="text-caption">
                            Transcript
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="analysis">
                        <CompletedView ci={ci} />
                        <AnalyzeButton label="Re-analyze" />
                    </TabsContent>
                    <TabsContent value="transcript">
                        <TranscriptView callLogId={callLogId} />
                    </TabsContent>
                </Tabs>
            ) : ci.status === 'SKIPPED' ? (
                <>
                    <p className="text-body text-neutral-500">
                        {(ci.skipReason && SKIP_NOTE[ci.skipReason]) ?? 'Not analyzed.'}
                    </p>
                    <AnalyzeButton label="Analyze anyway" />
                </>
            ) : ci.status === 'FAILED' ? (
                <>
                    <p className="text-body text-danger-600">
                        {STATUS_NOTE.FAILED}
                        {ci.skipReason ? ` (${ci.skipReason})` : ''}
                    </p>
                    <AnalyzeButton label="Retry analysis" />
                </>
            ) : (
                <p className="text-body text-neutral-500">
                    {STATUS_NOTE[ci.status] ?? 'Analysis in progress…'}
                </p>
            )}
        </div>
    );
}
