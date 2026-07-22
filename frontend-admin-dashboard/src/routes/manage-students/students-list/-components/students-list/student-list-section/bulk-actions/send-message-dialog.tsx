import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
    WhatsappLogo,
    CaretLeft,
    CaretRight,
    CircleNotch,
    PaperPlaneTilt,
    CheckCircle,
    XCircle,
} from '@phosphor-icons/react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import {
    listTemplates,
    type WhatsAppTemplateDTO,
} from '@/routes/communication/whatsapp-templates/-services/template-api';
import {
    fetchCustomFieldSetup,
    type CustomFieldSetupItem,
} from '@/routes/audience-manager/list/-services/get-custom-field-setup';
import {
    sendNotification,
    waitForBatchCompletion,
    type UnifiedSendResponse,
} from '@/services/unified-send-service';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import type { StudentTable } from '@/types/student-table-types';
import { useDialogStore } from '../../../../-hooks/useDialogStore';

// Multi-step compose flow modelled on the side-view IndividualSendDialog (WhatsApp
// branch), but multi-recipient: variables are resolved per selected student and the
// whole selection goes out in one unified send (queued as a durable batch when the
// selection is larger than one, so the request never hangs on per-recipient sends).
const STEP_TITLES = ['Select Template', 'Map Variables', 'Review & Send'];

// Student fields a template variable can be mapped to, resolved per recipient.
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
    ];

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

