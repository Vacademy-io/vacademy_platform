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
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
    Envelope,
    CaretLeft,
    CaretRight,
    CircleNotch,
    PaperPlaneTilt,
    CheckCircle,
    XCircle,
} from '@phosphor-icons/react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { getMessageTemplates, getMessageTemplate } from '@/services/message-template-service';
import type { MessageTemplate } from '@/types/message-template-types';
import { bulkEmailService, type BulkEmailResult } from '@/services/bulkEmailService';
import { useDialogStore } from '../../../../-hooks/useDialogStore';

// Multi-step compose flow modelled on the audience-manager SendMessageDialog, but
// email-only and wired to bulkEmailService so it targets the *selected* students
// (with automatic per-student variable enrichment) rather than a saved audience.
const STEP_TITLES = ['Compose Email', 'Map Variables', 'Review & Send'];

// Student fields a {{placeholder}} can be mapped to. The value after `field:` is the
// canonical variable name that bulkEmailService auto-resolves per recipient on send.
const STUDENT_FIELDS: { value: string; label: string }[] = [
    { value: 'field:name', label: 'Full Name' },
    { value: 'field:email', label: 'Email' },
    { value: 'field:mobile_number', label: 'Mobile Number' },
    { value: 'field:username', label: 'Username' },
    { value: 'field:enrollment_number', label: 'Enrollment Number' },
    { value: 'field:registration_date', label: 'Registration Date' },
    { value: 'field:student_referral_code', label: 'Referral Code' },
    { value: 'field:course_name', label: 'Course Name' },
    { value: 'field:batch_name', label: 'Batch Name' },
    { value: 'field:batch_start_date', label: 'Batch Start Date' },
    { value: 'field:batch_end_date', label: 'Batch End Date' },
    { value: 'field:institute_name', label: 'Institute Name' },
    { value: 'field:institute_email', label: 'Institute Email' },
    { value: 'field:institute_phone', label: 'Institute Phone' },
    { value: 'field:attendance_percentage', label: 'Attendance %' },
    { value: 'field:attendance_attended_classes', label: 'Classes Attended' },
    { value: 'field:attendance_total_classes', label: 'Total Classes' },
    { value: 'field:current_date', label: 'Current Date' },
    { value: 'field:support_email', label: 'Support Email' },
];

// Pull unique {{placeholder}} keys out of a string.
function extractPlaceholders(text: string): string[] {
    const matches = text.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
}

// Rewrite a template by applying the variable mapping:
//  - field:<var>  -> {{<var>}}  (a canonical name bulkEmailService resolves per student)
//  - static:<txt> -> the literal text
//  - unmapped     -> left as-is (standard names like {{name}} still auto-resolve)
function applyMapping(text: string, mapping: Record<string, string>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (full, key) => {
        const v = mapping[key];
        if (!v) return full;
        if (v.startsWith('static:')) return v.slice('static:'.length);
        if (v.startsWith('field:')) return `{{${v.slice('field:'.length)}}}`;
        return full;
    });
}

const fieldLabel = (val: string): string => {
    if (val.startsWith('static:')) return `Static: "${val.slice('static:'.length)}"`;
    return STUDENT_FIELDS.find((o) => o.value === val)?.label ?? val;
};

