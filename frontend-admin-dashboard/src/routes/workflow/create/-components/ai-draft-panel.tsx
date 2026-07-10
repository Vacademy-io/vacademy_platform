import { useState } from 'react';
import { Sparkle, CircleNotch, Warning, ArrowRight } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { draftWorkflowWithAi } from '@/services/workflow-service';
import type { AiDraftResponse, WorkflowBuilderDTO } from '@/types/workflow/workflow-types';
import { useWorkflowBuilderStore } from '../-stores/workflow-builder-store';

/**
 * "Describe your automation" — AI-assisted drafting entry (see WORKFLOW_AI_ASSIST_DESIGN.md).
 * The admin describes a goal in plain language; the backend returns a builder-shaped draft which
 * this panel loads straight into the canvas for review. Nothing is published here — the admin
 * still reviews every node and clicks Publish.
 */
export function AiDraftPanel({
    instituteId,
    onComplete,
}: {
    instituteId: string;
    onComplete: () => void;
}) {
    const [goal, setGoal] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<AiDraftResponse | null>(null);
    const [answers, setAnswers] = useState<Record<string, string>>({});

    const {
        setNodes,
        setEdges,
        setWorkflowName,
        setWorkflowDescription,
        setWorkflowType,
        setTriggerConfig,
        setScheduleConfig,
    } = useWorkflowBuilderStore();

    const runDraft = async (extraAnswers?: Record<string, string>) => {
        if (!goal.trim()) return;
        setLoading(true);
        setResult(null);
        try {
            const answersList = extraAnswers
                ? Object.entries(extraAnswers)
                      .filter(([, value]) => value.trim().length > 0)
                      .map(([id, value]) => ({ id, value }))
                : undefined;
            const res = await draftWorkflowWithAi({
                goal: goal.trim(),
                instituteId,
                answers: answersList,
            });
            setResult(res);
            if (res.error) {
                toast({ title: 'Could not draft', description: res.error, variant: 'destructive' });
            }
        } catch (e) {
            toast({
                title: 'Drafting failed',
                description: e instanceof Error ? e.message : 'Unknown error',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const loadIntoBuilder = (wf: WorkflowBuilderDTO) => {
        const rfNodes = (wf.nodes ?? []).map((n, i) => ({
            id: n.id,
            type: 'workflowNode' as const,
            position: { x: n.position_x ?? 250, y: n.position_y ?? 80 + i * 130 },
            data: {
                name: n.name,
                nodeType: n.node_type,
                config: n.config ?? {},
                isStartNode: n.is_start_node ?? false,
                isEndNode: n.is_end_node ?? false,
            },
        }));
        const rfEdges = (wf.edges ?? []).map((e) => ({
            id: e.id,
            source: e.source_node_id,
            target: e.target_node_id,
            label: e.label ?? '',
            type: 'smoothstep' as const,
            animated: true,
        }));

        if (wf.name) setWorkflowName(wf.name);
        if (wf.description) setWorkflowDescription(wf.description);
        if (wf.workflow_type === 'EVENT_DRIVEN' || wf.workflow_type === 'SCHEDULED') {
            setWorkflowType(wf.workflow_type);
        }
        if (wf.trigger) {
            setTriggerConfig({
                eventName: wf.trigger.trigger_event_name ?? '',
                description: wf.trigger.description ?? '',
                eventAppliedType: wf.trigger.event_applied_type ?? '',
                eventId: wf.trigger.event_id ?? undefined,
            });
        }
        if (wf.schedule) {
            setScheduleConfig({
                scheduleType: (wf.schedule.schedule_type as 'CRON' | 'INTERVAL') ?? 'CRON',
                cronExpression: wf.schedule.cron_expression ?? '',
                intervalMinutes: wf.schedule.interval_minutes ?? 60,
                timezone: wf.schedule.timezone ?? 'Asia/Kolkata',
            });
        }

        setNodes(rfNodes);
        setEdges(rfEdges);
        onComplete();
    };

    const questions = result?.clarifyingQuestions ?? [];
    // If the model asks anything — even alongside a partial draft — resolve the questions first
    // rather than silently loading an under-specified draft.
    const needsAnswers = questions.length > 0;
    const hasDraft = !!result?.workflow && questions.length === 0;

    return (
        <div className="rounded-lg border border-primary-100 bg-primary-50 p-4">
            <div className="mb-2 flex items-center gap-2">
                <Sparkle size={18} weight="fill" className="text-primary-500" />
                <h3 className="text-subtitle font-semibold text-neutral-700">
                    Describe your automation
                </h3>
                <span className="rounded-full bg-primary-100 px-2 py-0.5 text-caption text-primary-600">
                    AI
                </span>
            </div>
            <p className="mb-3 text-body text-neutral-500">
                Describe what you want in plain language and we&apos;ll draft a workflow you can
                review and edit before publishing.
            </p>

            <Textarea
                value={goal}
                onChange={(e) => {
                    setGoal(e.target.value);
                    // Editing the goal invalidates any prior draft/questions.
                    if (result) {
                        setResult(null);
                        setAnswers({});
                    }
                }}
                placeholder="e.g. 3 days after someone fills the JEE lead form, if they haven't enrolled, WhatsApp them the brochure."
                className="min-h-20 bg-white text-body"
                disabled={loading}
            />

            <div className="mt-3 flex justify-end">
                <MyButton
                    buttonType="primary"
                    onClick={() => runDraft()}
                    disabled={loading || !goal.trim()}
                >
                    {loading ? (
                        <span className="flex items-center gap-2">
                            <CircleNotch size={16} className="animate-spin" />
                            Drafting…
                        </span>
                    ) : (
                        <span className="flex items-center gap-2">
                            <Sparkle size={16} weight="fill" />
                            Draft with AI
                        </span>
                    )}
                </MyButton>
            </div>

            {needsAnswers && (
                <div className="mt-4 rounded-md border border-neutral-200 bg-white p-3">
                    <p className="mb-2 text-body font-medium text-neutral-700">
                        A couple of details so I can finish the draft:
                    </p>
                    <div className="flex flex-col gap-3">
                        {questions.map((q) => (
                            <div key={q.id} className="flex flex-col gap-1">
                                <label className="text-caption text-neutral-600">{q.question}</label>
                                <input
                                    type="text"
                                    value={answers[q.id] ?? ''}
                                    onChange={(e) =>
                                        setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                                    }
                                    placeholder={q.entityType ? `${q.entityType} id` : 'Your answer'}
                                    className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-body text-neutral-700 focus:border-primary-400 focus:outline-none"
                                />
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 flex justify-end">
                        <MyButton
                            buttonType="primary"
                            onClick={() => runDraft(answers)}
                            disabled={loading}
                        >
                            Continue
                        </MyButton>
                    </div>
                </div>
            )}

            {hasDraft && result?.workflow && (
                <div className="mt-4 rounded-md border border-success-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between">
                        <p className="text-body font-semibold text-neutral-700">
                            Draft ready{result.templateUsed ? ` · ${result.templateUsed}` : ''}
                        </p>
                        <MyButton buttonType="primary" onClick={() => loadIntoBuilder(result.workflow!)}>
                            <span className="flex items-center gap-2">
                                Open in builder
                                <ArrowRight size={16} />
                            </span>
                        </MyButton>
                    </div>

                    {result.rationale && result.rationale.length > 0 && (
                        <ul className="mb-2 list-inside list-disc text-body text-neutral-600">
                            {result.rationale.map((r, i) => (
                                <li key={i}>{r.explains ?? ''}</li>
                            ))}
                        </ul>
                    )}

                    {result.warnings && result.warnings.length > 0 && (
                        <div className="mb-2 flex flex-col gap-1">
                            {result.warnings.map((w, i) => (
                                <div
                                    key={i}
                                    className="flex items-start gap-2 text-caption text-warning-600"
                                >
                                    <Warning size={14} className="mt-0.5 shrink-0" />
                                    <span>{w}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {result.validationErrors && result.validationErrors.length > 0 && (
                        <div
                            className={cn(
                                'rounded-md border border-warning-200 bg-warning-50 p-2 text-caption text-warning-700'
                            )}
                        >
                            {result.validationErrors.length} item(s) may need a look after opening —
                            the builder will highlight them.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
