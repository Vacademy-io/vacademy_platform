import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
    MessageSquare,
    Mail,
    Bell,
    AlertCircle,
    ChevronRight,
    ChevronLeft,
    Loader2,
    Send,
    CheckCircle2,
    XCircle,
    type LucideIcon,
} from 'lucide-react';
import {
    sendAudienceMessage,
    type SendAudienceMessageRequest,
    type SendAudienceMessageResponse,
} from '../../-services/send-audience-message';
import {
    listTemplates,
    type WhatsAppTemplateDTO,
} from '@/routes/communication/whatsapp-templates/-services/template-api';
import {
    getMessageTemplates,
    getMessageTemplate,
} from '@/services/message-template-service';
import type { MessageTemplate } from '@/types/message-template-types';
import { toast } from 'sonner';
import { useGetCampaignById } from '../../-hooks/useGetCampaignById';
import { parseCustomFieldsFromJson } from '../../-utils/lead-bulk-import-utils';
import { fetchCampaignLeads } from '../../-services/get-campaign-users';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SendMessageDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    campaignId: string;
    campaignName: string;
    instituteId: string;
    customFields: Array<{ id: string; fieldName: string; fieldKey: string }>;
    leadCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SYSTEM_FIELDS = [
    { value: 'system:full_name', label: 'Full Name' },
    { value: 'system:email', label: 'Email' },
    { value: 'system:mobile_number', label: 'Mobile Number' },
    { value: 'system:city', label: 'City' },
    { value: 'system:region', label: 'Region' },
    { value: 'system:campaign_name', label: 'Campaign Name' },
    { value: 'system:submitted_at', label: 'Submitted At' },
    { value: 'system:source_type', label: 'Source Type' },
];

type Channel = 'WHATSAPP' | 'EMAIL' | 'PUSH' | 'SYSTEM_ALERT';

const CHANNELS: {
    value: Channel;
    label: string;
    description: string;
    icon: LucideIcon;
}[] = [
    {
        value: 'WHATSAPP',
        label: 'WhatsApp',
        description: 'Send templated messages via WhatsApp Business API',
        icon: MessageSquare,
    },
    {
        value: 'EMAIL',
        label: 'Email',
        description: 'Send emails with customizable subject and HTML body',
        icon: Mail,
    },
    {
        value: 'PUSH',
        label: 'Push Notification',
        description: 'Send push notifications to mobile and web users',
        icon: Bell,
    },
    {
        value: 'SYSTEM_ALERT',
        label: 'System Alert',
        description: 'Send in-app alerts visible in the notification center',
        icon: AlertCircle,
    },
];

