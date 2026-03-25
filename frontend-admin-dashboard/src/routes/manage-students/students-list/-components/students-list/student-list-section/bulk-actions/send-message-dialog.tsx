import React, { useState, useEffect } from 'react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { useDialogStore } from '../../../../-hooks/useDialogStore';
import { PaperPlaneTilt, Spinner, CircleNotch, Eye } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { templateCacheService } from '@/services/template-cache-service';
import { MessageTemplate } from '@/types/message-template-types';

// Message templates will be loaded dynamically from API

type MessageSendingStatus = 'pending' | 'sending' | 'sent' | 'failed';

interface StudentMessageStatus {
    userId: string;
    name: string;
    status: MessageSendingStatus;
    error?: string;
}

export const SendMessageDialog = () => {
    const { isSendMessageOpen, bulkActionInfo, closeAllDialogs } = useDialogStore();
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [studentMessageStatuses, setStudentMessageStatuses] = useState<StudentMessageStatus[]>(
        []
    );
    const [isBulkSending, setIsBulkSending] = useState(false);
    const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([]);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const loadMessageTemplates = async () => {
        setIsLoadingTemplates(true);
        try {
            const templates = await templateCacheService.getTemplates('WHATSAPP');
            setMessageTemplates(templates);
        } catch (error) {
            // Error is already handled by toast.error
            toast.error('Failed to load message templates');
        } finally {
            setIsLoadingTemplates(false);
        }
    };

    // Mock API function - replace with your actual API
    const mockSendMessageAPI = (
        userId: string,
        userName: string,
        message: string
    ): Promise<void> => {
        return new Promise((resolve, reject) => {
            setTimeout(
                () => {
                    // Simulate success/failure randomly
                    if (Math.random() > 0.2) {
                        // 80% success rate
                        // Mock API: Message sent successfully
                        resolve();
                    } else {
                        // Mock API: Failed to send message
                        reject(new Error('Simulated API Error'));
                    }
                },
                1000 + Math.random() * 1500
            ); // Simulate network delay
        });
    };

    const processSendMessageQueue = async () => {
        if (!selectedTemplateId || !bulkActionInfo) {
            toast.error('No template selected or students available.');
            setIsBulkSending(false);
            return;
        }

        const template = messageTemplates.find((t) => t.id === selectedTemplateId);
        if (!template) {
            toast.error('Selected template not found.');
            setIsBulkSending(false);
            return;
        }

        setIsBulkSending(true);
        toast.info('Starting to send messages...', { id: 'bulk-send-progress' });

        // Track null values for reporting
        const nullValueReport = {
            missingNames: 0,
            missingMobileNumbers: 0,
            totalStudents: bulkActionInfo.selectedStudents.length,
        };

        // Initialize status for all students
        const initialStatuses = bulkActionInfo.selectedStudents.map((student) => ({
            userId: student.user_id,
            name: student.full_name,
            status: 'pending' as MessageSendingStatus,
        }));
        setStudentMessageStatuses(initialStatuses);

        for (const student of bulkActionInfo.selectedStudents) {
            setStudentMessageStatuses((prev) =>
                prev.map((s) => (s.userId === student.user_id ? { ...s, status: 'sending' } : s))
            );

            try {
                // Replace placeholders in the message with available data only
                const currentDate = new Date().toLocaleDateString();

                // Track and log null values for debugging
                if (!student.full_name) {
                    nullValueReport.missingNames++;
                }
                if (!student.mobile_number) {
                    nullValueReport.missingMobileNumbers++;
                }

                let messageContent = template.content.replace(
                    /\{\{name\}\}/g,
                    student.full_name || 'Student'
                );
                messageContent = messageContent.replace(
                    /\{\{mobile_number\}\}/g,
                    student.mobile_number || ''
                );
                messageContent = messageContent.replace(
                    /\{\{custom_message_text\}\}/g,
                    'Please check your dashboard for updates.'
                );
                messageContent = messageContent.replace(/\{\{current_date\}\}/g, currentDate);

                await mockSendMessageAPI(student.user_id, student.full_name, messageContent);

                setStudentMessageStatuses((prev) =>
                    prev.map((s) => (s.userId === student.user_id ? { ...s, status: 'sent' } : s))
                );
            } catch (error: unknown) {
                setStudentMessageStatuses((prev) =>
                    prev.map((s) =>
                        s.userId === student.user_id
                            ? {
                                  ...s,
                                  status: 'failed',
                                  error: error instanceof Error ? error.message : 'Unknown error',
                              }
                            : s
                    )
                );
            }
        }

        // Log null value summary

        setIsBulkSending(false);
        const sentCount = studentMessageStatuses.filter((s) => s.status === 'sent').length;
        const failedCount = studentMessageStatuses.filter((s) => s.status === 'failed').length;
        toast.success(`Finished: ${sentCount} sent, ${failedCount} failed.`, {
            id: 'bulk-send-progress',
            duration: 5000,
        });
    };

    // Function to generate preview with sample data
    const generatePreview = () => {
        if (!selectedTemplateId || !bulkActionInfo?.selectedStudents.length) {
            return '';
        }

        const template = messageTemplates.find((t) => t.id === selectedTemplateId);
        if (!template) return '';

        const sampleStudent = bulkActionInfo.selectedStudents[0];
        const currentDate = new Date().toLocaleDateString();

        const replacements = {
            '{{name}}': sampleStudent?.full_name || 'John Doe',
            '{{mobile_number}}': sampleStudent?.mobile_number || '+1234567890',
            '{{custom_message_text}}': 'Please check your dashboard for updates.',
            '{{current_date}}': currentDate,
        };

        let previewContent = template.content;

        // Replace all placeholders
        Object.entries(replacements).forEach(([placeholder, value]) => {
            previewContent = previewContent.replace(
                new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'),
                value
            );
        });

        return previewContent;
    };

    const handleClose = () => {
        if (isBulkSending) return;
        setStudentMessageStatuses([]);
        setSelectedTemplateId('');
        setShowPreview(false);
        closeAllDialogs();
    };

    // Load templates when dialog opens
    useEffect(() => {
        if (isSendMessageOpen) {
            loadMessageTemplates();
        }
    }, [isSendMessageOpen]);

    const selectedStudentsCount = bulkActionInfo?.selectedStudents.length || 0;

    return (
        <MyDialog
            heading="Send WhatsApp Message"
            open={isSendMessageOpen}
            onOpenChange={handleClose}
            dialogWidth="w-[95vw] max-w-4xl"
            footer={
                <div className="flex items-center justify-end gap-2">
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={handleClose}
                        disable={isBulkSending}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        onClick={processSendMessageQueue}
                        disable={
                            !selectedTemplateId || selectedStudentsCount === 0 || isBulkSending
                        }
                        className="min-w-[100px] bg-green-600 text-white hover:bg-green-700"
                    >
                        {isBulkSending ? (
                            <>
                                <Spinner className="mr-2 size-4 animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <PaperPlaneTilt className="mr-2 size-4" />
                                Send to {selectedStudentsCount}
                            </>
                        )}
                    </MyButton>
                </div>
            }
        >
            <div className="space-y-6">
                {/* Header Info */}
                <div className="rounded-lg bg-green-50 p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-full bg-green-100">
                            <span className="text-lg">📱</span>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-green-800">
                                WhatsApp Message Templates
                            </h3>
                            <p className="text-sm text-green-700">
                                Select a template to send to {selectedStudentsCount} student(s)
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Left Column - Template Selection */}
                    <div className="space-y-4">
                        <div>
                            <h4 className="mb-3 text-sm font-semibold text-neutral-800">
                                Choose Template
                            </h4>

                            {isLoadingTemplates ? (
                                <div className="flex h-32 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50">
                                    <div className="flex items-center gap-2 text-neutral-600">
                                        <CircleNotch className="size-4 animate-spin" />
                                        <span className="text-sm">Loading templates...</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="scrollbar-hide max-h-80 space-y-2 overflow-y-auto">
                                    {messageTemplates.map((template) => (
                                        <div
                                            key={template.id}
                                            onClick={() => setSelectedTemplateId(template.id)}
                                            className={`cursor-pointer rounded-lg border p-4 transition-all ${
                                                selectedTemplateId === template.id
                                                    ? 'border-secondary bg-secondary text-secondary-foreground'
                                                    : 'border-neutral-200 bg-white hover:border-secondary hover:bg-secondary/5'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="flex size-8 items-center justify-center rounded-full bg-green-100 text-green-600">
                                                    <span className="text-sm">📄</span>
                                                </div>
                                                <div className="flex-1">
                                                    <h5 className="text-sm font-medium">
                                                        {template.name}
                                                    </h5>
                                                    <p className="mt-1 line-clamp-2 text-xs text-neutral-600">
                                                        {template.content.substring(0, 100)}...
                                                    </p>
                                                </div>
                                                {selectedTemplateId === template.id && (
                                                    <div className="text-secondary-foreground">
                                                        <span className="text-sm">✓</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {messageTemplates.length === 0 && (
                                        <div className="flex h-32 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50">
                                            <div className="text-center">
                                                <div className="text-sm text-neutral-600">
                                                    No templates available
                                                </div>
                                                <div className="mt-1 text-xs text-neutral-500">
                                                    Contact admin to add WhatsApp templates
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column - Preview */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-neutral-800">
                                Message Preview
                            </h4>
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                onClick={() => setShowPreview(!showPreview)}
                                disabled={!selectedTemplateId}
                                className="text-xs"
                            >
                                <Eye className="mr-1 size-3" />
                                {showPreview ? 'Hide' : 'Show'} Preview
                            </MyButton>
                        </div>

                        {selectedTemplateId ? (
                            <div className="space-y-3">
                                {/* Template Info */}
                                <div className="rounded-lg border border-neutral-200 bg-white p-4">
                                    <div className="mb-2 flex items-center gap-2">
                                        <span className="text-sm font-medium text-neutral-800">
                                            {
                                                messageTemplates.find(
                                                    (t) => t.id === selectedTemplateId
                                                )?.name
                                            }
                                        </span>
                                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
                                            WhatsApp
                                        </span>
                                    </div>

                                    {showPreview ? (
                                        <div className="rounded-lg bg-green-50 p-3">
                                            <div className="whitespace-pre-wrap text-sm text-neutral-800">
                                                {generatePreview()}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="rounded-lg bg-neutral-50 p-3">
                                            <div className="text-sm text-neutral-600">
                                                {messageTemplates.find(
                                                    (t) => t.id === selectedTemplateId
                                                )?.content || ''}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Recipients Info */}
                                <div className="rounded-lg border border-neutral-200 bg-white p-4">
                                    <h5 className="mb-2 text-sm font-medium text-neutral-800">
                                        Recipients ({selectedStudentsCount})
                                    </h5>
                                    <div className="space-y-1">
                                        {bulkActionInfo?.selectedStudents
                                            .slice(0, 3)
                                            .map((student, index) => (
                                                <div
                                                    key={student.user_id}
                                                    className="flex items-center gap-2 text-xs"
                                                >
                                                    <div className="flex size-6 items-center justify-center rounded-full bg-green-100 text-green-600">
                                                        {index + 1}
                                                    </div>
                                                    <span className="text-neutral-700">
                                                        {student.full_name}
                                                    </span>
                                                </div>
                                            ))}
                                        {selectedStudentsCount > 3 && (
                                            <div className="text-xs text-neutral-500">
                                                +{selectedStudentsCount - 3} more students
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex h-64 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50">
                                <div className="text-center">
                                    <div className="text-sm text-neutral-600">
                                        Select a template to see preview
                                    </div>
                                    <div className="mt-1 text-xs text-neutral-500">
                                        Choose from the available templates on the left
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Progress Section */}
                {isBulkSending && studentMessageStatuses.length > 0 && (
                    <div className="rounded-lg border border-neutral-200 bg-white p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <h5 className="text-sm font-semibold text-neutral-800">
                                Sending Progress
                            </h5>
                            <span className="text-sm text-neutral-600">
                                {
                                    studentMessageStatuses.filter(
                                        (s) => s.status === 'sent' || s.status === 'failed'
                                    ).length
                                }
                                /{studentMessageStatuses.length}
                            </span>
                        </div>
                        <div className="max-h-48 space-y-2 overflow-y-auto">
                            {studentMessageStatuses.map((s) => (
                                <div
                                    key={s.userId}
                                    className="flex items-center justify-between rounded bg-neutral-50 p-2 text-xs"
                                >
                                    <span className="max-w-[200px] truncate font-medium">
                                        {s.name}
                                    </span>
                                    <div className="shrink-0">
                                        {s.status === 'pending' && (
                                            <span className="text-neutral-500">Pending...</span>
                                        )}
                                        {s.status === 'sending' && (
                                            <div className="flex items-center gap-1">
                                                <Spinner className="size-3 animate-spin text-blue-500" />
                                                <span className="text-blue-600">Sending...</span>
                                            </div>
                                        )}
                                        {s.status === 'sent' && (
                                            <span className="font-medium text-green-600">
                                                ✓ Sent
                                            </span>
                                        )}
                                        {s.status === 'failed' && (
                                            <span
                                                className="font-medium text-red-600"
                                                title={s.error}
                                            >
                                                ✗ Failed
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </MyDialog>
    );
};