export const SendMessageDialog = () => {
    const { isSendMessageOpen, bulkActionInfo, selectedStudent, isBulkAction, closeAllDialogs } =
        useDialogStore();

    const instituteId = getCurrentInstituteId() || '';

    // Step
    const [step, setStep] = useState(1);

    // Template selection state
    const [templates, setTemplates] = useState<WhatsAppTemplateDTO[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplateDTO | null>(null);
    const [languageCode, setLanguageCode] = useState('en');

    // Custom field setup (to offer named custom-field mappings)
    const [customFieldSetup, setCustomFieldSetup] = useState<CustomFieldSetupItem[]>([]);

    // Variable mapping: varKey -> "system:..." | "custom:<fieldId>" | "static:<text>"
    const [variableMapping, setVariableMapping] = useState<Record<string, string>>({});

    // Send state
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState<UnifiedSendResponse | null>(null);

    // -----------------------------------------------------------------------
    // Recipients (only students that actually have a mobile number)
    // -----------------------------------------------------------------------
    const selectedStudents = useMemo<StudentTable[]>(() => {
        if (isBulkAction) return bulkActionInfo?.selectedStudents || [];
        return selectedStudent ? [selectedStudent] : [];
    }, [isBulkAction, bulkActionInfo, selectedStudent]);

    const recipients = useMemo(
        () => selectedStudents.filter((student) => student.mobile_number),
        [selectedStudents]
    );

    const skippedCount = selectedStudents.length - recipients.length;

    // -----------------------------------------------------------------------
    // Reset every time the dialog opens
    // -----------------------------------------------------------------------
    useEffect(() => {
        if (isSendMessageOpen) {
            setStep(1);
            setSelectedTemplate(null);
            setLanguageCode('en');
            setVariableMapping({});
            setIsSending(false);
            setSendResult(null);
        }
    }, [isSendMessageOpen]);

    // -----------------------------------------------------------------------
    // Load approved WhatsApp templates when the dialog opens
    // -----------------------------------------------------------------------
    useEffect(() => {
        if (!isSendMessageOpen || !instituteId) return;
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
    }, [isSendMessageOpen, instituteId]);

    // Load custom field setup once per open (non-fatal if it fails)
    useEffect(() => {
        if (!isSendMessageOpen || !instituteId) return;
        let cancelled = false;
        fetchCustomFieldSetup(instituteId)
            .then((data) => {
                if (!cancelled) setCustomFieldSetup(data);
            })
            .catch(() => {
                /* mapper simply won't offer custom fields */
            });
        return () => {
            cancelled = true;
        };
    }, [isSendMessageOpen, instituteId]);

    const approvedTemplates = useMemo(
        () => templates.filter((t) => t.status === 'APPROVED'),
        [templates]
    );

    const handleTemplateSelect = useCallback(
        (templateName: string) => {
            const t = approvedTemplates.find((x) => x.name === templateName) ?? null;
            setSelectedTemplate(t);
            if (t?.language) setLanguageCode(t.language);
            setVariableMapping({});
        },
        [approvedTemplates]
    );

    // -----------------------------------------------------------------------
    // Variables to map (template-declared names first, else body placeholders)
    // -----------------------------------------------------------------------
    const variableKeys = useMemo<string[]>(() => {
        if (!selectedTemplate) return [];
        if (selectedTemplate.bodyVariableNames?.length) {
            return selectedTemplate.bodyVariableNames;
        }
        return extractPlaceholders(selectedTemplate.bodyText ?? '');
    }, [selectedTemplate]);

    // Auto-map recognizable variables when they first appear
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

    const mappingOptions = useMemo(() => {
        const customs = customFieldSetup
            .filter((f) => !f.is_hidden)
            .map((f) => ({
                value: `custom:${f.custom_field_id}`,
                label: f.field_name || f.field_key,
            }));
        return [...SYSTEM_FIELDS.map((f) => ({ value: f.value, label: f.label })), ...customs];
    }, [customFieldSetup]);

    // Resolve one variable for one student
    const resolveValue = useCallback(
        (varKey: string, student: StudentTable): string => {
            const mapping = variableMapping[varKey];
            if (!mapping) return '';
            if (mapping.startsWith('static:')) return mapping.slice('static:'.length);
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
        [variableMapping]
    );

    const handleMappingChange = useCallback((varKey: string, fieldValue: string) => {
        setVariableMapping((prev) => ({ ...prev, [varKey]: fieldValue }));
    }, []);

    // -----------------------------------------------------------------------
    // Navigation
    // -----------------------------------------------------------------------
    const canProceed = useMemo(() => {
        switch (step) {
            case 1:
                return selectedTemplate !== null && recipients.length > 0;
            case 2:
                // A "Static value…" row left empty would send an empty WhatsApp
                // variable, which the provider rejects — block until filled.
                return !Object.values(variableMapping).some((v) => v === 'static:');
            default:
                return true;
        }
    }, [step, selectedTemplate, recipients.length, variableMapping]);

    const handleClose = useCallback(
        (open: boolean) => {
            if (open) return;
            if (isSending) return; // don't allow closing mid-send
            closeAllDialogs();
        },
        [isSending, closeAllDialogs]
    );

    // -----------------------------------------------------------------------
    // Send
    // -----------------------------------------------------------------------
    const handleSend = useCallback(async () => {
        if (!selectedTemplate) {
            toast.error('Select a WhatsApp template first.');
            return;
        }
        if (recipients.length === 0) {
            toast.error('No valid recipients with a mobile number.');
            return;
        }
        setIsSending(true);
        try {
            let result = await sendNotification({
                instituteId,
                channel: 'WHATSAPP',
                templateName: selectedTemplate.name,
                languageCode: languageCode || selectedTemplate.language || 'en',
                recipients: recipients.map((student) => {
                    const variables: Record<string, string> = {};
                    for (const k of variableKeys) {
                        variables[k] = resolveValue(k, student);
                    }
                    return {
                        phone: student.mobile_number,
                        userId: student.user_id,
                        name: student.full_name,
                        variables,
                    };
                }),
                // Multi-recipient sends run as a durable server-side batch so the
                // request returns immediately instead of timing out mid-send.
                forceAsync: recipients.length > 1,
                options: {
                    source: 'STUDENT_MANAGEMENT_BULK_WHATSAPP',
                    sourceId: uuidv4(),
                },
            });

            if (result.batchId && result.status === 'PROCESSING') {
                try {
                    result = await waitForBatchCompletion(result.batchId, (progress) =>
                        setSendResult(progress)
                    );
                } catch {
                    // Polling timed out; the batch keeps running server-side.
                }
            }

            setSendResult(result);
            if (result.status === 'FAILED') {
                toast.error('Failed to send WhatsApp messages. Please try again.');
            } else {
                toast.success('WhatsApp messages sent');
            }
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.'
            );
        } finally {
            setIsSending(false);
        }
    }, [selectedTemplate, recipients, instituteId, languageCode, variableKeys, resolveValue]);

    // -----------------------------------------------------------------------
    // Step indicator
    // -----------------------------------------------------------------------
    const renderStepIndicator = () => (
        <div className="mb-6 flex w-full min-w-0 items-center gap-2 overflow-hidden">
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
                                className={`h-px min-w-2 flex-1 ${isDone ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                            />
                        )}
                        <div
                            className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                                isActive
                                    ? 'bg-primary text-primary-foreground'
                                    : isDone
                                      ? 'bg-primary/20 text-primary'
                                      : 'bg-muted text-muted-foreground'
                            }`}
                        >
                            {isDone ? <CheckCircle className="size-3.5" /> : stepNum}
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

    // -----------------------------------------------------------------------
    // Step 1: template selection
    // -----------------------------------------------------------------------
    const renderTemplateStep = () => (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Template</Label>
                {loadingTemplates ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CircleNotch className="size-4 animate-spin" />
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
                {!loadingTemplates && approvedTemplates.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                        No approved WhatsApp templates found for this institute.
                    </p>
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
                    <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-sm">
                        {selectedTemplate.bodyText}
                    </div>
                </div>
            )}

            <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm">
                <span className="font-medium text-foreground">
                    {recipients.length} recipient{recipients.length === 1 ? '' : 's'}
                </span>
                <span className="text-muted-foreground"> will receive this message.</span>
                {skippedCount > 0 && (
                    <span className="text-muted-foreground">
                        {' '}
                        ({skippedCount} skipped — no mobile number)
                    </span>
                )}
            </div>
        </div>
    );

    // -----------------------------------------------------------------------
    // Step 2: variable mapping
    // -----------------------------------------------------------------------
    const renderVariableMapping = () => {
        if (variableKeys.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                    <CheckCircle className="size-8" />
                    <p className="text-sm">No variables to map. You can proceed.</p>
                </div>
            );
        }

        return (
            <div className="space-y-1">
                <p className="mb-3 text-sm text-muted-foreground">
                    Map each template variable to a student field, or set a fixed value. Values are
                    resolved per student on send.
                </p>
                <div className="rounded-md border">
                    <div className="grid grid-cols-2 gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground">
                        <span>Variable</span>
                        <span>Mapped Field</span>
                    </div>
                    {variableKeys.map((varKey) => {
                        const currentValue = variableMapping[varKey] ?? '';
                        const isStatic = currentValue.startsWith('static:');
                        const selectValue = isStatic ? '__static__' : currentValue;
                        const staticText = isStatic
                            ? currentValue.substring('static:'.length)
                            : '';

                        return (
                            <div
                                key={varKey}
                                className="grid grid-cols-2 items-center gap-4 border-b px-4 py-2 last:border-b-0"
                            >
                                <span className="rounded bg-muted px-2 py-1 font-mono text-sm">
                                    {`{{${varKey}}}`}
                                </span>
                                <div className="flex flex-col gap-2">
                                    <Select
                                        value={selectValue}
                                        onValueChange={(val) =>
                                            handleMappingChange(
                                                varKey,
                                                val === '__static__' ? 'static:' : val
                                            )
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select field..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__static__">Static value…</SelectItem>
                                            {mappingOptions.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {isStatic && (
                                        <Input
                                            value={staticText}
                                            onChange={(e) =>
                                                handleMappingChange(
                                                    varKey,
                                                    `static:${e.target.value}`
                                                )
                                            }
                                            placeholder='e.g. "Student"'
                                        />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // -----------------------------------------------------------------------
    // Step 3: review / result
    // -----------------------------------------------------------------------
    const renderReview = () => {
        if (sendResult && !isSending) {
            const failed = sendResult.failed ?? 0;
            const isSuccess = sendResult.status !== 'FAILED' && failed === 0;
            const failedResults = (sendResult.results ?? []).filter((r) => !r.success);
            return (
                <div className="flex flex-col items-center gap-4 py-8">
                    {isSuccess ? (
                        <CheckCircle className="size-12 text-success-500" />
                    ) : (
                        <XCircle className="size-12 text-danger-500" />
                    )}
                    <h3 className="text-lg font-semibold">
                        {isSuccess ? 'Messages Sent' : 'Send Completed'}
                    </h3>
                    <div className="w-full max-w-sm space-y-2 rounded-md border p-4 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Recipients</span>
                            <span className="font-medium">{sendResult.total}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Sent</span>
                            <span className="font-medium text-success-600">
                                {sendResult.accepted}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Failed</span>
                            <span className="font-medium text-danger-600">{failed}</span>
                        </div>
                        {sendResult.status === 'PROCESSING' && (
                            <p className="text-xs text-muted-foreground">
                                Still processing in the background — final counts appear in the
                                communication history.
                            </p>
                        )}
                    </div>
                    {failedResults.length > 0 && (
                        <div className="max-h-32 w-full max-w-sm space-y-1 overflow-auto rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                            {failedResults.slice(0, 10).map((r, idx) => (
                                <div key={`${r.phone}-${idx}`}>
                                    <span className="font-medium text-foreground">{r.phone}</span>
                                    : {r.error || r.status}
                                </div>
                            ))}
                        </div>
                    )}
                    <Button variant="outline" onClick={() => closeAllDialogs()} className="mt-2">
                        Close
                    </Button>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <div className="space-y-3 rounded-md border p-4">
                    <div className="flex items-center gap-3">
                        <WhatsappLogo className="size-5 text-primary" />
                        <div>
                            <p className="text-sm font-semibold">WhatsApp</p>
                            <p className="text-xs text-muted-foreground">Channel</p>
                        </div>
                    </div>
                    <div className="border-t pt-3">
                        <p className="text-xs text-muted-foreground">Template</p>
                        <p className="text-sm font-medium">{selectedTemplate?.name || '-'}</p>
                    </div>
                    <div className="border-t pt-3">
                        <p className="text-xs text-muted-foreground">Recipients</p>
                        <p className="text-sm font-medium">
                            {recipients.length} selected student
                            {recipients.length === 1 ? '' : 's'}
                            {skippedCount > 0 && (
                                <span className="text-muted-foreground">
                                    {' '}
                                    ({skippedCount} skipped — no mobile number)
                                </span>
                            )}
                        </p>
                    </div>
                    {variableKeys.some((k) => variableMapping[k]) && (
                        <div className="border-t pt-3">
                            <p className="mb-2 text-xs text-muted-foreground">Variable Mappings</p>
                            <div className="space-y-1">
                                {variableKeys
                                    .filter((k) => variableMapping[k])
                                    .map((varKey) => {
                                        const mapped = variableMapping[varKey] ?? '';
                                        const label = mapped.startsWith('static:')
                                            ? `Static: "${mapped.slice('static:'.length)}"`
                                            : (mappingOptions.find((o) => o.value === mapped)
                                                  ?.label ?? mapped);
                                        return (
                                            <div
                                                key={varKey}
                                                className="flex items-center gap-2 text-xs"
                                            >
                                                <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
                                                    {`{{${varKey}}}`}
                                                </span>
                                                <CaretRight className="size-3 text-muted-foreground" />
                                                <span>{label}</span>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}
                </div>

                <Button className="w-full" onClick={handleSend} disabled={isSending}>
                    {isSending ? (
                        <>
                            <CircleNotch className="mr-2 size-4 animate-spin" />
                            Sending...
                        </>
                    ) : (
                        <>
                            <PaperPlaneTilt className="mr-2 size-4" />
                            Send to {recipients.length} student
                            {recipients.length === 1 ? '' : 's'}
                        </>
                    )}
                </Button>
            </div>
        );
    };

    return (
        <Dialog open={isSendMessageOpen} onOpenChange={handleClose}>
            <DialogContent className="max-h-screen w-full overflow-y-auto overflow-x-hidden sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Send WhatsApp Message</DialogTitle>
                    <DialogDescription>
                        Send an approved WhatsApp template to the selected students.
                    </DialogDescription>
                </DialogHeader>

                {renderStepIndicator()}

                {step === 1 && renderTemplateStep()}
                {step === 2 && renderVariableMapping()}
                {step === 3 && renderReview()}

                {/* Footer navigation (hidden once a result is shown) */}
                {!sendResult && (
                    <div className="mt-6 flex items-center justify-between">
                        <div>
                            {step > 1 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setStep((s) => s - 1)}
                                    disabled={isSending}
                                >
                                    <CaretLeft className="mr-1 size-4" />
                                    Back
                                </Button>
                            )}
                        </div>
                        <div>
                            {step < 3 && (
                                <Button
                                    size="sm"
                                    onClick={() => setStep((s) => s + 1)}
                                    disabled={!canProceed}
                                >
                                    Next
                                    <CaretRight className="ml-1 size-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