export const SendEmailDialog = () => {
    const { isSendEmailOpen, bulkActionInfo, selectedStudent, isBulkAction, closeAllDialogs } =
        useDialogStore();

    // Step
    const [step, setStep] = useState(1);

    // Compose state
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [bodyView, setBodyView] = useState<'preview' | 'edit'>('edit');

    // Template selection state
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('custom');
    const [loadingTemplateContent, setLoadingTemplateContent] = useState(false);

    // Variable mapping ({{placeholder}} -> field:<var> | static:<text>)
    const [variableMapping, setVariableMapping] = useState<Record<string, string>>({});

    // Send state
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState<BulkEmailResult | null>(null);

    // Placeholders present across subject + body (drives the mapping step)
    const variableKeys = useMemo(
        () => extractPlaceholders(`${subject} ${body}`),
        [subject, body]
    );

    const handleMappingChange = useCallback((varKey: string, fieldValue: string) => {
        setVariableMapping((prev) => ({ ...prev, [varKey]: fieldValue }));
    }, []);

    // -----------------------------------------------------------------------
    // Recipients (only students that actually have an email address)
    // -----------------------------------------------------------------------
    const recipients = useMemo(() => {
        const students = isBulkAction
            ? bulkActionInfo?.selectedStudents || []
            : selectedStudent
              ? [selectedStudent]
              : [];
        return students.filter((student) => student.email);
    }, [isBulkAction, bulkActionInfo, selectedStudent]);

    const skippedCount = useMemo(() => {
        const total = isBulkAction
            ? bulkActionInfo?.selectedStudents?.length || 0
            : selectedStudent
              ? 1
              : 0;
        return Math.max(0, total - recipients.length);
    }, [isBulkAction, bulkActionInfo, selectedStudent, recipients.length]);

    // -----------------------------------------------------------------------
    // Reset every time the dialog opens
    // -----------------------------------------------------------------------
    useEffect(() => {
        if (isSendEmailOpen) {
            setStep(1);
            setSubject('');
            setBody('');
            setBodyView('edit');
            setSelectedTemplateId('custom');
            setLoadingTemplateContent(false);
            setVariableMapping({});
            setIsSending(false);
            setSendResult(null);
        }
    }, [isSendEmailOpen]);

    // -----------------------------------------------------------------------
    // Load saved email templates when the dialog opens
    // -----------------------------------------------------------------------
    useEffect(() => {
        if (!isSendEmailOpen) return;
        let cancelled = false;
        setLoadingTemplates(true);
        getMessageTemplates('EMAIL', 0, 100)
            .then((res) => {
                if (!cancelled) setTemplates(res.templates);
            })
            .catch(() => {
                if (!cancelled) toast.error('Failed to load email templates');
            })
            .finally(() => {
                if (!cancelled) setLoadingTemplates(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isSendEmailOpen]);

    // -----------------------------------------------------------------------
    // Apply a saved template (load full content -> prefill subject + body)
    // -----------------------------------------------------------------------
    const handleTemplateSelect = useCallback(async (templateId: string) => {
        setSelectedTemplateId(templateId);
        // Placeholders change with the template, so drop any prior mapping.
        setVariableMapping({});

        if (templateId === 'custom') {
            setSubject('');
            setBody('');
            setBodyView('edit');
            return;
        }

        setLoadingTemplateContent(true);
        try {
            const full = await getMessageTemplate(templateId);
            setSubject(full.subject ?? '');
            setBody(full.content ?? '');
            // Default to the rendered preview when a saved template loads.
            setBodyView('preview');
        } catch {
            toast.error('Failed to load template content');
        } finally {
            setLoadingTemplateContent(false);
        }
    }, []);

    // -----------------------------------------------------------------------
    // Navigation
    // -----------------------------------------------------------------------
    const canProceed = useMemo(() => {
        switch (step) {
            case 1:
                return subject.trim() !== '' && body.trim() !== '' && recipients.length > 0;
            case 2:
                // Mapping is optional, but a "Static value…" row left empty would send a
                // blank — block until the user types something (or picks a field).
                return !Object.values(variableMapping).some((v) => v === 'static:');
            default:
                return true;
        }
    }, [step, subject, body, recipients.length, variableMapping]);

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
        if (recipients.length === 0) {
            toast.error('No valid recipients to send email to.');
            return;
        }
        setIsSending(true);
        try {
            // Resolve mapped placeholders to canonical variables / static text first.
            const finalSubject = applyMapping(subject, variableMapping).trim();
            const finalBody = applyMapping(body, variableMapping).trim();
            const result = await bulkEmailService.sendBulkEmail({
                template: finalBody,
                subject: finalSubject,
                students: recipients,
                context: 'student-management',
                notificationType: 'EMAIL',
                source: 'STUDENT_MANAGEMENT_BULK_EMAIL',
                sourceId: uuidv4(),
                enrichmentOptions: {
                    includeCourse: true,
                    includeBatch: true,
                    includeInstitute: true,
                    includeAttendance: true,
                    includeLiveClass: true,
                    includeReferral: true,
                    includeCustomFields: true,
                },
            });
            setSendResult(result);
            if (result.success) {
                toast.success('Email sent successfully');
            } else {
                const validationError = result.errors?.find((e) => e.studentId === 'validation');
                toast.error(validationError?.error ?? 'Failed to send email. Please try again.');
            }
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.'
            );
        } finally {
            setIsSending(false);
        }
    }, [recipients, body, subject, variableMapping]);

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
    // Step 1: compose
    // -----------------------------------------------------------------------
    const renderCompose = () => (
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
                        value={selectedTemplateId}
                        onValueChange={handleTemplateSelect}
                        disabled={loadingTemplateContent}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="custom">Custom — write from scratch</SelectItem>
                            {templates.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                    {t.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                {loadingTemplateContent && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CircleNotch className="size-3 animate-spin" />
                        Loading template content...
                    </div>
                )}
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
                    value={bodyView}
                    onValueChange={(v) => setBodyView(v as 'preview' | 'edit')}
                    className="w-full"
                >
                    <TabsList className="grid w-fit grid-cols-2">
                        <TabsTrigger value="preview">Preview</TabsTrigger>
                        <TabsTrigger value="edit">Edit HTML</TabsTrigger>
                    </TabsList>
                    <TabsContent value="preview" className="mt-2">
                        {body.trim() ? (
                            <div
                                className="max-h-96 min-h-64 overflow-auto rounded-md border bg-white p-4 text-sm text-neutral-900"
                                dangerouslySetInnerHTML={{ __html: body }}
                            />
                        ) : (
                            <div className="flex min-h-64 items-center justify-center rounded-md border bg-muted/20 text-sm text-muted-foreground">
                                Pick a template or switch to Edit HTML to write content.
                            </div>
                        )}
                    </TabsContent>
                    <TabsContent value="edit" className="mt-2">
                        <Textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Enter email body HTML... use {{variable}} for placeholders"
                            className="min-h-64 font-mono text-sm"
                        />
                    </TabsContent>
                </Tabs>
                <p className="text-xs text-muted-foreground">
                    Use placeholders like <code className="font-mono">{'{{name}}'}</code> — you can
                    map them to student fields (course, batch, attendance &amp; more) in the next
                    step.
                </p>
            </div>

            <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm">
                <span className="font-medium text-foreground">
                    {recipients.length} recipient{recipients.length === 1 ? '' : 's'}
                </span>
                <span className="text-muted-foreground"> will receive this email.</span>
                {skippedCount > 0 && (
                    <span className="text-muted-foreground">
                        {' '}
                        ({skippedCount} skipped — no email address)
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
                    Map each placeholder to a student field, or set a fixed value. Standard names
                    you leave unmapped (e.g. <code className="font-mono">{'{{name}}'}</code>) still
                    resolve automatically.
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
                                            {STUDENT_FIELDS.map((opt) => (
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
        if (sendResult) {
            // totalStudents = all recipients; failedStudents already includes both
            // hard failures and pre-send skips, so "sent" is simply total - failed.
            const sent = Math.max(0, sendResult.totalStudents - sendResult.failedStudents);
            const isSuccess = sendResult.success && sendResult.failedStudents === 0;
            return (
                <div className="flex flex-col items-center gap-4 py-8">
                    {isSuccess ? (
                        <CheckCircle className="size-12 text-success-500" />
                    ) : (
                        <XCircle className="size-12 text-danger-500" />
                    )}
                    <h3 className="text-lg font-semibold">
                        {isSuccess ? 'Email Sent' : 'Send Completed'}
                    </h3>
                    <div className="w-full max-w-sm space-y-2 rounded-md border p-4 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Recipients</span>
                            <span className="font-medium">{sendResult.totalStudents}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Sent</span>
                            <span className="font-medium text-success-600">{sent}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Failed</span>
                            <span className="font-medium text-danger-600">
                                {sendResult.failedStudents}
                            </span>
                        </div>
                    </div>
                    {sendResult.errors && sendResult.errors.length > 0 && (
                        <div className="max-h-32 w-full max-w-sm space-y-1 overflow-auto rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                            {sendResult.errors.slice(0, 10).map((e, idx) => (
                                <div key={`${e.studentId}-${idx}`}>
                                    <span className="font-medium text-foreground">
                                        {e.studentName || e.studentId}
                                    </span>
                                    : {e.error}
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
                        <Envelope className="size-5 text-primary" />
                        <div>
                            <p className="text-sm font-semibold">Email</p>
                            <p className="text-xs text-muted-foreground">Channel</p>
                        </div>
                    </div>
                    <div className="border-t pt-3">
                        <p className="text-xs text-muted-foreground">Subject</p>
                        <p className="text-sm font-medium">{subject || '-'}</p>
                    </div>
                    <div className="border-t pt-3">
                        <p className="text-xs text-muted-foreground">Recipients</p>
                        <p className="text-sm font-medium">
                            {recipients.length} selected student
                            {recipients.length === 1 ? '' : 's'}
                            {skippedCount > 0 && (
                                <span className="text-muted-foreground">
                                    {' '}
                                    ({skippedCount} skipped — no email)
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
                                    .map((varKey) => (
                                        <div
                                            key={varKey}
                                            className="flex items-center gap-2 text-xs"
                                        >
                                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
                                                {`{{${varKey}}}`}
                                            </span>
                                            <CaretRight className="size-3 text-muted-foreground" />
                                            <span>{fieldLabel(variableMapping[varKey] ?? '')}</span>
                                        </div>
                                    ))}
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
        <Dialog open={isSendEmailOpen} onOpenChange={handleClose}>
            <DialogContent className="max-h-screen w-full overflow-y-auto overflow-x-hidden sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Send Email</DialogTitle>
                    <DialogDescription>
                        Compose and send an email to the selected students.
                    </DialogDescription>
                </DialogHeader>

                {renderStepIndicator()}

                {step === 1 && renderCompose()}
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
