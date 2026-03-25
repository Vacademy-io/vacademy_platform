/**
 * Template Validation Integration Examples
 *
 * This file shows how to integrate template validation into existing components
 */

import React, { useState } from 'react';
import { useTemplateValidation } from '@/hooks/useTemplateValidation';
import { TemplateValidationWarning } from './TemplateValidationWarning';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Example 1: Adding validation to an existing email sending component
export const EmailSendingWithValidation: React.FC<{
    template: string;
    subject: string;
    students: any[];
    onSend: () => void;
}> = ({ template, subject, students, onSend }) => {
    const [showValidation, setShowValidation] = useState(false);

    const {
        isValidating,
        validationResult,
        validateTemplate,
        canSend,
        missingVariables,
        warnings
    } = useTemplateValidation();

    const handleValidateAndSend = async () => {
        const context = students.length > 0 ? {
            studentId: students[0].user_id || students[0].id,
            courseId: students[0].course_id,
            batchId: students[0].batch_id,
        } : undefined;

        const fullContent = `${template} ${subject}`;
        const result = await validateTemplate(fullContent, context);

        if (result.canSend) {
            onSend();
        } else {
            setShowValidation(true);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <Button
                    onClick={handleValidateAndSend}
                    disabled={isValidating}
                >
                    {isValidating ? 'Validating...' : 'Send Email'}
                </Button>
                <Button
                    onClick={() => setShowValidation(!showValidation)}
                    variant="outline"
                >
                    {showValidation ? 'Hide' : 'Show'} Validation
                </Button>
            </div>

            {showValidation && validationResult && (
                <TemplateValidationWarning
                    isValid={validationResult.isValid}
                    missingVariables={validationResult.missingVariables}
                    warnings={validationResult.warnings}
                    errorMessage={validationResult.errorMessage}
                    onRetry={() => handleValidateAndSend()}
                    onDismiss={() => setShowValidation(false)}
                />
            )}
        </div>
    );
};

// Example 2: Pre-validation before showing send button
export const PreValidatedEmailButton: React.FC<{
    template: string;
    subject: string;
    students: any[];
    onSend: () => void;
}> = ({ template, subject, students, onSend }) => {
    const [isValidated, setIsValidated] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    const { validateTemplate, isValidating } = useTemplateValidation();

    React.useEffect(() => {
        const validate = async () => {
            const context = students.length > 0 ? {
                studentId: students[0].user_id || students[0].id,
                courseId: students[0].course_id,
                batchId: students[0].batch_id,
            } : undefined;

            const fullContent = `${template} ${subject}`;
            const result = await validateTemplate(fullContent, context);

            setIsValidated(result.canSend);
            if (!result.canSend) {
                setValidationError(
                    result.errorMessage ||
                    `Missing variables: ${result.missingVariables.join(', ')}`
                );
            } else {
                setValidationError(null);
            }
        };

        if (template && subject) {
            validate();
        }
    }, [template, subject, students, validateTemplate]);

    return (
        <div className="space-y-2">
            {isValidating && (
                <div className="text-sm text-gray-600">Validating template...</div>
            )}

            {!isValidating && !isValidated && validationError && (
                <div className="text-sm text-red-600">
                    {validationError}
                </div>
            )}

            <Button
                onClick={onSend}
                disabled={!isValidated || isValidating}
                className={!isValidated ? 'opacity-50 cursor-not-allowed' : ''}
            >
                Send Email {!isValidated && '(Template validation failed)'}
            </Button>
        </div>
    );
};

// Example 3: Integration with existing bulk email service
export const BulkEmailWithValidation: React.FC<{
    template: string;
    subject: string;
    students: any[];
}> = ({ template, subject, students }) => {
    const [isSending, setIsSending] = useState(false);
    const [result, setResult] = useState<any>(null);

    const { validateTemplate, canSend, missingVariables } = useTemplateValidation();

    const handleSend = async () => {
        // The bulkEmailService now includes automatic validation
        // But you can also pre-validate for better UX
        const context = students.length > 0 ? {
            studentId: students[0].user_id || students[0].id,
            courseId: students[0].course_id,
            batchId: students[0].batch_id,
        } : undefined;

        const fullContent = `${template} ${subject}`;
        const validationResult = await validateTemplate(fullContent, context);

        if (!validationResult.canSend) {
            alert(`Cannot send: ${validationResult.missingVariables.join(', ')} missing`);
            return;
        }

        setIsSending(true);
        try {
            // Import the service
            const { bulkEmailService } = await import('@/services/bulkEmailService');

            const emailResult = await bulkEmailService.sendBulkEmail({
                template,
                subject,
                students,
                context: 'student-management',
                notificationType: 'EMAIL',
                source: 'STUDENT_MANAGEMENT_BULK_EMAIL',
                sourceId: crypto.randomUUID(),
                enrichmentOptions: {
                    includeCourse: true,
                    includeBatch: true,
                    includeInstitute: true,
                    includeAttendance: true,
                    includeLiveClass: true,
                    includeReferral: true,
                    includeCustomFields: true
                }
            });

            setResult(emailResult);
        } catch (error) {
            console.error('Email sending failed:', error);
            setResult({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Bulk Email with Validation</CardTitle>
                <CardDescription>
                    This example shows how the validation is automatically integrated
                    into the bulk email service.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="text-sm">
                    <strong>Template:</strong> {template.substring(0, 100)}...
                </div>
                <div className="text-sm">
                    <strong>Students:</strong> {students.length}
                </div>

                {!canSend && missingVariables.length > 0 && (
                    <div className="text-sm text-red-600">
                        <strong>Missing variables:</strong> {missingVariables.join(', ')}
                    </div>
                )}

                <Button
                    onClick={handleSend}
                    disabled={!canSend || isSending}
                >
                    {isSending ? 'Sending...' : 'Send Bulk Email'}
                </Button>

                {result && (
                    <div className="text-sm">
                        <strong>Result:</strong> {result.success ? 'Success' : 'Failed'}
                        {result.error && <div className="text-red-600">{result.error}</div>}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

// Example 4: WhatsApp template validation
export const WhatsAppTemplateWithValidation: React.FC<{
    template: any; // MetaWhatsAppTemplate
    students: any[];
}> = ({ template, students }) => {
    const [isSending, setIsSending] = useState(false);
    const [result, setResult] = useState<any>(null);

    const { validateTemplate, canSend, missingVariables } = useTemplateValidation();

    const handleSend = async () => {
        const context = students.length > 0 ? {
            studentId: students[0].user_id || students[0].id,
            courseId: students[0].course_id,
            batchId: students[0].batch_id,
        } : undefined;

        // Extract text from WhatsApp template components
        const templateContent = template.components
            .map((component: any) => component.text || '')
            .join(' ');

        const validationResult = await validateTemplate(templateContent, context);

        if (!validationResult.canSend) {
            alert(`Cannot send: ${validationResult.missingVariables.join(', ')} missing`);
            return;
        }

        setIsSending(true);
        try {
            // Import the service
            const { whatsappTemplateService } = await import('@/services/whatsapp-template-service');

            // Validate using WhatsApp service
            const whatsappValidation = await whatsappTemplateService.validateTemplate(template, context);

            if (!whatsappValidation.canSend) {
                throw new Error(`WhatsApp template validation failed: ${whatsappValidation.missingVariables.join(', ')}`);
            }

            // Proceed with WhatsApp sending logic here
            setResult({ success: true, message: 'WhatsApp template validated successfully' });
        } catch (error) {
            console.error('WhatsApp validation failed:', error);
            setResult({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>WhatsApp Template with Validation</CardTitle>
                <CardDescription>
                    This example shows how to validate WhatsApp templates.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="text-sm">
                    <strong>Template:</strong> {template.name}
                </div>
                <div className="text-sm">
                    <strong>Students:</strong> {students.length}
                </div>

                {!canSend && missingVariables.length > 0 && (
                    <div className="text-sm text-red-600">
                        <strong>Missing variables:</strong> {missingVariables.join(', ')}
                    </div>
                )}

                <Button
                    onClick={handleSend}
                    disabled={!canSend || isSending}
                >
                    {isSending ? 'Validating...' : 'Validate & Send WhatsApp'}
                </Button>

                {result && (
                    <div className="text-sm">
                        <strong>Result:</strong> {result.success ? 'Success' : 'Failed'}
                        {result.error && <div className="text-red-600">{result.error}</div>}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
