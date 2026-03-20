import React, { useState, useEffect } from 'react';
import { useDialogStore } from '../../../../-hooks/useDialogStore';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { MessageTemplate } from '@/types/message-template-types';
import { TemplateSelectionDialog } from './template-selection-dialog';
import { TemplateEditorDialog, TemplatePreviewDialog } from '@/components/templates';
import { EmailResultDialog } from '@/components/templates/shared/EmailResultDialog';
import { ValidationFailureDialog } from '@/components/templates/shared/ValidationFailureDialog';
import { bulkEmailService } from '@/services/bulkEmailService';

// Email templates will be loaded dynamically from API

type EmailSendingStatus = 'pending' | 'sending' | 'sent' | 'failed';

interface StudentEmailStatus {
    userId: string;
    name: string;
    email: string;
    status: EmailSendingStatus;
    error?: string;
}

export const SendEmailDialog = () => {
    const { isSendEmailOpen, bulkActionInfo, selectedStudent, isBulkAction, closeAllDialogs } =
        useDialogStore();
    const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
    const [studentEmailStatuses, setStudentEmailStatuses] = useState<StudentEmailStatus[]>([]);
    const [isBulkEmailSending, setIsBulkEmailSending] = useState(false);

    // New dialog states
    const [showTemplateSelection, setShowTemplateSelection] = useState(false);
    const [showTemplateEditor, setShowTemplateEditor] = useState(false);
    const [showTemplatePreview, setShowTemplatePreview] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);

    // Result and validation dialog states
    const [showResultDialog, setShowResultDialog] = useState(false);
    const [showValidationDialog, setShowValidationDialog] = useState(false);
    const [emailResult, setEmailResult] = useState<{
        success: boolean;
        totalStudents: number;
        processedStudents: number;
        failedStudents: number;
        errors?: Array<{ studentId: string; error: string }>;
    } | null>(null);
    const [validationError, setValidationError] = useState<{
        missingVariables: string[];
        availableVariables: Record<string, string>;
    } | null>(null);

    const handleSelectEmailTemplate = (template: MessageTemplate) => {
        setSelectedTemplate(template);
        setShowTemplateSelection(false);
        setShowTemplatePreview(true);
    };

    const handleCreateNewTemplate = () => {
        // This will be handled by TemplateSelectionDialog redirecting to /templates/create
        // The dialog will close automatically
    };

    const handleTemplateSavedAndSent = async (template: MessageTemplate) => {
        // Use the template for sending
        setSelectedTemplate(template);
        setShowTemplateEditor(false);
        setShowTemplatePreview(true);
        // Send the email immediately
        await handleSendBulkEmail();
    };

    const handleSendEmail = async (template: MessageTemplate) => {
        setSelectedTemplate(template);
        setShowTemplatePreview(false);
        await handleSendBulkEmail();
    };

    // Helper functions to break down the complex handleSendBulkEmail function
    const validateEmailTemplate = () => {
        if (!selectedTemplate) {
            toast.error('No template selected.');
            return false;
        }

        const trimmedEmailSubject = selectedTemplate.subject?.trim() || '';
        const trimmedEmailBody = selectedTemplate.content?.trim() || '';
        if (!trimmedEmailSubject || !trimmedEmailBody) {
            toast.error('Template subject and body are required.');
            return false;
        }

        if (studentEmailStatuses.length === 0) {
            toast.error('No valid recipients to send email to.');
            return false;
        }

        return { trimmedEmailSubject, trimmedEmailBody };
    };

    const prepareStudentPayloads = async (
        trimmedEmailSubject: string,
        trimmedEmailBody: string
    ) => {
        const students = isBulkAction
            ? bulkActionInfo?.selectedStudents || []
            : selectedStudent
              ? [selectedStudent]
              : [];

        console.log('Preparing bulk email for', students.length, 'students');

        try {
            // Use the new bulk email service
            const result = await bulkEmailService.sendBulkEmail({
                template: trimmedEmailBody,
                subject: trimmedEmailSubject,
                students,
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

            console.log('Bulk email result:', result);
            return result;
        } catch (error) {
            console.error('Error preparing bulk email:', error);
            toast.error('Failed to prepare email data. Please try again.');
            return null;
        }
    };

    const updateStudentStatus = (userId: string, status: 'sent' | 'failed', error?: string) => {
        setStudentEmailStatuses((prevStatuses) =>
            prevStatuses.map((s) => (s.userId === userId ? { ...s, status, error } : s))
        );
    };

    const handleSendBulkEmail = async () => {
        // Validate template and get trimmed content
        const validation = validateEmailTemplate();
        if (!validation) return;

        const { trimmedEmailSubject, trimmedEmailBody } = validation;

        // Set up sending state
        setIsBulkEmailSending(true);

        setStudentEmailStatuses((prevStatuses) =>
            prevStatuses.map((s) => ({ ...s, status: 'sending' }))
        );

        try {
            // Use the new bulk email service
            const result = await prepareStudentPayloads(trimmedEmailSubject, trimmedEmailBody);

            if (!result || !result.success) {
                console.log('❌ Email sending failed, checking for validation error...');
                console.log('Result:', result);
                console.log('Success:', result?.success);
                console.log('Errors:', result?.errors);
                console.log('Errors length:', result?.errors?.length);

                // Check if this is a validation error
                const validationError = result?.errors?.find(
                    (error: any) => error.studentId === 'validation'
                );
                console.log('Validation error found:', validationError);
                if (validationError) {
                    console.log(
                        '🚫 Validation error detected, showing validation dialogue:',
                        validationError
                    );
                    setValidationError({
                        missingVariables: [],
                        availableVariables: {}
                    });
                    setShowValidationDialog(true);
                } else {
                    console.log('❌ No validation error found, showing generic error');
                    toast.error('Failed to send bulk email. Please try again.');
                }
                setIsBulkEmailSending(false);
                setStudentEmailStatuses((prevStatuses) =>
                    prevStatuses.map((s) => ({ ...s, status: 'pending' }))
                );
                return;
            }

            // Update student statuses based on result
            const students = isBulkAction
                ? bulkActionInfo?.selectedStudents || []
                : selectedStudent
                  ? [selectedStudent]
                  : [];

            students.forEach((student) => {
                const hasError = result.errors?.some(
                    (error: any) => error.studentId === student.user_id
                );
                if (hasError) {
                    const error = result.errors?.find(
                        (error: any) => error.studentId === student.user_id
                    );
                    updateStudentStatus(student.user_id, 'failed', error?.error || 'Unknown error');
                } else {
                    updateStudentStatus(student.user_id, 'sent');
                }
            });

            // Show results dialogue
            console.log('🎉 Email sent successfully, showing result dialogue:', result);
            setEmailResult(result);
            setShowResultDialog(true);
        } catch (error) {
            console.error('Error in bulk email process:', error);
            toast.error('An unexpected error occurred. Please try again.');

            // Reset all statuses to pending
            setStudentEmailStatuses((prevStatuses) =>
                prevStatuses.map((s) => ({ ...s, status: 'pending' }))
            );
        } finally {
            setIsBulkEmailSending(false);
        }
    };

    const handleClose = () => {
        if (isBulkEmailSending) return;
        setSelectedTemplate(null);
        setStudentEmailStatuses([]);
        setShowTemplateSelection(false);
        setShowTemplateEditor(false);
        setShowTemplatePreview(false);
        setEditingTemplate(null);
        closeAllDialogs();
    };

    // Initialize email statuses and show template selection when dialog opens
    useEffect(() => {
        if (isSendEmailOpen) {
            const students = isBulkAction
                ? bulkActionInfo?.selectedStudents || []
                : selectedStudent
                  ? [selectedStudent]
                  : [];

            const studentsWithEmail = students.filter((student) => student.email);
            setStudentEmailStatuses(
                studentsWithEmail.map((student) => ({
                    userId: student.user_id,
                    name: student.full_name,
                    email: student.email,
                    status: 'pending' as EmailSendingStatus,
                }))
            );

            // Automatically show template selection dialog
            setShowTemplateSelection(true);
        } else {
            // Reset states when dialog closes
            setShowTemplateSelection(false);
            setShowTemplateEditor(false);
            setShowTemplatePreview(false);
            setEditingTemplate(null);
        }
    }, [isSendEmailOpen, bulkActionInfo, selectedStudent, isBulkAction]);

    return (
        <>
            {/* Template Selection Dialog - Shows directly when isSendEmailOpen is true */}
            <TemplateSelectionDialog
                isOpen={isSendEmailOpen && showTemplateSelection}
                onClose={handleClose}
                onSelectTemplate={handleSelectEmailTemplate}
                onCreateNew={handleCreateNewTemplate}
                studentEmailStatuses={studentEmailStatuses}
                isBulkEmailSending={isBulkEmailSending}
                onSendEmail={handleSendEmail}
            />

            {/* Template Editor Dialog */}
            <TemplateEditorDialog
                isOpen={showTemplateEditor}
                onClose={() => {
                    setShowTemplateEditor(false);
                }}
                onSaveAndSend={handleTemplateSavedAndSent}
                template={editingTemplate}
                isSending={isBulkEmailSending}
                primaryButtonText="Save & Send"
                showPreviewButton={true}
            />

            {/* Template Preview Dialog */}
            <TemplatePreviewDialog
                isOpen={showTemplatePreview}
                onClose={() => {
                    setShowTemplatePreview(false);
                    setShowTemplateSelection(true);
                }}
                template={selectedTemplate}
                onUseTemplate={handleSendEmail}
                isSending={isBulkEmailSending}
            />

            {/* Email Result Dialog */}
            {emailResult && (
                <EmailResultDialog
                    isOpen={showResultDialog}
                    onClose={() => {
                        setShowResultDialog(false);
                        setEmailResult(null);
                    }}
                    result={emailResult}
                />
            )}

            {/* Validation Failure Dialog */}
            {validationError && (
                <ValidationFailureDialog
                    isOpen={showValidationDialog}
                    onClose={() => {
                        setShowValidationDialog(false);
                        setValidationError(null);
                    }}
                    missingVariables={validationError.missingVariables || []}
                    nullOrEmptyVariables={[]}
                    availableVariables={validationError.availableVariables || {}}
                />
            )}
        </>
    );
};
