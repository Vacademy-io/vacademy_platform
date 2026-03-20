/**
 * Template Validation Example Component
 *
 * This component demonstrates how to use the template validation system
 * in email and WhatsApp sending flows.
 */

import React, { useState } from 'react';
import { useTemplateValidation } from '@/hooks/useTemplateValidation';
import { TemplateValidationWarning } from './TemplateValidationWarning';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const TemplateValidationExample: React.FC = () => {
    const [templateContent, setTemplateContent] = useState('Hello {{name}}, your course {{course_name}} starts on {{course_start_date}}');
    const [subject, setSubject] = useState('Welcome to {{course_name}}');
    const [studentId, setStudentId] = useState('');
    const [courseId, setCourseId] = useState('');
    const [batchId, setBatchId] = useState('');

    const {
        isValidating,
        validationResult,
        validateTemplate,
        clearValidation,
        canSend,
        missingVariables,
        warnings,
        errorMessage
    } = useTemplateValidation({
        onValidationComplete: (result) => {
            console.log('Validation completed:', result);
        },
        onValidationError: (error) => {
            console.error('Validation error:', error);
        }
    });

    const handleValidate = async () => {
        const context = {
            studentId: studentId || undefined,
            courseId: courseId || undefined,
            batchId: batchId || undefined,
        };

        const fullContent = `${templateContent} ${subject}`;
        await validateTemplate(fullContent, context);
    };

    const handleSend = async () => {
        if (!canSend) {
            alert('Cannot send: Template validation failed');
            return;
        }

        // Here you would call your actual send function
        console.log('Sending template with validated variables...');
        alert('Template sent successfully!');
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Template Validation Example</CardTitle>
                    <CardDescription>
                        This example shows how to validate template variables before sending emails or WhatsApp messages.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Template Content */}
                    <div className="space-y-2">
                        <Label htmlFor="template">Template Content</Label>
                        <Textarea
                            id="template"
                            value={templateContent}
                            onChange={(e) => setTemplateContent(e.target.value)}
                            placeholder="Enter your template content with variables like {{name}}, {{course_name}}, etc."
                            rows={4}
                        />
                    </div>

                    {/* Subject */}
                    <div className="space-y-2">
                        <Label htmlFor="subject">Subject</Label>
                        <Input
                            id="subject"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Enter subject with variables"
                        />
                    </div>

                    {/* Context Fields */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="studentId">Student ID (optional)</Label>
                            <Input
                                id="studentId"
                                value={studentId}
                                onChange={(e) => setStudentId(e.target.value)}
                                placeholder="Student ID"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="courseId">Course ID (optional)</Label>
                            <Input
                                id="courseId"
                                value={courseId}
                                onChange={(e) => setCourseId(e.target.value)}
                                placeholder="Course ID"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="batchId">Batch ID (optional)</Label>
                            <Input
                                id="batchId"
                                value={batchId}
                                onChange={(e) => setBatchId(e.target.value)}
                                placeholder="Batch ID"
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        <Button
                            onClick={handleValidate}
                            disabled={isValidating}
                            variant="outline"
                        >
                            {isValidating ? 'Validating...' : 'Validate Template'}
                        </Button>
                        <Button
                            onClick={handleSend}
                            disabled={!canSend || isValidating}
                        >
                            Send Template
                        </Button>
                        <Button
                            onClick={clearValidation}
                            variant="ghost"
                        >
                            Clear
                        </Button>
                    </div>

                    {/* Validation Results */}
                    {validationResult && (
                        <TemplateValidationWarning
                            isValid={validationResult.isValid}
                            missingVariables={validationResult.missingVariables}
                            warnings={validationResult.warnings}
                            errorMessage={validationResult.errorMessage}
                            onRetry={handleValidate}
                            onDismiss={clearValidation}
                        />
                    )}

                    {/* Debug Information */}
                    {validationResult && (
                        <Card className="bg-gray-50">
                            <CardHeader>
                                <CardTitle className="text-sm">Debug Information</CardTitle>
                            </CardHeader>
                            <CardContent className="text-xs space-y-2">
                                <div>
                                    <strong>Can Send:</strong> {canSend ? 'Yes' : 'No'}
                                </div>
                                <div>
                                    <strong>Missing Variables:</strong> {missingVariables.length}
                                </div>
                                <div>
                                    <strong>Warnings:</strong> {warnings.length}
                                </div>
                                {validationResult.availableVariables && (
                                    <div>
                                        <strong>Available Variables:</strong>
                                        <pre className="mt-1 p-2 bg-white rounded text-xs overflow-auto">
                                            {JSON.stringify(validationResult.availableVariables, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
