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
    Plus,
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
type TemplateMode = 'select' | 'create';

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
    const [templateMode, setTemplateMode] = useState<TemplateMode>('select');
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    // Create-sample-template fields
    const [sampleName, setSampleName] = useState('');
    const [sampleSubject, setSampleSubject] = useState('');
    const [sampleBody, setSampleBody] = useState('');
    const [insertedVars, setInsertedVars] = useState<string[]>([]);

    // Paste-to-payload fields
    const [payloadUrl, setPayloadUrl] = useState('');

    // Reset whenever the dialog opens so re-opening for a different scope starts fresh.
    useEffect(() => {
        if (open) {
            setActionType(null);
            setEvent('');
            setTargetStatus(ANY_STATUS);
            setChannel('EMAIL');
            setTemplateMode('select');
            setSelectedTemplate('');
            setName('');
            setDescription('');
            setSampleName('');
            setSampleSubject('');
            setSampleBody('');
            setInsertedVars([]);
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

    const insertToken = (key: string) => {
        setSampleBody((prev) => `${prev}{{${key}}}`);
        setInsertedVars((prev) => (prev.includes(key) ? prev : [...prev, key]));
    };

    const createTemplateMutation = useMutation({
        mutationFn: async () => {
            const created = await createMessageTemplate({
                name: sampleName.trim(),
                type: channel,
                subject: channel === 'EMAIL' ? sampleSubject.trim() : undefined,
                content: sampleBody,
                variables: insertedVars,
            });
            return created;
        },
        onSuccess: (created) => {
            toast.success('Sample template created');
            queryClient.invalidateQueries({
                queryKey: ['trigger-workflow-templates', instituteId, channel],
            });
            setSelectedTemplate(created.name);
            setTemplateMode('select');
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
            // Variables to fill the template: the ones inserted into a sample template, else the
            // event's full context variable set so any placeholder in an existing template resolves.
            const varKeys =
                templateMode === 'create' && insertedVars.length > 0
                    ? insertedVars
                    : eventVars.map((v) => v.key);
            const templateVars = Object.fromEntries(varKeys.map((k) => [k, k]));

            if (channel === 'EMAIL') {
                // Wrap the whole context into a one-element list so the per-item sender runs
                // once for this lead; recipientField pulls the parent's email. When a status
                // gate is set, return an empty list (no send) unless the new status matches.
                const onExpr = statusGate ? `${statusGate} ? {#ctx} : {}` : '{#ctx}';
                actionNode = {
                    id: actionId,
                    name: `Email: ${selectedTemplate}`,
                    node_type: 'SEND_EMAIL',
                    config: {
                        templateName: selectedTemplate,
                        on: onExpr,
                        recipientField: 'parentEmail',
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
                // not parentMobile — so expose it via a one-element list of a map literal that
                // also carries the template variables. Status gate empties the list when unmatched.
                const mapEntries = [
                    "mobileNumber: #ctx['parentMobile']",
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

    const canCreateSample =
        !!sampleName.trim() &&
        !!sampleBody.trim() &&
        (channel === 'WHATSAPP' || !!sampleSubject.trim());

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
                                            setTemplateMode('select');
                                        }}
                                        icon={<EnvelopeSimple size={18} />}
                                        title="Email"
                                        description="Send to the lead's parent email."
                                    />
                                    <ChoiceCard
                                        selected={channel === 'WHATSAPP'}
                                        onClick={() => {
                                            setChannel('WHATSAPP');
                                            setSelectedTemplate('');
                                            setTemplateMode('select');
                                        }}
                                        icon={<WhatsappLogo size={18} />}
                                        title="WhatsApp"
                                        description="Send to the lead's parent mobile."
                                    />
                                </div>
                            </div>

                            {templateMode === 'select' ? (
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm font-medium">
                                            Template <span className="text-danger-500">*</span>
                                        </Label>
                                        {channel === 'EMAIL' && (
                                            <button
                                                type="button"
                                                className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-400"
                                                onClick={() => setTemplateMode('create')}
                                            >
                                                <Plus size={14} /> Create sample template
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
                                                : 'Create one below or in Communications.'}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <SampleTemplateEditor
                                    channel={channel}
                                    eventVars={eventVars}
                                    sampleName={sampleName}
                                    setSampleName={setSampleName}
                                    sampleSubject={sampleSubject}
                                    setSampleSubject={setSampleSubject}
                                    sampleBody={sampleBody}
                                    setSampleBody={setSampleBody}
                                    onInsertToken={insertToken}
                                    onCancel={() => setTemplateMode('select')}
                                    onCreate={() => createTemplateMutation.mutate()}
                                    creating={createTemplateMutation.isPending}
                                    canCreate={canCreateSample}
                                />
                            )}
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
                    {actionType && event && templateMode === 'select' && (
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
    description: string;
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
            <span className="text-xs text-muted-foreground">{description}</span>
        </button>
    );
}

function SampleTemplateEditor({
    channel,
    eventVars,
    sampleName,
    setSampleName,
    sampleSubject,
    setSampleSubject,
    sampleBody,
    setSampleBody,
    onInsertToken,
    onCancel,
    onCreate,
    creating,
    canCreate,
}: {
    channel: Channel;
    eventVars: { key: string; label: string }[];
    sampleName: string;
    setSampleName: (v: string) => void;
    sampleSubject: string;
    setSampleSubject: (v: string) => void;
    sampleBody: string;
    setSampleBody: (v: string) => void;
    onInsertToken: (key: string) => void;
    onCancel: () => void;
    onCreate: () => void;
    creating: boolean;
    canCreate: boolean;
}) {
    return (
        <div className="space-y-3 rounded-lg border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Create sample template</Label>
                <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-neutral-700"
                    onClick={onCancel}
                >
                    Cancel
                </button>
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-medium">Template name</Label>
                <Input
                    value={sampleName}
                    onChange={(e) => setSampleName(e.target.value)}
                    placeholder="e.g. Follow-up reminder"
                />
            </div>

            {channel === 'EMAIL' && (
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Subject</Label>
                    <Input
                        value={sampleSubject}
                        onChange={(e) => setSampleSubject(e.target.value)}
                        placeholder="e.g. A quick follow-up about your enquiry"
                    />
                </div>
            )}

            <div className="space-y-1.5">
                <Label className="text-xs font-medium">Body</Label>
                <Textarea
                    value={sampleBody}
                    onChange={(e) => setSampleBody(e.target.value)}
                    rows={4}
                    placeholder="Write your message. Click a variable below to insert it."
                />
            </div>

            {eventVars.length > 0 && (
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Insert variable</Label>
                    <div className="flex flex-wrap gap-1.5">
                        {eventVars.map((v) => (
                            <button
                                key={v.key}
                                type="button"
                                title={v.label}
                                onClick={() => onInsertToken(v.key)}
                                className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-700 hover:border-primary-300 hover:bg-primary-50"
                            >
                                {`{{${v.key}}}`}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <MyButton
                buttonType="primary"
                scale="medium"
                onClick={onCreate}
                disable={!canCreate || creating}
            >
                {creating ? 'Creating…' : 'Create template'}
            </MyButton>
        </div>
    );
}
