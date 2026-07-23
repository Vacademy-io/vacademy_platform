import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CaretDown, CaretUp, CheckCircle, Sparkle } from '@phosphor-icons/react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MyButton } from '@/components/design-system/button';
import { cn } from '@/lib/utils';
import {
    AGENT_ASSIST_CREDIT_COST,
    analyzeAgentPrompt,
    draftAgentPrompt,
    feedbackReviseAgentPrompt,
    improveAgentPrompt,
    type AssistAnalysis,
    type AssistDerived,
} from '../-services/ai-agent-assist';

interface AiAgentPromptAssistantProps {
    instituteId: string;
    /** Saved agent id — enables the call-grounded feedback loop. */
    agentId?: string;
    /** Current system prompt in the editor. */
    prompt: string;
    /** Agent language (passed to draft). */
    language?: string;
    /** Push a new/revised prompt into the editor. */
    onPromptChange: (prompt: string) => void;
    /** Offer derived side-fields (opening line, questions, dispositions) to the editor. */
    onApplyDerived: (derived: AssistDerived) => void;
}

const scoreTone = (score: number) =>
    score >= 75 ? 'text-success-600' : score >= 50 ? 'text-warning-600' : 'text-danger-600';
const scoreBarTone = (score: number) =>
    score >= 75 ? 'bg-success-500' : score >= 50 ? 'bg-warning-500' : 'bg-danger-500';

const errMsg = (err: unknown): string => {
    const e = err as { response?: { status?: number; data?: { ex?: string; message?: string } } };
    if (e?.response?.status === 402) return 'Not enough AI credits';
    return e?.response?.data?.ex ?? e?.response?.data?.message ?? 'The AI assistant failed — retry';
};

/**
 * AI-assisted authoring for an agent's system prompt: draft from a plain brief,
 * score against the live-call rubric, apply selected suggestions, and (for saved
 * agents) revise from post-call feedback grounded in real transcripts. Everything
 * is SUGGESTIVE — nothing changes until the admin clicks apply.
 */
