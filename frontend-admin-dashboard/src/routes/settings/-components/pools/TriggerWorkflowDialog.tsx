/**
 * "Trigger workflow" wizard — opened from a pool card's three-dot menu (pool-scoped) or
 * from Lead Settings (institute-global). Lets an admin bind a lead trigger event to either:
 *   1. Communication — send an Email or WhatsApp to the lead's parent contact, using an
 *      existing template or a freshly-created sample template (with insertable ctx variables).
 *   2. Paste data to payload — POST the trigger context to an external URL (webhook out).
 *
 * Pool scope is carried the same way every other entity-scoped trigger is: the pool's id goes
 * in the trigger's event_id with event_applied_type = POOL (mirrors PACKAGE_SESSION /
 * LIVE_SESSION / AUDIENCE). Omit poolId ⇒ no event_id ⇒ institute-global.
 *
 * Recipient note: lead trigger context carries the parent's email/mobile (parentEmail /
 * parentMobile) but not the counselor's, so communication here targets the lead's parent.
 * Notifying counselors/roles needs their contact resolved — use the full workflow builder.
 */

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import {
    Lightning,
    Code,
    EnvelopeSimple,
    WhatsappLogo,
    Sparkle,
} from '@phosphor-icons/react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MyButton } from '@/components/design-system/button';
import { cn } from '@/lib/utils';
import {
    createWorkflow,
    fetchTemplatesByType,
    getTriggerContextVariablesQuery,
} from '@/services/workflow-service';
import { createMessageTemplate } from '@/services/message-template-service';
import { useLeadStatuses } from '@/hooks/use-lead-statuses';
import { getUserId } from '@/utils/userDetails';
import type { WorkflowBuilderDTO } from '@/types/workflow/workflow-types';
import { SAMPLE_TEMPLATES } from '@/routes/workflow/create/-components/sample-email-templates';

const LEAD_STATUS_CHANGED = 'LEAD_STATUS_CHANGED';
/** Sentinel for the "any status change" option in the status picker. */
const ANY_STATUS = '__ANY__';

interface TriggerWorkflowDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    instituteId: string;
    /** When set, the trigger is scoped to this pool (event_applied_type=POOL, event_id=poolId). */
    poolId?: string;
    /** Human label for the scope, e.g. the pool name or "Lead settings". */
    scopeLabel: string;
}

type ActionType = 'communication' | 'payload';
type Channel = 'EMAIL' | 'WHATSAPP';
type Recipient = 'counselor' | 'parent';

const LEAD_EVENTS: { value: string; label: string }[] = [
    { value: 'LEAD_ASSIGNED_TO_COUNSELOR', label: 'Lead assigned to counselor' },
    { value: 'LEAD_TAT_REMINDER_BEFORE', label: 'Lead TAT reminder (before breach)' },
    { value: 'LEAD_TAT_OVERDUE', label: 'Lead TAT overdue' },
    { value: 'FOLLOW_UP_DUE', label: 'Follow-up due' },
    { value: 'FOLLOW_UP_OVERDUE', label: 'Follow-up overdue' },
    { value: 'LEAD_STATUS_CHANGED', label: 'Lead status changed' },
];

