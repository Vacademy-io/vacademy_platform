/**
 * Page Context Template Example
 *
 * This component demonstrates how to use the page context system for template validation
 * across different pages in the application.
 */

import React, { useState, useEffect } from 'react';
import { useTemplateValidation } from '@/hooks/useTemplateValidation';
import { TemplateValidationWarning } from './TemplateValidationWarning';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PageContext } from '@/services/page-context-resolver';
import { detectCurrentPageContext, getContextDescription, getContextDataRequirements } from '@/utils/page-context-detector';
import { pageContextResolver } from '@/services/page-context-resolver';

export const PageContextTemplateExample: React.FC = () => {
    const [templateContent, setTemplateContent] = useState('Hello {{name}}, your attendance is {{attendance_percentage}}%');
    const [subject, setSubject] = useState('Attendance Report for {{course_name}}');
    const [selectedContext, setSelectedContext] = useState<PageContext>('student-management');
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

    // Auto-detect current page context
    useEffect(() => {
        const currentContext = detectCurrentPageContext();
        setSelectedContext(currentContext);
    }, []);

    const handleValidate = async () => {
        const context = {
            studentId: studentId || undefined,
            courseId: courseId || undefined,
            batchId: batchId || undefined,
            pageContext: selectedContext
        };

        const fullContent = `${templateContent} ${subject}`;
        await validateTemplate(fullContent, context);
    };

    const handleSend = async () => {
        if (!canSend) {
            alert('Cannot send: Template validation failed');
            return;
        }

        console.log('Sending template with validated variables...');
        alert('Template sent successfully!');
    };

    // Get available variables for selected context
    const availableVariables = pageContextResolver.getAvailableVariables(selectedContext);
    const contextDescription = getContextDescription(selectedContext);
    const dataRequirements = getContextDataRequirements(selectedContext);

    // Get context-specific validation
    const contextValidation = pageContextResolver.validateTemplateForContext(
        `${templateContent} ${subject}`,
        selectedContext
    );

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Page Context Template Validation</CardTitle>
                    <CardDescription>
                        This example shows how template validation works differently based on the page context.
                        Each page has access to different data, so variables are validated accordingly.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Page Context Selection */}
                    <div className="space-y-2">
                        <Label htmlFor="context">Page Context</Label>
                        <Select value={selectedContext} onValueChange={(value: PageContext) => setSelectedContext(value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select page context" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="student-management">Student Management</SelectItem>
                                <SelectItem value="attendance-report">Attendance Report</SelectItem>
                                <SelectItem value="announcement">Announcement</SelectItem>
                                <SelectItem value="referral-settings">Referral Settings</SelectItem>
                                <SelectItem value="course-management">Course Management</SelectItem>
                                <SelectItem value="live-session">Live Session</SelectItem>
                                <SelectItem value="assessment">Assessment</SelectItem>
                                <SelectItem value="enrollment-requests">Enrollment Requests</SelectItem>
                                <SelectItem value="general">General</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="text-sm text-gray-600">
                            {contextDescription}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {dataRequirements.map((req, index) => (
                                <Badge key={index} variant="secondary">{req}</Badge>
                            ))}
                        </div>
                    </div>

                    {/* Template Content */}
                    <div className="space-y-2">
                        <Label htmlFor="template">Template Content</Label>
                        <Textarea
                            id="template"
                            value={templateContent}
                            onChange={(e) => setTemplateContent(e.target.value)}
                            placeholder="Enter your template content with variables like {{name}}, {{attendance_percentage}}, etc."
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

                    {/* Context-Specific Validation Results */}
                    {contextValidation && (
                        <Card className="bg-blue-50">
                            <CardHeader>
                                <CardTitle className="text-sm">Context-Specific Validation</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm space-y-2">
                                <div>
                                    <strong>Valid for {selectedContext}:</strong> {contextValidation.valid ? 'Yes' : 'No'}
                                </div>
                                <div>
                                    <strong>Available variables:</strong> {contextValidation.availableVariables.length}
                                </div>
                                <div>
                                    <strong>Unavailable variables:</strong> {contextValidation.unavailableVariables.length}
                                </div>
                                {contextValidation.unavailableVariables.length > 0 && (
                                    <div>
                                        <strong>Unavailable:</strong> {contextValidation.unavailableVariables.join(', ')}
                                    </div>
                                )}
                                {contextValidation.suggestions.length > 0 && (
                                    <div>
                                        <strong>Suggestions:</strong> {contextValidation.suggestions.join(', ')}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

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

                    {/* Available Variables for Context */}
                    <Card className="bg-green-50">
                        <CardHeader>
                            <CardTitle className="text-sm">Available Variables for {selectedContext}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
                                {availableVariables.map((variable) => (
                                    <Badge
                                        key={variable}
                                        variant="outline"
                                        className="text-xs"
                                    >
                                        {`{{${variable}}}`}
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Debug Information */}
                    {validationResult && (
                        <Card className="bg-gray-50">
                            <CardHeader>
                                <CardTitle className="text-sm">Debug Information</CardTitle>
                            </CardHeader>
                            <CardContent className="text-xs space-y-2">
                                <div>
                                    <strong>Page Context:</strong> {selectedContext}
                                </div>
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