export function AiAgentPromptAssistant({
    instituteId,
    agentId,
    prompt,
    language,
    onPromptChange,
    onApplyDerived,
}: AiAgentPromptAssistantProps) {
    const [analysis, setAnalysis] = useState<AssistAnalysis | null>(null);
    const [brief, setBrief] = useState('');
    const [picked, setPicked] = useState<Set<number>>(new Set());
    const [showDims, setShowDims] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const [pendingRevision, setPendingRevision] = useState<AssistAnalysis | null>(null);

    const applyResult = (res: AssistAnalysis, replacePrompt: boolean) => {
        setAnalysis(res);
        setPicked(new Set());
        if (replacePrompt && res.prompt) onPromptChange(res.prompt);
    };

    const draft = useMutation({
        mutationFn: () => draftAgentPrompt(instituteId, brief, language),
        onSuccess: (res) => {
            applyResult(res, true);
            if (res.derived) onApplyDerived(res.derived);
            toast.success('Draft ready — review the score and refine');
        },
        onError: (e) => toast.error(errMsg(e)),
    });
    const analyze = useMutation({
        mutationFn: () => analyzeAgentPrompt(instituteId, prompt),
        onSuccess: (res) => applyResult(res, false),
        onError: (e) => toast.error(errMsg(e)),
    });
    const improve = useMutation({
        mutationFn: (additions: string[]) => improveAgentPrompt(instituteId, prompt, additions),
        onSuccess: (res) => {
            applyResult(res, true);
            toast.success('Suggestions applied — prompt updated and re-scored');
        },
        onError: (e) => toast.error(errMsg(e)),
    });
    const revise = useMutation({
        mutationFn: () => feedbackReviseAgentPrompt(instituteId, agentId, prompt, feedback),
        onSuccess: (res) => setPendingRevision(res),
        onError: (e) => toast.error(errMsg(e)),
    });

    const busy = draft.isPending || analyze.isPending || improve.isPending || revise.isPending;
    const suggestions = analysis?.suggestions ?? [];
    const hasPrompt = prompt.trim().length > 0;

    return (
        <div className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
            <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-body font-semibold text-neutral-600">
                    <Sparkle className="size-4 text-primary-500" />
                    Prompt assistant
                </p>
                {analysis && (
                    <span className="text-caption text-neutral-500">
                        {analysis.persona ? `Detected: ${analysis.persona}` : ''}
                    </span>
                )}
            </div>

            {/* Draft-from-brief (empty prompt) or Review (existing prompt) */}
            {!hasPrompt ? (
                <div className="space-y-1.5">
                    <Label>Describe your agent in plain words</Label>
                    <Textarea
                        rows={3}
                        value={brief}
                        onChange={(e) => setBrief(e.target.value)}
                        placeholder="e.g. We run a NEET coaching institute. The agent should call new leads, qualify their class and target year, answer fee questions, and book a counselling session."
                    />
                    <MyButton
                        buttonType="primary"
                        scale="small"
                        disable={busy || brief.trim().length < 10}
                        onClick={() => draft.mutate()}
                    >
                        {draft.isPending
                            ? 'Drafting…'
                            : `Draft with AI (${AGENT_ASSIST_CREDIT_COST} credit)`}
                    </MyButton>
                </div>
            ) : (
                <MyButton
                    buttonType="secondary"
                    scale="small"
                    disable={busy}
                    onClick={() => analyze.mutate()}
                >
                    {analyze.isPending
                        ? 'Reviewing…'
                        : `Review prompt (${AGENT_ASSIST_CREDIT_COST} credit)`}
                </MyButton>
            )}

            {/* Score + dimensions */}
            {analysis && (
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <span className={cn('text-h3 font-bold', scoreTone(analysis.score))}>
                            {analysis.score}
                        </span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-lg bg-neutral-200">
                            <div
                                className={cn('h-full rounded-lg', scoreBarTone(analysis.score))}
                                // inline style: genuinely dynamic value (score %), not a token
                                style={{ width: `${Math.min(100, Math.max(2, analysis.score))}%` }}
                            />
                        </div>
                        <button
                            type="button"
                            className="flex items-center gap-1 text-caption text-neutral-500 hover:text-primary-600"
                            onClick={() => setShowDims((v) => !v)}
                        >
                            Details {showDims ? <CaretUp className="size-3" /> : <CaretDown className="size-3" />}
                        </button>
                    </div>
                    {showDims && (
                        <div className="space-y-1">
                            {(analysis.dimensions ?? []).map((d) => (
                                <div key={d.key} className="flex items-start gap-2 text-caption">
                                    <span
                                        className={cn(
                                            'w-8 shrink-0 font-semibold',
                                            d.score >= 8
                                                ? 'text-success-600'
                                                : d.score >= 5
                                                  ? 'text-warning-600'
                                                  : 'text-danger-600'
                                        )}
                                    >
                                        {d.score}/10
                                    </span>
                                    <span className="font-medium text-neutral-600">{d.label}:</span>
                                    <span className="text-neutral-500">{d.comment}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Suggestions — pick and apply */}
                    {suggestions.length > 0 && (
                        <div className="space-y-1.5">
                            <Label>Suggested improvements</Label>
                            {suggestions.map((sg, i) => (
                                <label
                                    key={i}
                                    className="flex cursor-pointer items-start gap-2 rounded-md border border-neutral-200 bg-white p-2"
                                >
                                    <Checkbox
                                        checked={picked.has(i)}
                                        onCheckedChange={(c) =>
                                            setPicked((prev) => {
                                                const next = new Set(prev);
                                                if (c === true) next.add(i);
                                                else next.delete(i);
                                                return next;
                                            })
                                        }
                                    />
                                    <span className="min-w-0">
                                        <span className="block text-body font-medium text-neutral-700">
                                            {sg.title}
                                        </span>
                                        {sg.detail && (
                                            <span className="block text-caption text-neutral-500">
                                                {sg.detail}
                                            </span>
                                        )}
                                    </span>
                                </label>
                            ))}
                            <MyButton
                                buttonType="primary"
                                scale="small"
                                disable={busy || picked.size === 0}
                                onClick={() =>
                                    improve.mutate(
                                        Array.from(picked).map((i) => suggestions[i]!.addition)
                                    )
                                }
                            >
                                {improve.isPending
                                    ? 'Applying…'
                                    : `Apply ${picked.size || ''} selected (${AGENT_ASSIST_CREDIT_COST} credit)`}
                            </MyButton>
                        </div>
                    )}

                    {/* Derived side-fields */}
                    {analysis.derived && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-caption text-neutral-500">
                                Derived from this prompt:
                            </span>
                            <MyButton
                                buttonType="text"
                                scale="small"
                                onClick={() => {
                                    onApplyDerived(analysis.derived!);
                                    toast.success('Opening line, questions and outcomes filled in');
                                }}
                            >
                                <CheckCircle className="mr-1 size-3.5" />
                                Use suggested opening line, questions & outcomes
                            </MyButton>
                        </div>
                    )}
                </div>
            )}

            {/* Post-call feedback loop (saved agents only) */}
            {agentId && hasPrompt && (
                <div className="space-y-1.5 border-t border-neutral-200 pt-2">
                    <button
                        type="button"
                        className="flex items-center gap-1 text-caption font-medium text-neutral-600 hover:text-primary-600"
                        onClick={() => setFeedbackOpen((v) => !v)}
                    >
                        Improve from call feedback{' '}
                        {feedbackOpen ? <CaretUp className="size-3" /> : <CaretDown className="size-3" />}
                    </button>
                    {feedbackOpen && !pendingRevision && (
                        <div className="space-y-1.5">
                            <Textarea
                                rows={3}
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                placeholder="e.g. It gives up too easily when someone says 'email me'. Callers asked about fees and it had no answer."
                            />
                            <p className="text-caption text-neutral-500">
                                The assistant also reads this agent&apos;s recent real calls
                                (transcripts, outcomes) to ground the revision.
                            </p>
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                disable={busy || feedback.trim().length < 5}
                                onClick={() => revise.mutate()}
                            >
                                {revise.isPending
                                    ? 'Revising…'
                                    : `Suggest revision (${AGENT_ASSIST_CREDIT_COST} credit)`}
                            </MyButton>
                        </div>
                    )}
                    {pendingRevision && (
                        <div className="space-y-1.5 rounded-md border border-primary-200 bg-primary-50 p-2">
                            <p className="text-caption font-medium text-neutral-700">
                                Proposed revision (score {pendingRevision.score})
                            </p>
                            {pendingRevision.change_summary && (
                                <p className="whitespace-pre-line text-caption text-neutral-600">
                                    {pendingRevision.change_summary}
                                </p>
                            )}
                            {(pendingRevision.call_insights ?? []).map((ci, i) => (
                                <p key={i} className="text-caption text-neutral-500">
                                    • {ci}
                                </p>
                            ))}
                            <div className="flex gap-2">
                                <MyButton
                                    buttonType="primary"
                                    scale="small"
                                    onClick={() => {
                                        if (pendingRevision.prompt)
                                            onPromptChange(pendingRevision.prompt);
                                        setAnalysis(pendingRevision);
                                        setPendingRevision(null);
                                        setFeedback('');
                                        setFeedbackOpen(false);
                                        toast.success('Revised prompt applied — remember to Save');
                                    }}
                                >
                                    Apply revision
                                </MyButton>
                                <MyButton
                                    buttonType="secondary"
                                    scale="small"
                                    onClick={() => setPendingRevision(null)}
                                >
                                    Discard
                                </MyButton>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
