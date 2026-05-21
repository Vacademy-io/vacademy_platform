import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { Zap, Clock } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createWorkflow } from '@/services/workflow-service';
import { getMessageTemplates } from '@/services/message-template-service';
import { getUserId } from '@/utils/userDetails';
import type { WorkflowBuilderDTO } from '@/types/workflow/workflow-types';

interface ConfigureAudienceWorkflowDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    audienceId: string;
    audienceName: string;
    instituteId: string;
}

type WorkflowKind = 'confirmation' | 'followup';

/**
 * Inline form for creating a simple audience workflow without taking the user
 * to the full workflow builder. Covers the two most common cases:
 *
 *   1. Confirmation — event-driven, fires on AUDIENCE_LEAD_SUBMISSION
 *      → TRIGGER → SEND_EMAIL (templateVars pre-mapped to standard custom fields)
 *
 *   2. Follow-up after N days — scheduled, runs daily at 9 AM IST
 *      → QUERY (fetch_audience_responses_filtered, daysAgo=N, audienceId=this)
 *      → SEND_EMAIL (iterates the leads list)
 *
 * The workflow JSON shape mirrors what the wizard's `audience_lead_confirmation`
 * and `scheduled_audience_followup` use cases produce (in use-case-templates.ts),
 * so the result is interchangeable — an admin can later open the workflow in
 * the builder for further editing without seeing anything unexpected.
 */
