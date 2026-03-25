import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { ValidationResult } from '@/utils/template-validation';
import { BulkEmailService, BulkEmailResult } from '@/services/bulkEmailService';
import { TemplateValidationDialog } from './TemplateValidationDialog';

interface EmailSendingServiceProps {
    children: (props: {
        sendEmail: (options: SendEmailOptions) => Promise<void>;
        isSending: boolean;
        validationResult: ValidationResult | null;
        showValidationDialog: boolean;
        onCloseValidationDialog: () => void;
        onRetryValidation: () => void;
    }) => React.ReactNode;
}

interface SendEmailOptions {
    template: string;
    subject: string;
    students: any[];
    context: 'student-management' | 'announcements' | 'attendance-report' | 'referral-settings';
    pageContext?: any;
    notificationType: 'EMAIL' | 'WHATSAPP';
    source: string;
    sourceId: string;
    templateName?: string;
}

export const EmailSendingService: React.FC<EmailSendingServiceProps> = ({ children }) => {
    const [isSending, setIsSending] = useState(false);
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
    const [showValidationDialog, setShowValidationDialog] = useState(false);
    const [currentSendOptions, setCurrentSendOptions] = useState<SendEmailOptions | null>(null);

    const bulkEmailService = new BulkEmailService();

    const sendEmail = useCallback(async (options: SendEmailOptions) => {
        setIsSending(true);
        setCurrentSendOptions(options);

        try {
            // Step 1: Validate template
            console.log('🔍 Validating template before sending...');
            const validation = await bulkEmailService.validateTemplate({
                template: options.template,
                subject: options.subject,
                students: options.students,
                context: options.context,
                pageContext: options.pageContext,
                notificationType: options.notificationType,
                source: options.source,
                sourceId: options.sourceId,
            });

            setValidationResult(validation);

            // Step 2: Check if we can send
            if (!validation.canSend) {
                console.warn('❌ Template validation failed, showing dialog');
                setShowValidationDialog(true);
                return;
            }

            // Step 3: Send email
            console.log('✅ Template validation passed, sending email...');
            const result = await bulkEmailService.sendBulkEmail({
                template: options.template,
                subject: options.subject,
                students: options.students,
                context: options.context,
                pageContext: options.pageContext,
                notificationType: options.notificationType,
                source: options.source,
                sourceId: options.sourceId,
            });

            // Step 4: Handle result
            if (result.success) {
                const successMessage = `Email sent successfully to ${result.processedStudents} student${result.processedStudents > 1 ? 's' : ''}`;
                console.log('✅', successMessage);
                toast.success(successMessage, {
                    description: `Template: ${options.templateName || 'Email Template'}`,
                    duration: 5000,
                });
            } else {
                const errorMessage = result.errors?.[0]?.error || 'Failed to send email';
                console.error('❌ Email sending failed:', errorMessage);
                toast.error('Failed to send email', {
                    description: errorMessage,
                    duration: 7000,
                });
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            console.error('❌ Email sending error:', error);
            toast.error('Email sending failed', {
                description: errorMessage,
                duration: 7000,
            });
        } finally {
            setIsSending(false);
        }
    }, [bulkEmailService]);

    const onCloseValidationDialog = useCallback(() => {
        setShowValidationDialog(false);
        setValidationResult(null);
    }, []);

    const onRetryValidation = useCallback(async () => {
        if (!currentSendOptions) return;

        setShowValidationDialog(false);
        setValidationResult(null);

        // Retry sending with the same options
        await sendEmail(currentSendOptions);
    }, [currentSendOptions, sendEmail]);

    const onProceedAnyway = useCallback(async () => {
        if (!currentSendOptions || !validationResult) return;

        setShowValidationDialog(false);

        try {
            // Force send even with validation issues
            console.log('⚠️ Proceeding with email send despite validation issues...');
            const result = await bulkEmailService.sendBulkEmail({
                template: currentSendOptions.template,
                subject: currentSendOptions.subject,
                students: currentSendOptions.students,
                context: currentSendOptions.context,
                pageContext: currentSendOptions.pageContext,
                notificationType: currentSendOptions.notificationType,
                source: currentSendOptions.source,
                sourceId: currentSendOptions.sourceId,
            });

            if (result.success) {
                const successMessage = `Email sent successfully to ${result.processedStudents} student${result.processedStudents > 1 ? 's' : ''}`;
                console.log('✅', successMessage);
                toast.success(successMessage, {
                    description: `Template: ${currentSendOptions.templateName || 'Email Template'} (sent with warnings)`,
                    duration: 5000,
                });
            } else {
                const errorMessage = result.errors?.[0]?.error || 'Failed to send email';
                console.error('❌ Email sending failed:', errorMessage);
                toast.error('Failed to send email', {
                    description: errorMessage,
                    duration: 7000,
                });
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            console.error('❌ Email sending error:', error);
            toast.error('Email sending failed', {
                description: errorMessage,
                duration: 7000,
            });
        }
    }, [currentSendOptions, validationResult, bulkEmailService]);

    return (
        <>
            {children({
                sendEmail,
                isSending,
                validationResult,
                showValidationDialog,
                onCloseValidationDialog,
                onRetryValidation,
            })}

            <TemplateValidationDialog
                isOpen={showValidationDialog}
                onClose={onCloseValidationDialog}
                validationResult={validationResult}
                onRetry={onRetryValidation}
                onProceedAnyway={onProceedAnyway}
                templateName={currentSendOptions?.templateName}
            />
        </>
    );
};
