import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkle, CircleNotch, ArrowRight, Warning, CheckCircle } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { draftWorkflowWithAi, getTemplatesByTypeQuery } from '@/services/workflow-service';
import type {
    AiDraftResponse,
    AiDecisionItem,
    WorkflowBuilderDTO,
} from '@/types/workflow/workflow-types';
import { EventEntityPicker } from './event-entity-picker';
import { useWorkflowBuilderStore } from '../-stores/workflow-builder-store';

type TemplateItem = { id?: string; name: string; dynamic_parameters?: unknown };

/**
 * Layered fallback layout for drafts that ship without node positions — depth from the start
 * node sets the row, siblings at the same depth spread into columns. Without this a ~15-node
 * drip draft renders as one overlapping vertical stack. (Ported from the legacy panel on main.)
 */
const layoutDraft = (wf: WorkflowBuilderDTO): Map<string, { x: number; y: number }> => {
    const nodes = wf.nodes ?? [];
    const edges = wf.edges ?? [];
    const childrenBySource = new Map<string, string[]>();
    edges.forEach((e) => {
        const list = childrenBySource.get(e.source_node_id) ?? [];
        list.push(e.target_node_id);
        childrenBySource.set(e.source_node_id, list);
    });
    const startId = nodes.find((n) => n.is_start_node)?.id ?? nodes[0]?.id;
    const depthById = new Map<string, number>();
    if (startId) {
        const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];
        while (queue.length) {
            const item = queue.shift();
            if (!item || item.depth > nodes.length) continue; // cycle guard
            const prev = depthById.get(item.id);
            if (prev !== undefined && prev >= item.depth) continue;
            depthById.set(item.id, item.depth);
            (childrenBySource.get(item.id) ?? []).forEach((child) =>
                queue.push({ id: child, depth: item.depth + 1 })
            );
        }
    }
    let extraDepth = depthById.size ? Math.max(...depthById.values()) : 0;
    const colByDepth = new Map<number, number>();
    const posById = new Map<string, { x: number; y: number }>();
    nodes.forEach((n) => {
        let depth = depthById.get(n.id);
        if (depth === undefined) {
            depth = ++extraDepth; // unreachable nodes go below the graph
        }
        const col = colByDepth.get(depth) ?? 0;
        colByDepth.set(depth, col + 1);
        posById.set(n.id, { x: 250 + col * 320, y: 80 + depth * 140 });
    });
    return posById;
};

/**
 * "Describe your automation" — assistive AI workflow builder (WORKFLOW_AI_ASSISTIVE_DESIGN.md).
 * Turn-based: PLAN (AI proposes a numbered skeleton) → decisions (admin chooses templates,
 * audiences/batches, variable maps using the SAME pickers as the manual builder) → BUILD
 * (backend assembles a properly-wired workflow) → loaded onto the canvas for review + Publish.
 */
