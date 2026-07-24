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
    ChevronRight,
    ChevronLeft,
    Loader2,
    Send,
    CheckCircle2,
    XCircle,
} from 'lucide-react';
import {
    listTemplates,
    type WhatsAppTemplateDTO,
} from '@/routes/communication/whatsapp-templates/-services/template-api';
import { getMessageTemplates, getMessageTemplate } from '@/services/message-template-service';
import type { MessageTemplate } from '@/types/message-template-types';
import { sendNotification } from '@/services/unified-send-service';
import type { UnifiedSendResponse } from '@/services/unified-send-service';
import {
    fetchCustomFieldSetup,
    type CustomFieldSetupItem,
} from '@/routes/audience-manager/list/-services/get-custom-field-setup';
import { StudentTable } from '@/types/student-table-types';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

type Channel = 'EMAIL' | 'WHATSAPP';

interface IndividualSendDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    student: StudentTable | null;
    channel: Channel;
    instituteId: string;
}

// System fields the user can map a variable to. Resolved against the StudentTable.
const SYSTEM_FIELDS: Array<{ value: string; label: string; resolve: (s: StudentTable) => string }> =
    [
        { value: 'system:full_name', label: 'Full Name', resolve: (s) => s.full_name || '' },
        { value: 'system:email', label: 'Email', resolve: (s) => s.email || '' },
        {
            value: 'system:mobile_number',
            label: 'Mobile Number',
            resolve: (s) => s.mobile_number || '',
        },
        { value: 'system:city', label: 'City', resolve: (s) => s.city || '' },
        { value: 'system:region', label: 'Region', resolve: (s) => s.region || '' },
        { value: 'system:gender', label: 'Gender', resolve: (s) => s.gender || '' },
        {
            value: 'system:enrollment_id',
            label: 'Enrollment ID',
            resolve: (s) => s.institute_enrollment_id || '',
        },
        {
            value: 'system:fathers_name',
            label: "Father's Name",
            resolve: (s) => s.fathers_name || '',
        },
        {
            value: 'system:mothers_name',
            label: "Mother's Name",
            resolve: (s) => s.mothers_name || '',
        },
    ];

const STEP_TITLES_EMAIL = ['Select Template', 'Compose Content', 'Map Variables', 'Review & Send'];
const STEP_TITLES_WHATSAPP = ['Select Template', 'Map Variables', 'Review & Send'];

function extractPlaceholders(text: string): string[] {
    const matches = text.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
}

// Best-effort auto-map: variable name "name" → system:full_name, etc.
function autoMapVariable(varKey: string): string | undefined {
    const k = varKey.toLowerCase();
    if (k === 'name' || k === 'full_name' || k === 'student_name' || k === 'fullname') {
        return 'system:full_name';
    }
    if (k === 'email' || k === 'email_id') return 'system:email';
    if (k === 'mobile' || k === 'mobile_number' || k === 'phone' || k === 'phone_number') {
        return 'system:mobile_number';
    }
    if (k === 'city') return 'system:city';
    if (k === 'region' || k === 'state') return 'system:region';
    if (k === 'gender') return 'system:gender';
    if (k === 'enrollment_id' || k === 'enrollment_number') return 'system:enrollment_id';
    return undefined;
}