const STEP_TITLES = ['Select Channel', 'Compose Content', 'Map Variables', 'Review & Send'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractPlaceholders(text: string): string[] {
    const matches = text.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    const unique = [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
    return unique;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SendMessageDialog({
    open,
    onOpenChange,
    campaignId,
    campaignName,
    instituteId,
    customFields: customFieldsProp,
    leadCount,
}: SendMessageDialogProps) {
    // Fetch campaign details to get custom fields when not provided via props
    const needsFieldFetch = customFieldsProp.length === 0;
    const { data: fetchedCampaign } = useGetCampaignById({
        instituteId,
        audienceId: campaignId,
        enabled: open && needsFieldFetch,
    });

    const fetchedFields = useMemo(() => {
        if (!fetchedCampaign?.institute_custom_fields) return [];
        return parseCustomFieldsFromJson(JSON.stringify(fetchedCampaign.institute_custom_fields));
    }, [fetchedCampaign]);

    const customFields = customFieldsProp.length > 0 ? customFieldsProp : fetchedFields;

    // Step
    const [step, setStep] = useState(1);

    // Channel
    const [channel, setChannel] = useState<Channel | ''>('');

    // WhatsApp state
    const [templates, setTemplates] = useState<WhatsAppTemplateDTO[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplateDTO | null>(null);
    const [languageCode, setLanguageCode] = useState('en');
    const [loadingTemplates, setLoadingTemplates] = useState(false);

    // Email state
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [emailType, setEmailType] = useState('UTILITY_EMAIL');
    const [emailTemplates, setEmailTemplates] = useState<MessageTemplate[]>([]);
    const [loadingEmailTemplates, setLoadingEmailTemplates] = useState(false);
    const [selectedEmailTemplateId, setSelectedEmailTemplateId] = useState<string>('custom');
    const [loadingTemplateContent, setLoadingTemplateContent] = useState(false);
    const [emailBodyView, setEmailBodyView] = useState<'preview' | 'edit'>('edit');

    // Push / System Alert state
    const [pushTitle, setPushTitle] = useState('');
    const [pushBody, setPushBody] = useState('');

    // Variable mapping
    const [variableMapping, setVariableMapping] = useState<Record<string, string>>({});

    // Send state
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState<SendAudienceMessageResponse | null>(null);

    // Resolved recipient count: prefer the prop (may already be known from the lead table view),
    // else fetch a 1-row page from the leads endpoint to read totalElements.
    const [resolvedLeadCount, setResolvedLeadCount] = useState<number | null>(
        leadCount > 0 ? leadCount : null
    );

    // -----------------------------------------------------------------------
    // Reset on close
    // -----------------------------------------------------------------------
    useEffect(() => {
        if (!open) {
            setStep(1);
            setChannel('');
            setTemplates([]);
            setSelectedTemplate(null);
            setLanguageCode('en');
            setLoadingTemplates(false);
            setSubject('');
            setBody('');
            setEmailType('UTILITY_EMAIL');
            setEmailTemplates([]);
            setLoadingEmailTemplates(false);
            setSelectedEmailTemplateId('custom');
            setLoadingTemplateContent(false);
            setEmailBodyView('edit');
            setPushTitle('');
            setPushBody('');
            setVariableMapping({});
            setIsSending(false);
            setSendResult(null);
            setResolvedLeadCount(leadCount > 0 ? leadCount : null);
        }
    }, [open, leadCount]);

    // -----------------------------------------------------------------------
    // Resolve actual lead count when caller didn't pass one.
    // -----------------------------------------------------------------------
    useEffect(() => {
        if (!open) return;
        if (leadCount > 0) return;
        let cancelled = false;
        fetchCampaignLeads({ audience_id: campaignId, page: 0, size: 1 })
            .then((res) => {
                if (!cancelled) setResolvedLeadCount(res.totalElements ?? 0);
            })
            .catch(() => {
                /* leave as null; UI falls back to "all members" */
            });
        return () => {
            cancelled = true;
        };
    }, [open, campaignId, leadCount]);

    // -----------------------------------------------------------------------
    // Fetch WA templates when channel is WHATSAPP
    // -----------------------------------------------------------------------
    useEffect(() => {
        if (channel !== 'WHATSAPP') return;
        let cancelled = false;
        setLoadingTemplates(true);
        listTemplates(instituteId)
            .then((data) => {
                if (!cancelled) setTemplates(data);
            })
            .catch(() => {
                if (!cancelled) toast.error('Failed to load WhatsApp templates');
            })
            .finally(() => {
                if (!cancelled) setLoadingTemplates(false);
            });
        return () => {
            cancelled = true;
        };
    }, [channel, instituteId]);

    // -----------------------------------------------------------------------
    // Fetch saved email templates when channel is EMAIL
    // -----------------------------------------------------------------------
    useEffect(() => {
        if (channel !== 'EMAIL') return;
        let cancelled = false;
        setLoadingEmailTemplates(true);
        // Pull a generous page so the dropdown shows everything the institute has.
        getMessageTemplates('EMAIL', 0, 100)
            .then((res) => {
                if (!cancelled) setEmailTemplates(res.templates);
            })
            .catch(() => {
                if (!cancelled) toast.error('Failed to load email templates');
            })
            .finally(() => {
                if (!cancelled) setLoadingEmailTemplates(false);
            });
        return () => {
            cancelled = true;
        };
    }, [channel]);

    // -----------------------------------------------------------------------
    // Apply selected email template (load full content -> prefill subject + body)
    // -----------------------------------------------------------------------
    const handleEmailTemplateSelect = useCallback(async (templateId: string) => {
        setSelectedEmailTemplateId(templateId);
        // Reset variable mapping since placeholders will change.
        setVariableMapping({});

        if (templateId === 'custom') {
            setSubject('');
            setBody('');
            setEmailBodyView('edit');
            return;
        }

        setLoadingTemplateContent(true);
        try {
            const full = await getMessageTemplate(templateId);
            setSubject(full.subject ?? '');
            setBody(full.content ?? '');
            // Default to rendered preview when a saved template loads.
            setEmailBodyView('preview');
        } catch {
            toast.error('Failed to load template content');
        } finally {
            setLoadingTemplateContent(false);
        }
    }, []);

    // -----------------------------------------------------------------------
    // Derived: approved templates
    // -----------------------------------------------------------------------
    const approvedTemplates = useMemo(
        () => templates.filter((t) => t.status === 'APPROVED'),
        [templates]
    );

    // -----------------------------------------------------------------------
    // Derived: variables to map
    // -----------------------------------------------------------------------
    const variableKeys = useMemo<string[]>(() => {
        if (channel === 'WHATSAPP' && selectedTemplate) {
            if (
                selectedTemplate.bodyVariableNames &&
                selectedTemplate.bodyVariableNames.length > 0
            ) {
                return selectedTemplate.bodyVariableNames;
            }
            return extractPlaceholders(selectedTemplate.bodyText ?? '');
        }
        if (channel === 'EMAIL') {
            const combined = `${subject} ${body}`;
            return extractPlaceholders(combined);
        }
        if (channel === 'PUSH' || channel === 'SYSTEM_ALERT') {
            const combined = `${pushTitle} ${pushBody}`;
            return extractPlaceholders(combined);
        }
        return [];
    }, [channel, selectedTemplate, subject, body, pushTitle, pushBody]);

    // -----------------------------------------------------------------------
    // Mapping options (system + custom)
    // -----------------------------------------------------------------------
    const mappingOptions = useMemo(() => {
        const custom = customFields.map((f) => ({
            value: `custom:${f.id}`,
            label: f.fieldName,
        }));
        return [...SYSTEM_FIELDS, ...custom];
    }, [customFields]);

    // -----------------------------------------------------------------------
    // Can proceed to next step?
    // -----------------------------------------------------------------------
    const canProceed = useMemo(() => {
        switch (step) {
            case 1:
                return channel !== '';
            case 2:
                if (channel === 'WHATSAPP') return selectedTemplate !== null;
                if (channel === 'EMAIL') return subject.trim() !== '' && body.trim() !== '';
                if (channel === 'PUSH' || channel === 'SYSTEM_ALERT')
                    return pushTitle.trim() !== '' && pushBody.trim() !== '';
                return false;
            case 3:
                return true; // mapping is optional
            default:
                return false;
        }
    }, [step, channel, selectedTemplate, subject, body, pushTitle, pushBody]);

    // -----------------------------------------------------------------------
    // Handlers
    // -----------------------------------------------------------------------
    const handleNext = useCallback(() => {
        if (step < 4) setStep((s) => s + 1);
    }, [step]);

    const handleBack = useCallback(() => {
        if (step > 1) setStep((s) => s - 1);
    }, [step]);

    const handleMappingChange = useCallback((varKey: string, fieldValue: string) => {
        setVariableMapping((prev) => ({ ...prev, [varKey]: fieldValue }));
    }, []);

    const handleTemplateSelect = useCallback(
        (templateName: string) => {
            const t = approvedTemplates.find((t) => t.name === templateName) ?? null;
            setSelectedTemplate(t);
            if (t?.language) setLanguageCode(t.language);
        },
        [approvedTemplates]
    );

    const handleSend = useCallback(async () => {
        if (!channel) return;
        setIsSending(true);
        try {
            const payload: SendAudienceMessageRequest = {
                institute_id: instituteId,
                channel: channel as SendAudienceMessageRequest['channel'],
                variable_mapping:
                    Object.keys(variableMapping).length > 0 ? variableMapping : undefined,
            };

            if (channel === 'WHATSAPP' && selectedTemplate) {
                payload.template_name = selectedTemplate.name;
                payload.language_code = languageCode;
            }
            if (channel === 'EMAIL') {
                payload.subject = subject;
                payload.body = body;
                payload.email_type = emailType;
            }
            if (channel === 'PUSH' || channel === 'SYSTEM_ALERT') {
                payload.subject = pushTitle;
                payload.body = pushBody;
            }

            const result = await sendAudienceMessage(campaignId, payload);
            setSendResult(result);
            toast.success('Message sent successfully');
        } catch (err: any) {
            toast.error(err?.message ?? 'Failed to send message');
        } finally {
            setIsSending(false);
        }
    }, [
        channel,
        instituteId,
        variableMapping,
        selectedTemplate,
        languageCode,
        subject,
        body,
        emailType,
        pushTitle,
        pushBody,
        campaignId,
    ]);

    // -----------------------------------------------------------------------
    // Channel icon helper
    // -----------------------------------------------------------------------
    const channelMeta = CHANNELS.find((c) => c.value === channel);

    // -----------------------------------------------------------------------
    // Render helpers
    // -----------------------------------------------------------------------

    const renderStepIndicator = () => (
        <div className="mb-6 flex w-full min-w-0 items-center gap-1 overflow-hidden">
            {STEP_TITLES.map((title, i) => {
                const stepNum = i + 1;
                const isActive = stepNum === step;
                const isDone = stepNum < step;
                return (
                    <div
                        key={title}
                        className={`flex min-w-0 items-center gap-1.5 ${isActive ? 'flex-1' : 'flex-none'}`}
                    >
                        {i > 0 && (
                            <div
                                className={`h-px flex-1 min-w-2 ${isDone ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                            />
                        )}
                        <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                                isActive
                                    ? 'bg-primary text-primary-foreground'
                                    : isDone
                                      ? 'bg-primary/20 text-primary'
                                      : 'bg-muted text-muted-foreground'
                            }`}
                        >
                            {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : stepNum}
                        </div>
                        {isActive && (
                            <span className="truncate text-xs font-semibold text-foreground">
                                {title}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );

    // Step 1 ------------------------------------------------------------------
    const handleChannelPick = (value: Channel) => {
        setChannel(value);
        // Skip the redundant "Next" click — channel choice is final on click.
        setStep(2);
    };

    const renderChannelSelection = () => (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {CHANNELS.map((ch) => {
                const Icon = ch.icon;
                const isSelected = channel === ch.value;
                return (
                    <button
                        key={ch.value}
                        type="button"
                        onClick={() => handleChannelPick(ch.value)}
                        className={`flex min-w-0 flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-colors hover:bg-muted/50 ${
                            isSelected
                                ? 'border-primary bg-primary/5'
                                : 'border-muted-foreground/20'
                        }`}
                    >
                        <Icon
                            className={`h-7 w-7 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}
                        />
                        <span className="text-sm font-semibold">{ch.label}</span>
                        <span className="text-xs text-muted-foreground line-clamp-3">
                            {ch.description}
                        </span>
                    </button>
                );
            })}
        </div>
    );

    // Step 2 ------------------------------------------------------------------
    const renderContent = () => {
        if (channel === 'WHATSAPP') {
            return (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Template</Label>
                        {loadingTemplates ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading templates...
                            </div>
                        ) : (
                            <Select
                                value={selectedTemplate?.name ?? ''}
                                onValueChange={handleTemplateSelect}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an approved template" />
                                </SelectTrigger>
                                <SelectContent>
                                    {approvedTemplates.map((t) => (
                                        <SelectItem key={t.name} value={t.name}>
                                            {t.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Language Code</Label>
                        <Input
                            value={languageCode}
                            onChange={(e) => setLanguageCode(e.target.value)}
                            placeholder="en"
                            className="w-32"
                        />
                    </div>

                    {selectedTemplate && (
                        <div className="space-y-2">
                            <Label>Template Preview</Label>
                            <div className="rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
                                {selectedTemplate.bodyText}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        if (channel === 'EMAIL') {
            return (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Template</Label>
                        {loadingEmailTemplates ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading templates...
                            </div>
                        ) : (
                            <Select
                                value={selectedEmailTemplateId}
                                onValueChange={handleEmailTemplateSelect}
                                disabled={loadingTemplateContent}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a template" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="custom">
                                        Custom — write from scratch
                                    </SelectItem>
                                    {emailTemplates.map((t) => (
                                        <SelectItem key={t.id} value={t.id}>
                                            {t.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        {loadingTemplateContent && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Loading template content...
                            </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label>Email Type</Label>
                        <Select value={emailType} onValueChange={setEmailType}>
                            <SelectTrigger className="w-60">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="UTILITY_EMAIL">Utility Email</SelectItem>
                                <SelectItem value="PROMOTIONAL_EMAIL">Promotional Email</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Subject</Label>
                        <Input
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Enter email subject..."
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Body</Label>
                        </div>
                        <Tabs
                            value={emailBodyView}
                            onValueChange={(v) => setEmailBodyView(v as 'preview' | 'edit')}
                            className="w-full"
                        >
                            <TabsList className="grid w-fit grid-cols-2">
                                <TabsTrigger value="preview">Preview</TabsTrigger>
                                <TabsTrigger value="edit">Edit HTML</TabsTrigger>
                            </TabsList>
                            <TabsContent value="preview" className="mt-2">
                                {body.trim() ? (
                                    <div
                                        className="min-h-[260px] max-h-[420px] overflow-auto rounded-md border bg-white p-4 text-sm text-neutral-900"
                                        dangerouslySetInnerHTML={{ __html: body }}
                                    />
                                ) : (
                                    <div className="flex min-h-[260px] items-center justify-center rounded-md border bg-muted/20 text-sm text-muted-foreground">
                                        Pick a template or switch to Edit HTML to write content.
                                    </div>
                                )}
                            </TabsContent>
                            <TabsContent value="edit" className="mt-2">
                                <Textarea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    placeholder="Enter email body HTML... use {{variable}} for placeholders"
                                    className="min-h-[260px] font-mono text-sm"
                                />
                            </TabsContent>
                        </Tabs>
                        <p className="text-xs text-muted-foreground">
                            Placeholders like <code className="font-mono">{'{{name}}'}</code> are
                            replaced per-recipient on send. Map them in the next step.
                        </p>
                    </div>
                </div>
            );
        }

        // PUSH or SYSTEM_ALERT
        return (
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                        value={pushTitle}
                        onChange={(e) => setPushTitle(e.target.value)}
                        placeholder="Notification title..."
                    />
                </div>
                <div className="space-y-2">
                    <Label>Body</Label>
                    <Textarea
                        value={pushBody}
                        onChange={(e) => setPushBody(e.target.value)}
                        placeholder="Notification body..."
                        className="min-h-[120px]"
                    />
                </div>
            </div>
        );
    };

    // Step 3 ------------------------------------------------------------------
    const renderVariableMapping = () => {
        if (variableKeys.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8" />
                    <p className="text-sm">No variables to map. You can proceed.</p>
                </div>
            );
        }

        return (
            <div className="space-y-1">
                <p className="mb-3 text-sm text-muted-foreground">
                    Map each template variable to a lead field.
                </p>
                <div className="rounded-md border">
                    <div className="grid grid-cols-2 gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground">
                        <span>Variable</span>
                        <span>Mapped Field</span>
                    </div>
                    {variableKeys.map((varKey) => (
                        <div
                            key={varKey}
                            className="grid grid-cols-2 items-center gap-4 border-b px-4 py-2 last:border-b-0"
                        >
                            <span className="rounded bg-muted px-2 py-1 font-mono text-sm">
                                {`{{${varKey}}}`}
                            </span>
                            <Select
                                value={variableMapping[varKey] ?? ''}
                                onValueChange={(val) => handleMappingChange(varKey, val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select field..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {mappingOptions.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Step 4 ------------------------------------------------------------------
    const renderReview = () => {
        if (sendResult) {
            const isSuccess = sendResult.status === 'SUCCESS' || sendResult.accepted > 0;
            return (
                <div className="flex flex-col items-center gap-4 py-8">
                    {isSuccess ? (
                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                    ) : (
                        <XCircle className="h-12 w-12 text-destructive" />
                    )}
                    <h3 className="text-lg font-semibold">
                        {isSuccess ? 'Message Sent' : 'Send Completed'}
                    </h3>
                    <div className="w-full max-w-sm space-y-2 rounded-md border p-4 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <span className="font-medium">{sendResult.status}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Recipients</span>
                            <span className="font-medium">{sendResult.recipient_count}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Accepted</span>
                            <span className="font-medium text-green-600">
                                {sendResult.accepted}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Failed</span>
                            <span className="font-medium text-destructive">
                                {sendResult.failed}
                            </span>
                        </div>
                    </div>
                    {sendResult.batch_id && (
                        <p className="text-xs text-muted-foreground">
                            Processing in background (batch: {sendResult.batch_id})
                        </p>
                    )}
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="mt-2">
                        Close
                    </Button>
                </div>
            );
        }

        const ChannelIcon = channelMeta?.icon ?? MessageSquare;
        const contentLabel =
            channel === 'WHATSAPP'
                ? selectedTemplate?.name
                : channel === 'EMAIL'
                  ? subject
                  : pushTitle;

        return (
            <div className="space-y-4">
                <div className="rounded-md border p-4 space-y-3">
                    <div className="flex items-center gap-3">
                        <ChannelIcon className="h-5 w-5 text-primary" />
                        <div>
                            <p className="text-sm font-semibold">{channelMeta?.label}</p>
                            <p className="text-xs text-muted-foreground">Channel</p>
                        </div>
                    </div>

                    <div className="border-t pt-3">
                        <p className="text-xs text-muted-foreground">
                            {channel === 'WHATSAPP' ? 'Template' : 'Subject / Title'}
                        </p>
                        <p className="text-sm font-medium">{contentLabel || '-'}</p>
                    </div>

                    <div className="border-t pt-3">
                        <p className="text-xs text-muted-foreground">Recipients</p>
                        <p className="text-sm font-medium">
                            {resolvedLeadCount !== null
                                ? `All ${resolvedLeadCount} member${resolvedLeadCount === 1 ? '' : 's'} of this audience`
                                : 'All members of this audience'}
                        </p>
                    </div>

                    {Object.keys(variableMapping).length > 0 && (
                        <div className="border-t pt-3">
                            <p className="mb-2 text-xs text-muted-foreground">Variable Mappings</p>
                            <div className="space-y-1">
                                {Object.entries(variableMapping).map(([varKey, field]) => {
                                    const fieldLabel =
                                        mappingOptions.find((o) => o.value === field)?.label ??
                                        field;
                                    return (
                                        <div
                                            key={varKey}
                                            className="flex items-center gap-2 text-xs"
                                        >
                                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
                                                {`{{${varKey}}}`}
                                            </span>
                                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                            <span>{fieldLabel}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <Button
                    className="w-full"
                    onClick={handleSend}
                    disabled={isSending}
                >
                    {isSending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                        </>
                    ) : (
                        <>
                            <Send className="mr-2 h-4 w-4" />
                            {resolvedLeadCount !== null
                                ? `Send to ${resolvedLeadCount} member${resolvedLeadCount === 1 ? '' : 's'}`
                                : 'Send to all members'}
                        </>
                    )}
                </Button>
            </div>
        );
    };

    // -----------------------------------------------------------------------
    // Main render
    // -----------------------------------------------------------------------
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
                <DialogHeader>
                    <DialogTitle>Send Message</DialogTitle>
                    <DialogDescription>
                        Send a message to leads in &ldquo;{campaignName}&rdquo;
                    </DialogDescription>
                </DialogHeader>

                {renderStepIndicator()}

                {step === 1 && renderChannelSelection()}
                {step === 2 && renderContent()}
                {step === 3 && renderVariableMapping()}
                {step === 4 && renderReview()}

                {/* Footer navigation (hidden after send result) */}
                {!sendResult && (
                    <div className="mt-6 flex items-center justify-between">
                        <div>
                            {step > 1 && (
                                <Button variant="ghost" size="sm" onClick={handleBack}>
                                    <ChevronLeft className="mr-1 h-4 w-4" />
                                    Back
                                </Button>
                            )}
                        </div>
                        <div>
                            {step < 4 && (
                                <Button size="sm" onClick={handleNext} disabled={!canProceed}>
                                    Next
                                    <ChevronRight className="ml-1 h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