export function AiDraftPanel({
    instituteId,
    onComplete,
}: {
    instituteId: string;
    onComplete: () => void;
}) {
    const [goal, setGoal] = useState('');
    const [stage, setStage] = useState<'idle' | 'plan' | 'decisions'>('idle');
    const [planning, setPlanning] = useState(false);
    const [building, setBuilding] = useState(false);
    const [plan, setPlan] = useState<AiDraftResponse | null>(null);
    const [answers, setAnswers] = useState<Record<string, unknown>>({});

    const {
        setNodes,
        setEdges,
        setWorkflowName,
        setWorkflowDescription,
        setWorkflowType,
        setTriggerConfig,
        setScheduleConfig,
    } = useWorkflowBuilderStore();

    const decisions = plan?.decisions ?? [];
    const needsEmail = decisions.some((d) => d.kind === 'EMAIL_TEMPLATE');
    const needsWhatsapp = decisions.some((d) => d.kind === 'WHATSAPP_TEMPLATE');

    // Same hooks the manual builder uses to load real institute templates.
    const emailTemplates = useQuery({
        ...getTemplatesByTypeQuery(instituteId, 'EMAIL'),
        enabled: !!instituteId && needsEmail,
    });
    const whatsappTemplates = useQuery({
        ...getTemplatesByTypeQuery(instituteId, 'WHATSAPP'),
        enabled: !!instituteId && needsWhatsapp,
    });
    const templatesFor = (kind: string): TemplateItem[] =>
        (((kind === 'WHATSAPP_TEMPLATE' ? whatsappTemplates.data : emailTemplates.data) ?? []) as TemplateItem[]);

    const abortRef = useRef<AbortController | null>(null);

    const resetFromGoal = () => {
        setPlan(null);
        setAnswers({});
        setStage('idle');
    };

    const runPlan = async () => {
        if (!goal.trim()) return;
        const controller = new AbortController();
        abortRef.current = controller;
        setPlanning(true);
        setPlan(null);
        setAnswers({});
        try {
            const res = await draftWorkflowWithAi(
                { goal: goal.trim(), instituteId, mode: 'PLAN' },
                controller.signal
            );
            if (res.error) {
                toast({ title: 'Could not plan', description: res.error, variant: 'destructive' });
                return;
            }
            setPlan(res);
            setStage('plan');
        } catch (e) {
            if (!controller.signal.aborted) {
                toast({
                    title: 'Planning failed',
                    description: e instanceof Error ? e.message : 'Unknown error',
                    variant: 'destructive',
                });
            }
        } finally {
            setPlanning(false);
            abortRef.current = null;
        }
    };

    const missingRequired = useMemo(
        () =>
            decisions
                .filter((d) => d.required)
                .filter((d) => {
                    const v = answers[d.id];
                    return (
                        v == null ||
                        (typeof v === 'string' && v.trim() === '') ||
                        (Array.isArray(v) && v.length === 0) ||
                        (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0)
                    );
                })
                .map((d) => d.id),
        [decisions, answers]
    );

    const buildWorkflow = async () => {
        if (!plan?.skeleton) return;
        setBuilding(true);
        try {
            const res = await draftWorkflowWithAi({
                instituteId,
                mode: 'BUILD',
                skeleton: plan.skeleton,
                decisions: plan.decisions,
                decisionAnswers: Object.entries(answers).map(([id, value]) => ({ id, value })),
            });
            if (res.error || !res.workflow) {
                toast({
                    title: 'Could not build',
                    description: res.error ?? 'No workflow returned',
                    variant: 'destructive',
                });
                return;
            }
            if (res.warnings?.length) {
                toast({ title: 'Loaded with notes', description: res.warnings.join(' ') });
            }
            loadIntoBuilder(res.workflow);
        } catch (e) {
            toast({
                title: 'Build failed',
                description: e instanceof Error ? e.message : 'Unknown error',
                variant: 'destructive',
            });
        } finally {
            setBuilding(false);
        }
    };

    const loadIntoBuilder = (wf: WorkflowBuilderDTO) => {
        const fallbackPos = layoutDraft(wf);
        const rfNodes = (wf.nodes ?? []).map((n, i) => ({
            id: n.id,
            type: 'workflowNode' as const,
            position:
                n.position_x != null && n.position_y != null
                    ? { x: n.position_x, y: n.position_y }
                    : (fallbackPos.get(n.id) ?? { x: 250, y: 80 + i * 130 }),
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
        // Infer from the draft's contents when workflow_type is missing/mis-cased — otherwise
        // the store default (SCHEDULED) silently drops the trigger at publish and substitutes
        // a default daily cron.
        const workflowType =
            wf.workflow_type === 'EVENT_DRIVEN' || wf.workflow_type === 'SCHEDULED'
                ? wf.workflow_type
                : wf.trigger
                  ? 'EVENT_DRIVEN'
                  : 'SCHEDULED';
        setWorkflowType(workflowType);
        if (wf.trigger) {
            setTriggerConfig({
                eventName: wf.trigger.trigger_event_name ?? '',
                description: wf.trigger.description ?? '',
                eventAppliedType: wf.trigger.event_applied_type ?? '',
                eventId: wf.trigger.event_id ?? undefined,
                eventIds: wf.trigger.event_ids?.length ? wf.trigger.event_ids : undefined,
                idempotencyGenerationSetting: wf.trigger.idempotency_generation_setting ?? undefined,
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

    return (
        <div className="rounded-lg border border-primary-100 bg-primary-50 p-4">
            <div className="mb-2 flex items-center gap-2">
                <Sparkle size={18} weight="fill" className="text-primary-500" />
                <h3 className="text-subtitle font-semibold text-neutral-700">Describe your automation</h3>
                <span className="rounded-full bg-primary-100 px-2 py-0.5 text-caption text-primary-600">AI</span>
            </div>
            <p className="mb-3 text-body text-neutral-500">
                Tell me what you want. I&apos;ll propose a plan, then ask you to choose the templates,
                audiences and variable mappings — so the workflow that lands is ready to publish.
            </p>

            <Textarea
                value={goal}
                onChange={(e) => {
                    setGoal(e.target.value);
                    if (plan) resetFromGoal();
                }}
                placeholder="e.g. 3 days after someone fills the JEE lead form, if they haven't enrolled, WhatsApp them the brochure."
                className="min-h-20 bg-white text-body"
                disabled={planning}
            />

            <div className="mt-3 flex justify-end gap-2">
                {planning && (
                    <MyButton buttonType="secondary" onClick={() => abortRef.current?.abort()}>
                        Cancel
                    </MyButton>
                )}
                <MyButton buttonType="primary" onClick={runPlan} disabled={planning || !goal.trim()}>
                    {planning ? (
                        <span className="flex items-center gap-2">
                            <CircleNotch size={16} className="animate-spin" /> Planning…
                        </span>
                    ) : (
                        <span className="flex items-center gap-2">
                            <Sparkle size={16} weight="fill" /> {plan ? 'Re-plan' : 'Draft with AI'}
                        </span>
                    )}
                </MyButton>
            </div>

            {/* ── PLAN card ── */}
            {plan?.plan && (
                <div className="mt-4 rounded-md border border-neutral-200 bg-white p-3">
                    <p className="mb-1 text-body font-semibold text-neutral-700">
                        {plan.plan.summary ?? 'Proposed workflow'}
                    </p>
                    <ol className="mb-2 flex flex-col gap-1">
                        {(plan.plan.steps ?? []).map((s, i) => (
                            <li key={s.stepId ?? i} className="flex items-start gap-2 text-body text-neutral-600">
                                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-caption text-primary-600">
                                    {i + 1}
                                </span>
                                <span>
                                    <span className="font-medium text-neutral-700">{s.title}</span>
                                    <ChannelChip nodeType={s.nodeType} />
                                    {s.detail ? ` — ${s.detail}` : ''}
                                </span>
                            </li>
                        ))}
                    </ol>
                    {plan.warnings?.length ? (
                        <div className="mb-2 flex flex-col gap-1">
                            {plan.warnings.map((w, i) => (
                                <div key={i} className="flex items-start gap-2 text-caption text-warning-600">
                                    <Warning size={14} className="mt-0.5 shrink-0" />
                                    <span>{w}</span>
                                </div>
                            ))}
                        </div>
                    ) : null}
                    {stage === 'plan' && (
                        <div className="flex justify-end">
                            <MyButton buttonType="primary" onClick={() => setStage('decisions')}>
                                <span className="flex items-center gap-2">
                                    Looks good — choose details <ArrowRight size={16} />
                                </span>
                            </MyButton>
                        </div>
                    )}
                </div>
            )}

            {/* ── Decisions ── */}
            {stage === 'decisions' && decisions.length > 0 && (
                <div className="mt-4 flex flex-col gap-4 rounded-md border border-neutral-200 bg-white p-3">
                    <p className="text-body font-medium text-neutral-700">A few choices only you can make:</p>
                    {decisions.map((d) => (
                        <DecisionControl
                            key={d.id}
                            decision={d}
                            value={answers[d.id]}
                            onChange={(v) => setAnswers((prev) => ({ ...prev, [d.id]: v }))}
                            instituteId={instituteId}
                            answers={answers}
                            templatesFor={templatesFor}
                        />
                    ))}
                    <div className="flex items-center justify-between">
                        <span className="text-caption text-neutral-400">
                            {missingRequired.length === 0
                                ? 'All set'
                                : `${missingRequired.length} choice(s) still needed`}
                        </span>
                        <MyButton
                            buttonType="primary"
                            onClick={buildWorkflow}
                            disabled={building || missingRequired.length > 0}
                        >
                            {building ? (
                                <span className="flex items-center gap-2">
                                    <CircleNotch size={16} className="animate-spin" /> Building…
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <CheckCircle size={16} weight="fill" /> Build workflow
                                </span>
                            )}
                        </MyButton>
                    </div>
                </div>
            )}
        </div>
    );
}

/** Renders one decision using the same real pickers as the manual builder. */
function DecisionControl({
    decision,
    value,
    onChange,
    instituteId,
    answers,
    templatesFor,
}: {
    decision: AiDecisionItem;
    value: unknown;
    onChange: (v: unknown) => void;
    instituteId: string;
    answers: Record<string, unknown>;
    templatesFor: (kind: string) => TemplateItem[];
}) {
    const label = (
        <label className="text-caption font-medium text-neutral-600">{decision.prompt ?? decision.id}</label>
    );

    if (decision.kind === 'ENTITY_PICKER') {
        const type = String(decision.optionSource?.args?.eventAppliedType ?? 'AUDIENCE');
        return (
            <div className="flex flex-col gap-1">
                {label}
                {decision.multi ? (
                    <EventEntityPicker
                        eventAppliedType={type}
                        instituteId={instituteId}
                        multiValue={(value as string[]) ?? []}
                        onMultiChange={(ids) => onChange(ids)}
                    />
                ) : (
                    <EventEntityPicker
                        eventAppliedType={type}
                        instituteId={instituteId}
                        value={value as string | undefined}
                        onChange={(id) => onChange(id)}
                    />
                )}
            </div>
        );
    }

    if (decision.kind === 'EMAIL_TEMPLATE' || decision.kind === 'WHATSAPP_TEMPLATE') {
        return (
            <TemplateSelect
                label={label}
                kind={decision.kind}
                value={value as string | undefined}
                onChange={onChange}
                templates={templatesFor(decision.kind)}
            />
        );
    }

    if (decision.kind === 'TEMPLATE_VAR_MAP') {
        // Placeholders come from the template chosen in the dependsOn decision.
        const depId = decision.dependsOn?.[0];
        const chosenName = depId ? (answers[depId] as string | undefined) : undefined;
        const tmpl =
            (chosenName &&
                (templatesFor('WHATSAPP_TEMPLATE').find((t) => t.name === chosenName) ??
                    templatesFor('EMAIL_TEMPLATE').find((t) => t.name === chosenName))) ||
            undefined;
        const params = parseParams(tmpl?.dynamic_parameters);
        const current = (value as Record<string, string>) ?? {};
        if (!chosenName) {
            return (
                <div className="flex flex-col gap-1">
                    {label}
                    <span className="text-caption text-neutral-400">Choose the template above first.</span>
                </div>
            );
        }
        const keys = Object.keys(params);
        return (
            <div className="flex flex-col gap-2">
                {label}
                {keys.length === 0 && (
                    <span className="text-caption text-neutral-400">
                        This template has no variables to map.
                    </span>
                )}
                {keys.map((k) => (
                    <div key={k} className="flex items-center gap-2">
                        <span className="w-40 shrink-0 text-caption text-neutral-600">
                            {params[k] || k}
                        </span>
                        <input
                            type="text"
                            value={current[k] ?? ''}
                            onChange={(e) => onChange({ ...current, [k]: e.target.value })}
                            placeholder="e.g. #item['full_name'] or a fixed value"
                            className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-body text-neutral-700 focus:border-primary-400 focus:outline-none"
                        />
                    </div>
                ))}
            </div>
        );
    }

    // Fallback: a plain text input for any unhandled decision kind.
    return (
        <div className="flex flex-col gap-1">
            {label}
            <input
                type="text"
                value={(value as string) ?? ''}
                onChange={(e) => onChange(e.target.value)}
                className={cn(
                    'rounded-md border border-neutral-300 bg-white px-3 py-2 text-body text-neutral-700',
                    'focus:border-primary-400 focus:outline-none'
                )}
            />
        </div>
    );
}

/** Channel badge so the admin can see at a glance whether a step sends Email or WhatsApp. */
function ChannelChip({ nodeType }: { nodeType?: string }) {
    if (nodeType === 'SEND_EMAIL') {
        return (
            <span className="ml-2 rounded-full bg-info-50 px-2 py-0.5 text-caption text-info-600">Email</span>
        );
    }
    if (nodeType === 'SEND_WHATSAPP' || nodeType === 'COMBOT') {
        return (
            <span className="ml-2 rounded-full bg-success-50 px-2 py-0.5 text-caption text-success-600">
                WhatsApp
            </span>
        );
    }
    return null;
}

/** Searchable template picker — real institute templates only, never a typed-in name. */
function TemplateSelect({
    label,
    kind,
    value,
    onChange,
    templates,
}: {
    label: ReactNode;
    kind: string;
    value?: string;
    onChange: (v: unknown) => void;
    templates: TemplateItem[];
}) {
    const [search, setSearch] = useState('');
    const filtered = search.trim()
        ? templates.filter((t) => t.name.toLowerCase().includes(search.trim().toLowerCase()))
        : templates;
    return (
        <div className="flex flex-col gap-1">
            {label}
            {templates.length > 5 && (
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search templates…"
                    className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-caption text-neutral-600 focus:border-primary-400 focus:outline-none"
                />
            )}
            <select
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-body text-neutral-700 focus:border-primary-400 focus:outline-none"
            >
                <option value="">Select a template…</option>
                {filtered.map((t) => (
                    <option key={t.id ?? t.name} value={t.name}>
                        {t.name}
                    </option>
                ))}
            </select>
            {templates.length === 0 && (
                <span className="text-caption text-warning-600">
                    No {kind === 'WHATSAPP_TEMPLATE' ? 'WhatsApp' : 'email'} templates found — create one in
                    Settings → Templates first.
                </span>
            )}
        </div>
    );
}

function parseParams(dp: unknown): Record<string, string> {
    if (!dp) return {};
    if (typeof dp === 'string') {
        try {
            const parsed = JSON.parse(dp);
            return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
        } catch {
            return {};
        }
    }
    if (typeof dp === 'object') return dp as Record<string, string>;
    return {};
}