export function IndividualSendDialog({
    open,
    onOpenChange,
    student,
    channel,
    instituteId,
}: IndividualSendDialogProps) {
    const STEP_TITLES = channel === 'EMAIL' ? STEP_TITLES_EMAIL : STEP_TITLES_WHATSAPP;
    const totalSteps = STEP_TITLES.length;
    const [step, setStep] = useState(1);

    // Email state
    const [emailTemplates, setEmailTemplates] = useState<MessageTemplate[]>([]);
    const [loadingEmailTemplates, setLoadingEmailTemplates] = useState(false);
    const [selectedEmailTemplateId, setSelectedEmailTemplateId] = useState<string>('');
    const [loadingTemplateContent, setLoadingTemplateContent] = useState(false);
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [emailType, setEmailType] = useState<
        'UTILITY_EMAIL' | 'PROMOTIONAL_EMAIL' | 'TRANSACTIONAL_EMAIL'
    >('UTILITY_EMAIL');
    const [emailBodyView, setEmailBodyView] = useState<'preview' | 'edit'>('edit');

    // WhatsApp state
    const [waTemplates, setWaTemplates] = useState<WhatsAppTemplateDTO[]>([]);
    const [loadingWaTemplates, setLoadingWaTemplates] = useState(false);
    const [selectedWaTemplate, setSelectedWaTemplate] = useState<WhatsAppTemplateDTO | null>(null);
    const [languageCode, setLanguageCode] = useState('en');
    // Media URL for templates whose header is IMAGE/VIDEO/DOCUMENT. Meta requires the
    // header component on every send of such a template — the sample approved with the
    // template is NOT attached automatically — so omitting it fails the whole send.
    const [headerMediaUrl, setHeaderMediaUrl] = useState('');

    // Custom fields setup (so we can show field names instead of IDs in the mapper)
    const [customFieldSetup, setCustomFieldSetup] = useState<CustomFieldSetupItem[]>([]);

    // Variable mapping: varKey -> "system:..." | "custom:<fieldId>" | "literal:<text>"
    const [variableMapping, setVariableMapping] = useState<Record<string, string>>({});
    const [literalValues, setLiteralValues] = useState<Record<string, string>>({});

    // Send state
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState<UnifiedSendResponse | null>(null);

    // Reset on close
    useEffect(() => {
        if (!open) {
            setStep(1);
            setSelectedEmailTemplateId('');
            setSubject('');
            setBody('');
            setEmailBodyView('edit');
            setSelectedWaTemplate(null);
            setLanguageCode('en');
            setHeaderMediaUrl('');
            setVariableMapping({});
            setLiteralValues({});
            setIsSending(false);
            setSendResult(null);
        }
    }, [open]);

    // Load templates when channel/open changes
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        if (channel === 'EMAIL') {
            setLoadingEmailTemplates(true);
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
        } else {
            setLoadingWaTemplates(true);
            listTemplates(instituteId)
                .then((data) => {
                    if (!cancelled) setWaTemplates(data);
                })
                .catch(() => {
                    if (!cancelled) toast.error('Failed to load WhatsApp templates');
                })
                .finally(() => {
                    if (!cancelled) setLoadingWaTemplates(false);
                });
        }
        return () => {
            cancelled = true;
        };
    }, [open, channel, instituteId]);

    // Load custom field setup once per open
    useEffect(() => {
        if (!open || !instituteId) return;
        let cancelled = false;
        fetchCustomFieldSetup(instituteId)
            .then((data) => {
                if (!cancelled) setCustomFieldSetup(data);
            })
            .catch(() => {
                /* non-fatal: mapper falls back to IDs */
            });
        return () => {
            cancelled = true;
        };
    }, [open, instituteId]);

    // Apply selected email template
    const handleEmailTemplateSelect = useCallback(async (templateId: string) => {
        setSelectedEmailTemplateId(templateId);
        setVariableMapping({});
        setLiteralValues({});
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
            setEmailBodyView('preview');
        } catch {
            toast.error('Failed to load template content');
        } finally {
            setLoadingTemplateContent(false);
        }
    }, []);

    const handleWaTemplateSelect = useCallback(
        (templateName: string) => {
            const t = waTemplates.find((x) => x.name === templateName) ?? null;
            setSelectedWaTemplate(t);
            if (t?.language) setLanguageCode(t.language);
            setVariableMapping({});
            setLiteralValues({});
            // Pre-fill with the media approved alongside the template so the common
            // case needs no extra input; still editable before sending.
            setHeaderMediaUrl(t?.headerSampleUrl ?? '');
        },
        [waTemplates]
    );

    /**
     * Lowercased media header kind ('image' | 'video' | 'document') when the selected
     * template carries a media header, else null. TEXT/NONE headers need no media.
     */
    const waHeaderKind = useMemo<'image' | 'video' | 'document' | null>(() => {
        const raw = selectedWaTemplate?.headerType?.toUpperCase();
        if (raw === 'IMAGE') return 'image';
        if (raw === 'VIDEO') return 'video';
        if (raw === 'DOCUMENT') return 'document';
        return null;
    }, [selectedWaTemplate]);

    const approvedWaTemplates = useMemo(
        () => waTemplates.filter((t) => t.status === 'APPROVED'),
        [waTemplates]
    );

    // Variables to map
    const variableKeys = useMemo<string[]>(() => {
        if (channel === 'WHATSAPP' && selectedWaTemplate) {
            if (selectedWaTemplate.bodyVariableNames?.length) {
                return selectedWaTemplate.bodyVariableNames;
            }
            return extractPlaceholders(selectedWaTemplate.bodyText ?? '');
        }
        if (channel === 'EMAIL') {
            return extractPlaceholders(`${subject} ${body}`);
        }
        return [];
    }, [channel, selectedWaTemplate, subject, body]);

    // Auto-map variables when they first appear
    useEffect(() => {
        if (variableKeys.length === 0) return;
        setVariableMapping((prev) => {
            const next = { ...prev };
            for (const k of variableKeys) {
                if (!next[k]) {
                    const auto = autoMapVariable(k);
                    if (auto) next[k] = auto;
                }
            }
            return next;
        });
    }, [variableKeys]);

    // Mapping options shown in dropdowns
    const mappingOptions = useMemo(() => {
        const customs = customFieldSetup
            .filter((f) => !f.is_hidden)
            .map((f) => ({
                value: `custom:${f.custom_field_id}`,
                label: f.field_name || f.field_key,
            }));
        return [...SYSTEM_FIELDS.map((f) => ({ value: f.value, label: f.label })), ...customs];
    }, [customFieldSetup]);

    // Resolve a single variable's runtime value from the current student
    const resolveValue = useCallback(
        (varKey: string): string => {
            if (!student) return '';
            const mapping = variableMapping[varKey];
            if (!mapping) return '';
            if (mapping.startsWith('literal:')) {
                return literalValues[varKey] ?? '';
            }
            if (mapping.startsWith('system:')) {
                const sys = SYSTEM_FIELDS.find((f) => f.value === mapping);
                return sys?.resolve(student) ?? '';
            }
            if (mapping.startsWith('custom:')) {
                const fieldId = mapping.slice('custom:'.length);
                return student.custom_fields?.[fieldId] ?? '';
            }
            return '';
        },
        [student, variableMapping, literalValues]
    );

    const resolvedVariables = useMemo(() => {
        const out: Record<string, string> = {};
        for (const k of variableKeys) {
            out[k] = resolveValue(k);
        }
        return out;
    }, [variableKeys, resolveValue]);

    // Replace placeholders in a string with resolved values (for email preview/send)
    const interpolate = useCallback(
        (text: string) => {
            if (!text) return text;
            return text.replace(/\{\{(\w+)\}\}/g, (_, key) => resolvedVariables[key] ?? '');
        },
        [resolvedVariables]
    );

    const canProceed = useMemo(() => {
        if (channel === 'EMAIL') {
            switch (step) {
                case 1:
                    return !!selectedEmailTemplateId;
                case 2:
                    return subject.trim() !== '' && body.trim() !== '';
                case 3:
                    return true; // mapping optional
                default:
                    return false;
            }
        }
        // WHATSAPP
        switch (step) {
            case 1:
                return selectedWaTemplate !== null;
            case 2:
                // A media-header template without its media is guaranteed to be rejected
                // by the provider, so block it here instead of failing at send time.
                return !waHeaderKind || headerMediaUrl.trim() !== '';
            default:
                return false;
        }
    }, [
        channel,
        step,
        selectedEmailTemplateId,
        subject,
        body,
        selectedWaTemplate,
        waHeaderKind,
        headerMediaUrl,
    ]);

    const handleNext = useCallback(() => {
        if (step < totalSteps) setStep((s) => s + 1);
    }, [step, totalSteps]);

    const handleBack = useCallback(() => {
        if (step > 1) setStep((s) => s - 1);
    }, [step]);

    const handleMappingChange = useCallback((varKey: string, fieldValue: string) => {
        setVariableMapping((prev) => ({ ...prev, [varKey]: fieldValue }));
    }, []);

    const handleLiteralChange = useCallback((varKey: string, text: string) => {
        setLiteralValues((prev) => ({ ...prev, [varKey]: text }));
    }, []);

    const handleSend = useCallback(async () => {
        if (!student || !instituteId) return;

        // Validate recipient has the right contact for the channel
        if (channel === 'EMAIL' && !student.email) {
            toast.error('This learner has no email address.');
            return;
        }
        if (channel === 'WHATSAPP' && !student.mobile_number) {
            toast.error('This learner has no mobile number.');
            return;
        }

        setIsSending(true);
        try {
            if (channel === 'EMAIL') {
                const result = await sendNotification({
                    instituteId,
                    channel: 'EMAIL',
                    recipients: [
                        {
                            email: student.email,
                            userId: student.user_id,
                            name: student.full_name,
                            variables: resolvedVariables,
                        },
                    ],
                    options: {
                        emailSubject: interpolate(subject),
                        emailBody: interpolate(body),
                        emailType,
                        source: 'STUDENT_SIDE_VIEW',
                        sourceId: uuidv4(),
                    },
                });
                setSendResult(result);
                toast.success('Email sent');
            } else {
                if (!selectedWaTemplate) {
                    toast.error('Select a WhatsApp template first');
                    setIsSending(false);
                    return;
                }
                const result = await sendNotification({
                    instituteId,
                    channel: 'WHATSAPP',
                    templateName: selectedWaTemplate.name,
                    languageCode: languageCode || selectedWaTemplate.language || 'en',
                    recipients: [
                        {
                            phone: student.mobile_number,
                            userId: student.user_id,
                            name: student.full_name,
                            variables: resolvedVariables,
                        },
                    ],
                    options: {
                        source: 'STUDENT_SIDE_VIEW',
                        sourceId: uuidv4(),
                        // Meta rejects the whole send if a media-header template arrives
                        // without its header component, so always thread it through.
                        ...(waHeaderKind && headerMediaUrl.trim()
                            ? {
                                  headerType: waHeaderKind,
                                  headerUrl: headerMediaUrl.trim(),
                              }
                            : {}),
                    },
                });
                setSendResult(result);
                toast.success('WhatsApp message sent');
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to send';
            toast.error(msg);
        } finally {
            setIsSending(false);
        }
    }, [
        student,
        instituteId,
        channel,
        resolvedVariables,
        subject,
        body,
        emailType,
        selectedWaTemplate,
        languageCode,
        interpolate,
    ]);

    const channelIcon = channel === 'EMAIL' ? Mail : MessageSquare;
    const ChannelIcon = channelIcon;

    // ------- render helpers -------

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
                                className={`h-px min-w-2 flex-1 ${isDone ? 'bg-primary-500' : 'bg-neutral-200'}`}
                            />
                        )}
                        <div
                            className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ring-1 transition-colors ${
                                isActive
                                    ? 'bg-primary-500 text-white shadow-sm ring-primary-500'
                                    : isDone
                                      ? 'bg-primary-100 text-primary-600 ring-primary-200'
                                      : 'bg-neutral-100 text-neutral-500 ring-neutral-200'
                            }`}
                        >
                            {isDone ? <CheckCircle2 className="size-3.5" /> : stepNum}
                        </div>
                        {isActive && (
                            <span className="truncate text-xs font-semibold text-primary-600">
                                {title}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );

    const renderEmailTemplateStep = () => (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Template</Label>
                {loadingEmailTemplates ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
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
                            <SelectItem value="custom">Custom — write from scratch</SelectItem>
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
                        <Loader2 className="size-3 animate-spin" />
                        Loading template content...
                    </div>
                )}
            </div>
        </div>
    );

    const renderEmailComposeStep = () => (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Email Type</Label>
                <Select
                    value={emailType}
                    onValueChange={(v) => setEmailType(v as typeof emailType)}
                >
                    <SelectTrigger className="w-60">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="UTILITY_EMAIL">Utility Email</SelectItem>
                        <SelectItem value="PROMOTIONAL_EMAIL">Promotional Email</SelectItem>
                        <SelectItem value="TRANSACTIONAL_EMAIL">Transactional Email</SelectItem>
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
                <Label>Body</Label>
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
                                className="max-h-[420px] min-h-[260px] overflow-auto rounded-md border bg-white p-4 text-sm text-neutral-900"
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
                    Placeholders like <code className="font-mono">{'{{name}}'}</code> are replaced
                    with the learner&apos;s data on send. Map them in the next step.
                </p>
            </div>
        </div>
    );

    const renderWaTemplateStep = () => (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Template</Label>
                {loadingWaTemplates ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Loading templates...
                    </div>
                ) : (
                    <Select
                        value={selectedWaTemplate?.name ?? ''}
                        onValueChange={handleWaTemplateSelect}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select an approved template" />
                        </SelectTrigger>
                        <SelectContent>
                            {approvedWaTemplates.map((t) => (
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
            {selectedWaTemplate && (
                <div className="space-y-2">
                    <Label>Template Preview</Label>
                    <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-sm">
                        {selectedWaTemplate.bodyText}
                    </div>
                </div>
            )}
        </div>
    );

    // Media header input — rendered for any template whose header is IMAGE/VIDEO/DOCUMENT.
    // Without it the provider rejects the send outright, so it is a required field.
    const renderHeaderMediaField = () => {
        if (!waHeaderKind) return null;
        const url = headerMediaUrl.trim();
        return (
            <div className="mb-4 space-y-2 rounded-md border bg-muted/30 p-4">
                <Label>
                    Header {waHeaderKind} URL <span className="text-danger-600">*</span>
                </Label>
                <Input
                    value={headerMediaUrl}
                    onChange={(e) => setHeaderMediaUrl(e.target.value)}
                    placeholder="https://..."
                />
                <p className="text-xs text-muted-foreground">
                    This template has a {waHeaderKind} header, which WhatsApp requires on every
                    send — the message fails without it. Pre-filled with the media approved
                    alongside the template.
                </p>
                {waHeaderKind === 'image' && url && (
                    <img
                        src={url}
                        alt="Header preview"
                        className="max-h-40 rounded-md border object-contain"
                    />
                )}
            </div>
        );
    };

    const renderVariableMappingStep = () => {
        if (variableKeys.length === 0) {
            return (
                <div>
                    {renderHeaderMediaField()}
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                        <CheckCircle2 className="size-8" />
                        <p className="text-sm">No variables to map. You can proceed.</p>
                    </div>
                </div>
            );
        }
        return (
            <div className="space-y-1">
                {renderHeaderMediaField()}
                <p className="mb-3 text-sm text-muted-foreground">
                    Map each placeholder to a learner field, or enter a literal value.
                </p>
                <div className="rounded-md border">
                    {/* `minmax(0,...)` on every column lets long content (e.g. emails)
                        truncate inside the cell instead of forcing the row wider than
                        the dialog. The pill column is intentionally narrowest. */}
                    <div className="grid grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,1.4fr)] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground">
                        <span>Variable</span>
                        <span>Source</span>
                        <span>Resolved Value</span>
                    </div>
                    {variableKeys.map((varKey) => {
                        const mapping = variableMapping[varKey] ?? '';
                        const isLiteral = mapping.startsWith('literal:');
                        const resolved = resolveValue(varKey);
                        return (
                            <div
                                key={varKey}
                                className="grid grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3 border-b px-4 py-2 last:border-b-0"
                            >
                                <span
                                    className="truncate rounded bg-neutral-100 px-2 py-1 font-mono text-xs text-neutral-700"
                                    title={`{{${varKey}}}`}
                                >
                                    {`{{${varKey}}}`}
                                </span>
                                <div className="flex min-w-0 flex-col gap-1">
                                    <Select
                                        value={mapping}
                                        onValueChange={(val) => handleMappingChange(varKey, val)}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select source..." />
                                        </SelectTrigger>
                                        {/* Cap the popover height to whatever room
                                            Radix has between the trigger and the
                                            viewport edge, so it never overflows the
                                            dialog when flipped above the trigger. */}
                                        <SelectContent
                                            className="max-h-[var(--radix-select-content-available-height)]"
                                        >
                                            {mappingOptions.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                            <SelectItem value="literal:value">
                                                Literal value...
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {isLiteral && (
                                        <Input
                                            value={literalValues[varKey] ?? ''}
                                            onChange={(e) =>
                                                handleLiteralChange(varKey, e.target.value)
                                            }
                                            placeholder="Type a value"
                                            className="h-8 text-xs"
                                        />
                                    )}
                                </div>
                                <span
                                    className="block min-w-0 truncate text-xs text-neutral-700"
                                    title={resolved}
                                >
                                    {resolved || (
                                        <span className="italic text-neutral-400">
                                            (unresolved)
                                        </span>
                                    )}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderReviewStep = () => {
        if (sendResult) {
            const ok = sendResult.status === 'COMPLETED' || sendResult.accepted > 0;
            return (
                <div className="flex flex-col items-center gap-4 py-8">
                    {ok ? (
                        <CheckCircle2 className="size-12 text-green-500" />
                    ) : (
                        <XCircle className="size-12 text-destructive" />
                    )}
                    <h3 className="text-lg font-semibold">
                        {ok ? 'Message Sent' : 'Send Completed'}
                    </h3>
                    <div className="w-full max-w-sm space-y-2 rounded-md border p-4 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <span className="font-medium">{sendResult.status}</span>
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
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="mt-2">
                        Close
                    </Button>
                </div>
            );
        }

        const headerLabel =
            channel === 'EMAIL'
                ? interpolate(subject) || '(no subject)'
                : selectedWaTemplate?.name || '-';
        const recipient = channel === 'EMAIL' ? student?.email : student?.mobile_number;

        return (
            <div className="space-y-4">
                <div className="space-y-3 rounded-md border p-4">
                    <div className="flex items-center gap-3">
                        <ChannelIcon className="size-5 text-primary-500" />
                        <div>
                            <p className="text-sm font-semibold">
                                {channel === 'EMAIL' ? 'Email' : 'WhatsApp'}
                            </p>
                            <p className="text-xs text-muted-foreground">Channel</p>
                        </div>
                    </div>
                    <div className="border-t pt-3">
                        <p className="text-xs text-muted-foreground">
                            {channel === 'EMAIL' ? 'Subject' : 'Template'}
                        </p>
                        <p className="text-sm font-medium">{headerLabel}</p>
                    </div>
                    <div className="border-t pt-3">
                        <p className="text-xs text-muted-foreground">Recipient</p>
                        <p className="text-sm font-medium">
                            {student?.full_name}
                            {recipient && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                    ({recipient})
                                </span>
                            )}
                        </p>
                    </div>
                    {variableKeys.length > 0 && (
                        <div className="border-t pt-3">
                            <p className="mb-2 text-xs text-muted-foreground">Variables</p>
                            <div className="space-y-1">
                                {variableKeys.map((k) => (
                                    <div key={k} className="flex items-center gap-2 text-xs">
                                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
                                            {`{{${k}}}`}
                                        </span>
                                        <ChevronRight className="size-3 text-muted-foreground" />
                                        <span className="truncate">
                                            {resolvedVariables[k] || (
                                                <span className="italic text-neutral-400">
                                                    (empty)
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <Button className="w-full" onClick={handleSend} disabled={isSending}>
                    {isSending ? (
                        <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Sending...
                        </>
                    ) : (
                        <>
                            <Send className="mr-2 size-4" />
                            Send to {student?.full_name}
                        </>
                    )}
                </Button>
            </div>
        );
    };

    const renderStep = () => {
        if (channel === 'EMAIL') {
            if (step === 1) return renderEmailTemplateStep();
            if (step === 2) return renderEmailComposeStep();
            if (step === 3) return renderVariableMappingStep();
            if (step === 4) return renderReviewStep();
        } else {
            if (step === 1) return renderWaTemplateStep();
            if (step === 2) return renderVariableMappingStep();
            if (step === 3) return renderReviewStep();
        }
        return null;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] overflow-y-auto overflow-x-hidden sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Send {channel === 'EMAIL' ? 'Email' : 'WhatsApp'}</DialogTitle>
                    <DialogDescription>
                        {student
                            ? `Send a ${channel === 'EMAIL' ? 'templated email' : 'templated WhatsApp message'} to ${student.full_name}.`
                            : 'No learner selected.'}
                    </DialogDescription>
                </DialogHeader>

                {renderStepIndicator()}
                {renderStep()}

                {!sendResult && (
                    <div className="mt-6 flex items-center justify-between">
                        <div>
                            {step > 1 && (
                                <Button variant="ghost" size="sm" onClick={handleBack}>
                                    <ChevronLeft className="mr-1 size-4" />
                                    Back
                                </Button>
                            )}
                        </div>
                        <div>
                            {step < totalSteps && (
                                <Button size="sm" onClick={handleNext} disabled={!canProceed}>
                                    Next
                                    <ChevronRight className="ml-1 size-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
