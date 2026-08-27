import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { Lightning, Clock } from '@phosphor-icons/react';
import { Trans, useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
    const { t } = useTranslation('audienceManagerConfigureAudienceWorkflowDialog');
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
            setName(t('nameSuggestion.confirmation', { audienceName }));
        } else {
            setName(t('nameSuggestion.followup', { audienceName, count: daysAgo }));
        }
    }, [kind, daysAgo, audienceName, nameTouched, t]);

    // Load the institute's email templates for the dropdown. Cached for 5 min.
    const { data: templateOptions = [], isLoading: templatesLoading } = useQuery({
        queryKey: ['configure-audience-workflow-templates'],
        queryFn: async () => {
            const result = await getMessageTemplates('EMAIL', 0, 100);
            return (result.templates ?? []).map((tpl: { name?: string; id?: string }) => ({
                value: tpl.name ?? tpl.id ?? '',
                label: tpl.name ?? t('fields.template.untitledFallback'),
            }));
        },
        staleTime: 5 * 60 * 1000,
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            const dto = kind === 'confirmation'
                ? buildConfirmationDTO(t, { name, description, instituteId, audienceId, audienceName, templateName })
                : buildFollowupDTO(t, { name, description, instituteId, audienceId, audienceName, templateName, daysAgo });
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
            toast.success(t('toast.success'));
            onOpenChange(false);
        },
        onError: (err) => {
            const msg = err instanceof Error ? err.message : t('toast.errorFallback');
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
                    <DialogTitle>{t('dialog.title')}</DialogTitle>
                    <DialogDescription>
                        <Trans
                            i18nKey="audienceManagerConfigureAudienceWorkflowDialog:dialog.description"
                            values={{ audienceName }}
                            components={{ bold: <span className="font-semibold" /> }}
                        />
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Kind picker — two large clickable cards */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-gray-700">
                            {t('kind.label')} <span className="text-red-400">*</span>
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                            <KindCard
                                selected={kind === 'confirmation'}
                                onClick={() => setKind('confirmation')}
                                icon={<Lightning size={18} />}
                                title={t('kind.confirmation.title')}
                                description={t('kind.confirmation.description')}
                            />
                            <KindCard
                                selected={kind === 'followup'}
                                onClick={() => setKind('followup')}
                                icon={<Clock size={18} />}
                                title={t('kind.followup.title')}
                                description={t('kind.followup.description')}
                            />
                        </div>
                    </div>

                    {/* Days input — only for follow-up */}
                    {kind === 'followup' && (
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-gray-700">
                                {t('fields.followupDays.label')} <span className="text-red-400">*</span>
                            </Label>
                            <Input
                                type="number"
                                min={1}
                                max={365}
                                value={daysAgo}
                                onChange={(e) => setDaysAgo(parseInt(e.target.value) || 1)}
                                className="w-32"
                            />
                            <p className="text-2xs text-gray-400">
                                {t('fields.followupDays.helper')}
                            </p>
                        </div>
                    )}

                    {/* Name */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-gray-700">
                            {t('fields.name.label')} <span className="text-red-400">*</span>
                        </Label>
                        <Input
                            value={name}
                            onChange={(e) => {
                                setNameTouched(true);
                                setName(e.target.value);
                            }}
                            placeholder={t('fields.name.placeholder')}
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-gray-700">
                            {t('fields.description.label')} <span className="text-gray-400 text-xs">{t('fields.description.optional')}</span>
                        </Label>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            placeholder={t('fields.description.placeholder')}
                        />
                    </div>

                    {/* Template */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-gray-700">
                            {t('fields.template.label')} <span className="text-red-400">*</span>
                        </Label>
                        <select
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                        >
                            <option value="">{templatesLoading ? t('fields.template.loading') : t('fields.template.placeholder')}</option>
                            {templateOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        {templateOptions.length === 0 && !templatesLoading && (
                            <p className="text-2xs text-amber-600">
                                {t('fields.template.noneFound')}
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
                        {t('actions.cancel')}
                    </Button>
                    <Button
                        onClick={() => createMutation.mutate()}
                        disabled={!canSubmit}
                        className="gap-1.5"
                    >
                        {createMutation.isPending ? t('actions.submitting') : t('actions.submit')}
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
            <p className="text-2xs text-gray-500 leading-relaxed">{description}</p>
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

function buildConfirmationDTO(t: TFunction, opts: ConfirmationOpts): WorkflowBuilderDTO {
    const triggerId = uuidv4();
    const emailId = uuidv4();
    return {
        name: opts.name,
        description: opts.description || t('dto.confirmation.descriptionFallback', { audienceName: opts.audienceName }),
        status: 'ACTIVE',
        workflow_type: 'EVENT_DRIVEN',
        institute_id: opts.instituteId,
        nodes: [
            {
                id: triggerId,
                name: t('dto.confirmation.triggerNodeName'),
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
                name: t('dto.sendNodeName', { templateName: opts.templateName }),
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
                        // Canonical spelling — the default template scaffold and most
                        // hand-written templates use {{name}}. notification-service
                        // aliases it too, but mapping it here keeps the config tab's
                        // template/variable drift check quiet.
                        name: 'Full Name',
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

function buildFollowupDTO(t: TFunction, opts: FollowupOpts): WorkflowBuilderDTO {
    const queryId = uuidv4();
    const emailId = uuidv4();
    return {
        name: opts.name,
        description:
            opts.description
            || t('dto.followup.descriptionFallback', { audienceName: opts.audienceName, count: opts.daysAgo }),
        status: 'ACTIVE',
        workflow_type: 'SCHEDULED',
        institute_id: opts.instituteId,
        nodes: [
            {
                id: queryId,
                name: t('dto.followup.queryNodeName'),
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
                name: t('dto.sendNodeName', { templateName: opts.templateName }),
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