export function ConfigureAudienceWorkflowDialog({
    open,
    onOpenChange,
    audienceId,
    audienceName,
    instituteId,
}: ConfigureAudienceWorkflowDialogProps) {
    const queryClient = useQueryClient();

    const [kind, setKind] = useState<WorkflowKind>('confirmation');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [daysAgo, setDaysAgo] = useState<number>(3);
    const [templateName, setTemplateName] = useState('');
    const [nameTouched, setNameTouched] = useState(false);

    // Reset when the dialog opens so re-opening for a different campaign starts fresh.
    useEffect(() => {
        if (open) {
            setKind('confirmation');
            setDescription('');
            setDaysAgo(3);
            setTemplateName('');
            setNameTouched(false);
        }
    }, [open]);

    // Auto-suggest the workflow name from the kind + audience, but only until
    // the admin has typed something themselves (then we leave their value alone).
    useEffect(() => {
        if (nameTouched) return;
        if (kind === 'confirmation') {
            setName(`${audienceName} — confirmation email`);
        } else {
            setName(`${audienceName} — follow-up after ${daysAgo} day${daysAgo === 1 ? '' : 's'}`);
        }
    }, [kind, daysAgo, audienceName, nameTouched]);

    // Load the institute's email templates for the dropdown. Cached for 5 min.
    const { data: templateOptions = [], isLoading: templatesLoading } = useQuery({
        queryKey: ['configure-audience-workflow-templates'],
        queryFn: async () => {
            const result = await getMessageTemplates('EMAIL', 0, 100);
            return (result.templates ?? []).map((t: { name?: string; id?: string }) => ({
                value: t.name ?? t.id ?? '',
                label: t.name ?? 'Untitled',
            }));
        },
        staleTime: 5 * 60 * 1000,
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            const dto = kind === 'confirmation'
                ? buildConfirmationDTO({ name, description, instituteId, audienceId, audienceName, templateName })
                : buildFollowupDTO({ name, description, instituteId, audienceId, audienceName, templateName, daysAgo });
            return createWorkflow(dto, getUserId());
        },
        onSuccess: () => {
            // Invalidate the workflow list so the count badge on the audience
            // card updates immediately and the LinkedWorkflowsDialog reflects
            // the new entry on next open.
            queryClient.invalidateQueries({
                queryKey: ['GET_ACTIVE_WORKFLOWS_WITH_SCHEDULES'],
                refetchType: 'all',
            });
            toast.success('Workflow created');
            onOpenChange(false);
        },
        onError: (err) => {
            const msg = err instanceof Error ? err.message : 'Failed to create workflow';
            toast.error(msg);
        },
    });

    const canSubmit = useMemo(() => {
        if (!name.trim()) return false;
        if (!templateName.trim()) return false;
        if (kind === 'followup' && (!daysAgo || daysAgo < 1)) return false;
        return !createMutation.isPending;
    }, [name, templateName, kind, daysAgo, createMutation.isPending]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Configure Workflow</DialogTitle>
                    <DialogDescription>
                        Set up an automated email for <span className="font-semibold">&ldquo;{audienceName}&rdquo;</span>.
                        For more complex flows (delays, conditions, multiple steps), use the full workflow builder.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Kind picker — two large clickable cards */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-gray-700">
                            Workflow type <span className="text-red-400">*</span>
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                            <KindCard
                                selected={kind === 'confirmation'}
                                onClick={() => setKind('confirmation')}
                                icon={<Zap size={18} />}
                                title="Confirmation"
                                description="Sent immediately when a lead submits the form."
                            />
                            <KindCard
                                selected={kind === 'followup'}
                                onClick={() => setKind('followup')}
                                icon={<Clock size={18} />}
                                title="Follow-up"
                                description="Sent N days after a lead submits the form."
                            />
                        </div>
                    </div>

                    {/* Days input — only for follow-up */}
                    {kind === 'followup' && (
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-gray-700">
                                Send follow-up how many days after submission? <span className="text-red-400">*</span>
                            </Label>
                            <Input
                                type="number"
                                min={1}
                                max={365}
                                value={daysAgo}
                                onChange={(e) => setDaysAgo(parseInt(e.target.value) || 1)}
                                className="w-32"
                            />
                            <p className="text-[11px] text-gray-400">
                                Workflow runs daily at 9:00 AM IST and emails leads whose
                                submission date is exactly this many days ago. To send on multiple
                                days (e.g. day 3 AND day 7) create separate workflows for each.
                            </p>
                        </div>
                    )}

                    {/* Name */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-gray-700">
                            Workflow name <span className="text-red-400">*</span>
                        </Label>
                        <Input
                            value={name}
                            onChange={(e) => {
                                setNameTouched(true);
                                setName(e.target.value);
                            }}
                            placeholder="e.g. Welcome confirmation for new leads"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-gray-700">
                            Description <span className="text-gray-400 text-xs">(optional)</span>
                        </Label>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            placeholder="What does this workflow do?"
                        />
                    </div>

                    {/* Template */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-gray-700">
                            Email template <span className="text-red-400">*</span>
                        </Label>
                        <select
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                        >
                            <option value="">{templatesLoading ? 'Loading templates...' : '-- Select a template --'}</option>
                            {templateOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        {templateOptions.length === 0 && !templatesLoading && (
                            <p className="text-[11px] text-amber-600">
                                No email templates found. Create one in the Communications section first.
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={createMutation.isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => createMutation.mutate()}
                        disabled={!canSubmit}
                        className="gap-1.5"
                    >
                        {createMutation.isPending ? 'Creating...' : 'Create Workflow'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Small subcomponents ───

function KindCard({
    selected, onClick, icon, title, description,
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
            className={`flex flex-col items-start gap-1 rounded-lg border-2 p-3 text-left transition-all ${
                selected
                    ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-200'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
        >
            <div className={`flex items-center gap-1.5 ${selected ? 'text-primary-700' : 'text-gray-600'}`}>
                {icon}
                <span className="text-sm font-semibold">{title}</span>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">{description}</p>
        </button>
    );
}

// ─── DTO builders ───
// Inline rather than importing the wizard's generators because (a) the wizard
// returns ReactFlow nodes that need conversion to the API's node shape and
// (b) the wizard relies on Zustand state we don't want to touch from here.
// The output shape is identical to what the wizard saves, so workflows created
// here are fully editable in the visual builder afterwards.

interface ConfirmationOpts {
    name: string;
    description: string;
    instituteId: string;
    audienceId: string;
    audienceName: string;
    templateName: string;
}

function buildConfirmationDTO(opts: ConfirmationOpts): WorkflowBuilderDTO {
    const triggerId = uuidv4();
    const emailId = uuidv4();
    return {
        name: opts.name,
        description: opts.description || `Send confirmation email when a lead submits "${opts.audienceName}"`,
        status: 'ACTIVE',
        workflow_type: 'EVENT_DRIVEN',
        institute_id: opts.instituteId,
        nodes: [
            {
                id: triggerId,
                name: 'Trigger: Audience form submitted',
                node_type: 'TRIGGER',
                config: {
                    triggerEvent: 'AUDIENCE_LEAD_SUBMISSION',
                    routing: [{ type: 'goto', targetNodeId: emailId, label: '' }],
                },
                position_x: 250,
                position_y: 50,
                is_start_node: true,
                is_end_node: false,
            },
            {
                id: emailId,
                name: `Send: ${opts.templateName}`,
                node_type: 'SEND_EMAIL',
                config: {
                    templateName: opts.templateName,
                    on: "#ctx['respondentEmailRequests']",
                    forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
                    // Pre-populated templateVars — mirrors the wizard's
                    // audience_lead_confirmation use case so the same templates
                    // work without manual mapping.
                    templateVars: {
                        parentName: 'Full Name',
                        fullName: 'Full Name',
                        email: 'Email',
                        mobileNumber: 'Phone Number',
                        instituteName: 'instituteName',
                    },
                    routing: [{ type: 'end' }],
                },
                position_x: 250,
                position_y: 230,
                is_start_node: false,
                is_end_node: true,
            },
        ],
        edges: [
            {
                id: uuidv4(),
                source_node_id: triggerId,
                target_node_id: emailId,
                label: '',
            },
        ],
        trigger: {
            trigger_event_name: 'AUDIENCE_LEAD_SUBMISSION',
            event_applied_type: 'AUDIENCE',
            event_id: opts.audienceId,
        },
    };
}

interface FollowupOpts extends ConfirmationOpts {
    daysAgo: number;
}

function buildFollowupDTO(opts: FollowupOpts): WorkflowBuilderDTO {
    const queryId = uuidv4();
    const emailId = uuidv4();
    return {
        name: opts.name,
        description:
            opts.description
            || `Send follow-up email to leads who submitted "${opts.audienceName}" exactly ${opts.daysAgo} days ago`,
        status: 'ACTIVE',
        workflow_type: 'SCHEDULED',
        institute_id: opts.instituteId,
        nodes: [
            {
                id: queryId,
                name: 'Fetch recent leads',
                node_type: 'QUERY',
                config: {
                    prebuiltKey: 'fetch_audience_responses_filtered',
                    params: {
                        audienceId: opts.audienceId,
                        daysAgo: opts.daysAgo,
                    },
                    routing: [{ type: 'goto', targetNodeId: emailId, label: '' }],
                },
                position_x: 250,
                position_y: 50,
                is_start_node: true,
                is_end_node: false,
            },
            {
                id: emailId,
                name: `Send: ${opts.templateName}`,
                node_type: 'SEND_EMAIL',
                config: {
                    templateName: opts.templateName,
                    on: "#ctx['leads']",
                    forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
                    routing: [{ type: 'end' }],
                },
                position_x: 250,
                position_y: 230,
                is_start_node: false,
                is_end_node: true,
            },
        ],
        edges: [
            {
                id: uuidv4(),
                source_node_id: queryId,
                target_node_id: emailId,
                label: '',
            },
        ],
        schedule: {
            // Daily 9 AM IST — matches what the wizard's scheduled audience
            // followup uses. Admin can edit the cron in the workflow detail
            // page later if they want a different time.
            schedule_type: 'CRON',
            cron_expression: '0 0 9 * * ?',
            timezone: 'Asia/Kolkata',
        },
    };
}