export function TriggerWorkflowDialog({
    open,
    onOpenChange,
    instituteId,
    poolId,
    scopeLabel,
}: TriggerWorkflowDialogProps) {
    const queryClient = useQueryClient();

    const [actionType, setActionType] = useState<ActionType | null>(null);
    const [event, setEvent] = useState('');
    // For LEAD_STATUS_CHANGED: the lead status_key to fire on (ANY_STATUS = fire on any change).
    const [targetStatus, setTargetStatus] = useState<string>(ANY_STATUS);
    const [channel, setChannel] = useState<Channel>('EMAIL');
    // Who should receive the notification — defaults to the assigned counsellor.
    const [recipient, setRecipient] = useState<Recipient>('counselor');
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    // Paste-to-payload fields
    const [payloadUrl, setPayloadUrl] = useState('');

    // Reset whenever the dialog opens so re-opening for a different scope starts fresh.
    useEffect(() => {
        if (open) {
            setActionType(null);
            setEvent('');
            setTargetStatus(ANY_STATUS);
            setChannel('EMAIL');
            setRecipient('counselor');
            setSelectedTemplate('');
            setName('');
            setDescription('');
            setPayloadUrl('');
        }
    }, [open]);

    // Templates for the chosen channel (Email via admin-core, WhatsApp via notification-service).
    const { data: templates = [], isLoading: templatesLoading } = useQuery({
        queryKey: ['trigger-workflow-templates', instituteId, channel],
        queryFn: () => fetchTemplatesByType(instituteId, channel),
        staleTime: 5 * 60 * 1000,
        enabled: open && actionType === 'communication' && !!instituteId,
    });

    // Context variables available for the chosen lead event (token palette + templateVars).
    const { data: ctxVarMap = {} } = useQuery(getTriggerContextVariablesQuery());
    const eventVars = useMemo(() => ctxVarMap[event] ?? [], [ctxVarMap, event]);

    // Configured lead statuses — used to target a specific status for LEAD_STATUS_CHANGED.
    const { statuses: leadStatuses } = useLeadStatuses({
        skip: !open || event !== LEAD_STATUS_CHANGED,
    });

    // SpEL boolean that gates the action to a specific new status (null = no gate).
    const statusGate =
        event === LEAD_STATUS_CHANGED && targetStatus !== ANY_STATUS
            ? `#ctx['newStatus'] == '${targetStatus}'`
            : null;

    // One-click sample template creation. Mirrors the workflow wizard's "Use sample" pattern
    // (SAMPLE_TEMPLATES in routes/workflow/.../sample-email-templates.ts) — no form, no token
    // picker; just create a pre-built template for the chosen event and select it.
    const createSampleTemplateMutation = useMutation({
        mutationFn: async () => {
            const sample = SAMPLE_TEMPLATES[event];
            if (!sample) {
                throw new Error('No sample template available for this event.');
            }
            return createMessageTemplate({
                name: sample.name,
                type: 'EMAIL',
                subject: sample.subject,
                content: sample.html,
                variables: sample.variables,
            });
        },
        onSuccess: (created) => {
            toast.success(`Sample template "${created.name}" created`);
            queryClient.invalidateQueries({
                queryKey: ['trigger-workflow-templates', instituteId, channel],
            });
            setSelectedTemplate(created.name);
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : 'Failed to create template');
        },
    });

    const createWorkflowMutation = useMutation({
        mutationFn: async () => createWorkflow(buildWorkflowDTO(), getUserId()),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['GET_ACTIVE_WORKFLOWS_WITH_SCHEDULES'],
                refetchType: 'all',
            });
            toast.success('Workflow created');
            onOpenChange(false);
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : 'Failed to create workflow');
        },
    });

    function buildWorkflowDTO(): WorkflowBuilderDTO {
        const triggerId = uuidv4();
        const actionId = uuidv4();

        const triggerNode = {
            id: triggerId,
            name: `Trigger: ${event}`,
            node_type: 'TRIGGER',
            config: {
                triggerEvent: event,
                routing: [{ type: 'goto', targetNodeId: actionId, label: '' }],
            },
            position_x: 250,
            position_y: 50,
            is_start_node: true,
            is_end_node: false,
        };

        let actionNode;
        if (actionType === 'communication') {
            // Identity templateVars over the event's full context — every placeholder in the
            // selected (or sample) template resolves to the matching ctx key.
            const varKeys = eventVars.map((v) => v.key);
            const templateVars = Object.fromEntries(varKeys.map((k) => [k, k]));

            // Resolve which ctx field carries the recipient address. Counsellor uses the
            // enriched counselorEmail/counselorMobile (LeadTriggerContextBuilder looks these up
            // from auth-service); parent uses the audience_response snapshot.
            const emailField = recipient === 'counselor' ? 'counselorEmail' : 'parentEmail';
            const mobileField = recipient === 'counselor' ? 'counselorMobile' : 'parentMobile';

            if (channel === 'EMAIL') {
                // Wrap the whole context into a one-element list so the per-item sender runs
                // once for this lead; recipientField pulls the chosen address from the ctx
                // map. When a status gate is set, return an empty list (no send) unless the
                // new status matches. forEach is REQUIRED by SendEmailNodeHandler — without it
                // the handler logs "No forEach configuration found in SendEmail node" and
                // silently skips the send. Same shape the audience confirmation dialog uses.
                const onExpr = statusGate ? `${statusGate} ? {#ctx} : {}` : '{#ctx}';
                actionNode = {
                    id: actionId,
                    name: `Email: ${selectedTemplate}`,
                    node_type: 'SEND_EMAIL',
                    config: {
                        templateName: selectedTemplate,
                        on: onExpr,
                        forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
                        recipientField: emailField,
                        templateVars,
                        routing: [{ type: 'end' }],
                    },
                    position_x: 250,
                    position_y: 230,
                    is_start_node: false,
                    is_end_node: true,
                };
            } else {
                // WhatsApp resolves the mobile from fixed keys (mobileNumber/mobile/phone/to),
                // not counselorMobile / parentMobile — so expose the chosen mobile via a
                // one-element list of a map literal that also carries the template variables.
                // Status gate empties the list when unmatched. forEach mirrors SEND_EMAIL — the
                // per-item dispatch needs it to bind {#ctx['item']} for each iteration.
                const mapEntries = [
                    `mobileNumber: #ctx['${mobileField}']`,
                    ...varKeys.map((k) => `${k}: #ctx['${k}']`),
                ].join(', ');
                const onExpr = statusGate
                    ? `${statusGate} ? {{${mapEntries}}} : {}`
                    : `{{${mapEntries}}}`;
                actionNode = {
                    id: actionId,
                    name: `WhatsApp: ${selectedTemplate}`,
                    node_type: 'SEND_WHATSAPP',
                    config: {
                        templateName: selectedTemplate,
                        on: onExpr,
                        forEach: { operation: 'SEND_WHATSAPP', eval: "#ctx['item']" },
                        templateVars,
                        routing: [{ type: 'end' }],
                    },
                    position_x: 250,
                    position_y: 230,
                    is_start_node: false,
                    is_end_node: true,
                };
            }
        } else {
            // Paste data to payload — POST the event's context variables to the given URL.
            const body: Record<string, string> = { triggerEvent: event };
            eventVars.forEach((v) => {
                body[v.key] = `#ctx['${v.key}']`;
            });
            actionNode = {
                id: actionId,
                name: 'Send payload',
                node_type: 'HTTP_REQUEST',
                config: {
                    config: {
                        requestType: 'EXTERNAL',
                        // The HTTP node skips execution when condition is false — gate to the
                        // chosen new status for LEAD_STATUS_CHANGED.
                        ...(statusGate ? { condition: statusGate } : {}),
                        url: payloadUrl.trim(),
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body,
                    },
                    routing: [{ type: 'end' }],
                },
                position_x: 250,
                position_y: 230,
                is_start_node: false,
                is_end_node: true,
            };
        }

        return {
            name: name.trim(),
            description: description.trim() || undefined,
            status: 'ACTIVE',
            workflow_type: 'EVENT_DRIVEN',
            institute_id: instituteId,
            nodes: [triggerNode, actionNode],
            edges: [
                {
                    id: uuidv4(),
                    source_node_id: triggerId,
                    target_node_id: actionId,
                    label: '',
                },
            ],
            trigger: {
                trigger_event_name: event,
                event_applied_type: poolId ? 'POOL' : 'AUDIENCE',
                ...(poolId ? { event_id: poolId } : {}),
            },
        } as WorkflowBuilderDTO;
    }

    const canSubmit = useMemo(() => {
        if (!name.trim() || !event || !actionType) return false;
        if (actionType === 'payload') return !!payloadUrl.trim();
        // communication
        return !!selectedTemplate;
    }, [name, event, actionType, payloadUrl, selectedTemplate]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-screen max-w-lg overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Trigger workflow</DialogTitle>
                    <DialogDescription>
                        Run an automation for{' '}
                        <span className="font-semibold">&ldquo;{scopeLabel}&rdquo;</span> when a lead
                        event fires.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* Step 1 — what do you want to do? */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium">
                            What do you want to do? <span className="text-danger-500">*</span>
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                            <ChoiceCard
                                selected={actionType === 'communication'}
                                onClick={() => setActionType('communication')}
                                icon={<Lightning size={18} />}
                                title="Communication"
                                description="Send an email or WhatsApp message."
                            />
                            <ChoiceCard
                                selected={actionType === 'payload'}
                                onClick={() => setActionType('payload')}
                                icon={<Code size={18} />}
                                title="Paste data to payload"
                                description="POST the event data to a URL."
                            />
                        </div>
                    </div>

                    {/* Step 2 — which event? */}
                    {actionType && (
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium">
                                Trigger on which event? <span className="text-danger-500">*</span>
                            </Label>
                            <Select value={event} onValueChange={setEvent}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a lead event" />
                                </SelectTrigger>
                                <SelectContent>
                                    {LEAD_EVENTS.map((e) => (
                                        <SelectItem key={e.value} value={e.value}>
                                            {e.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Lead status changed — pick which status to fire on (else fires on any change) */}
                    {actionType && event === LEAD_STATUS_CHANGED && (
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium">When status changes to</Label>
                            <Select value={targetStatus} onValueChange={setTargetStatus}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Any status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ANY_STATUS}>Any status change</SelectItem>
                                    {leadStatuses.map((s) => (
                                        <SelectItem key={s.id} value={s.status_key}>
                                            {s.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Matches the lead&apos;s new status. Pick a status to fire only on that
                                change, or keep &ldquo;Any status change&rdquo;.
                            </p>
                        </div>
                    )}

                    {/* Step 3a — communication */}
                    {actionType === 'communication' && event && (
                        <>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium">
                                    Channel <span className="text-danger-500">*</span>
                                </Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <ChoiceCard
                                        selected={channel === 'EMAIL'}
                                        onClick={() => {
                                            setChannel('EMAIL');
                                            setSelectedTemplate('');
                                        }}
                                        icon={<EnvelopeSimple size={18} />}
                                        title="Email"
                                    />
                                    <ChoiceCard
                                        selected={channel === 'WHATSAPP'}
                                        onClick={() => {
                                            setChannel('WHATSAPP');
                                            setSelectedTemplate('');
                                        }}
                                        icon={<WhatsappLogo size={18} />}
                                        title="WhatsApp"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium">
                                    Send notification to{' '}
                                    <span className="text-danger-500">*</span>
                                </Label>
                                <Select
                                    value={recipient}
                                    onValueChange={(v) => setRecipient(v as Recipient)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="counselor">
                                            Assigned counsellor (default)
                                        </SelectItem>
                                        <SelectItem value="parent">
                                            Lead&apos;s parent contact
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-medium">
                                        Template <span className="text-danger-500">*</span>
                                    </Label>
                                    {channel === 'EMAIL' && !!SAMPLE_TEMPLATES[event] && (
                                        <button
                                            type="button"
                                            className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-400 disabled:cursor-not-allowed disabled:opacity-50"
                                            disabled={createSampleTemplateMutation.isPending}
                                            onClick={() => createSampleTemplateMutation.mutate()}
                                        >
                                            <Sparkle size={14} weight="fill" />
                                            {createSampleTemplateMutation.isPending
                                                ? 'Creating sample…'
                                                : 'Create sample template'}
                                        </button>
                                    )}
                                </div>
                                <Select
                                    value={selectedTemplate}
                                    onValueChange={setSelectedTemplate}
                                >
                                    <SelectTrigger>
                                        <SelectValue
                                            placeholder={
                                                templatesLoading
                                                    ? 'Loading templates…'
                                                    : 'Select a template'
                                            }
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {templates.map((t) => (
                                            <SelectItem key={t.id} value={t.name}>
                                                {t.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {templates.length === 0 && !templatesLoading && (
                                    <p className="text-xs text-warning-600">
                                        No {channel === 'EMAIL' ? 'email' : 'WhatsApp'} templates
                                        found.{' '}
                                        {channel === 'WHATSAPP'
                                            ? 'Create an approved WhatsApp template first.'
                                            : 'Click "Create sample template" above for a ready-made starter.'}
                                    </p>
                                )}
                            </div>
                        </>
                    )}

                    {/* Step 3b — payload */}
                    {actionType === 'payload' && event && (
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium">
                                Destination URL <span className="text-danger-500">*</span>
                            </Label>
                            <Input
                                value={payloadUrl}
                                onChange={(e) => setPayloadUrl(e.target.value)}
                                placeholder="https://example.com/webhook"
                            />
                            <p className="text-xs text-muted-foreground">
                                The event&apos;s context (lead, counselor, pool, etc.) is POSTed as
                                JSON.
                            </p>
                        </div>
                    )}

                    {/* Name + description */}
                    {actionType && event && (
                        <>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium">
                                    Workflow name <span className="text-danger-500">*</span>
                                </Label>
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Notify parent on follow-up due"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium">
                                    Description{' '}
                                    <span className="text-xs text-muted-foreground">(optional)</span>
                                </Label>
                                <Textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={2}
                                    placeholder="What does this workflow do?"
                                />
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => onOpenChange(false)}
                        disable={createWorkflowMutation.isPending}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        onClick={() => createWorkflowMutation.mutate()}
                        disable={!canSubmit || createWorkflowMutation.isPending}
                    >
                        {createWorkflowMutation.isPending ? 'Creating…' : 'Create workflow'}
                    </MyButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ChoiceCard({
    selected,
    onClick,
    icon,
    title,
    description,
}: {
    selected: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    title: string;
    description?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors',
                selected
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
            )}
        >
            <span
                className={cn(
                    'flex items-center gap-1.5',
                    selected ? 'text-primary-600' : 'text-neutral-600'
                )}
            >
                {icon}
                <span className="text-sm font-semibold">{title}</span>
            </span>
            {description && (
                <span className="text-xs text-muted-foreground">{description}</span>
            )}
        </button>
    );
}

