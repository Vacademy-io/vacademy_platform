import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmailSendingService } from './EmailSendingService';
import { EmailSendButton } from './EmailSendButton';
import { Badge } from '@/components/ui/badge';

// Mock student data for demonstration
const mockStudents = [
    {
        id: '1',
        user_id: '1',
        full_name: 'John Doe',
        email: 'john.doe@example.com',
        mobile_number: '+1234567890',
        course_id: 'course-1',
        batch_id: 'batch-1'
    },
    {
        id: '2',
        user_id: '2',
        full_name: 'Jane Smith',
        email: 'jane.smith@example.com',
        mobile_number: '+1234567891',
        course_id: 'course-1',
        batch_id: 'batch-1'
    }
];

export const EmailSendingExample: React.FC = () => {
    const [template, setTemplate] = useState(`Hello {{name}},

Welcome to {{institute_name}}! We're excited to have you as part of our community.

Your course details:
- Course: {{course_name}}
- Batch: {{batch_name}}
- Institute: {{institute_name}}
- Address: {{institute_address}}
- Phone: {{institute_phone}}
- Email: {{institute_email}}
- Website: {{institute_website}}

If you have any questions, please contact us at {{support_email}} or visit {{support_link}}.

Best regards,
{{institute_name}} Team

Custom Message: {{custom_message_text}}`);

    const [subject, setSubject] = useState('Welcome to {{institute_name}}!');
    const [context, setContext] = useState<'student-management' | 'announcements' | 'attendance-report' | 'referral-settings'>('student-management');
    const [notificationType, setNotificationType] = useState<'EMAIL' | 'WHATSAPP'>('EMAIL');

    return (
        <div className="space-y-6 p-6">
            <Card>
                <CardHeader>
                    <CardTitle>Email Sending with Template Validation</CardTitle>
                    <CardDescription>
                        This example demonstrates how to send emails with comprehensive template validation,
                        error handling, and user feedback following best practices.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="subject">Email Subject</Label>
                            <Input
                                id="subject"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Enter email subject"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="context">Context</Label>
                            <Select value={context} onValueChange={(value: any) => setContext(value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select context" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="student-management">Student Management</SelectItem>
                                    <SelectItem value="announcements">Announcements</SelectItem>
                                    <SelectItem value="attendance-report">Attendance Report</SelectItem>
                                    <SelectItem value="referral-settings">Referral Settings</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="template">Email Template</Label>
                        <Textarea
                            id="template"
                            value={template}
                            onChange={(e) => setTemplate(e.target.value)}
                            placeholder="Enter your email template with variables like {{name}}, {{institute_name}}, etc."
                            rows={10}
                            className="font-mono text-sm"
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <Badge variant="outline">
                            Recipients: {mockStudents.length} students
                        </Badge>
                        <Badge variant="outline">
                            Type: {notificationType}
                        </Badge>
                        <Badge variant="outline">
                            Context: {context}
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            <EmailSendingService>
                {({ sendEmail, isSending, validationResult, showValidationDialog, onCloseValidationDialog, onRetryValidation }) => (
                    <Card>
                        <CardHeader>
                            <CardTitle>Send Email</CardTitle>
                            <CardDescription>
                                Click the button below to send the email with template validation.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-4">
                                <EmailSendButton
                                    onClick={() => sendEmail({
                                        template,
                                        subject,
                                        students: mockStudents,
                                        context,
                                        notificationType,
                                        source: 'template-example',
                                        sourceId: 'example-1',
                                        templateName: 'Welcome Email Template'
                                    })}
                                    isSending={isSending}
                                    validationResult={validationResult}
                                />

                                {validationResult && (
                                    <div className="flex items-center gap-2 text-sm">
                                        {validationResult.canSend ? (
                                            <Badge variant="default" className="bg-green-100 text-green-800">
                                                Ready to Send
                                            </Badge>
                                        ) : (
                                            <Badge variant="destructive">
                                                {validationResult.missingVariables.length} Missing Variables
                                            </Badge>
                                        )}
                                    </div>
                                )}
                            </div>

                            {validationResult && !showValidationDialog && (
                                <div className="mt-4 p-3 bg-muted rounded-lg">
                                    <h4 className="text-sm font-medium mb-2">Validation Summary:</h4>
                                    <div className="text-sm space-y-1">
                                        <p>• Available Variables: {Object.keys(validationResult.availableVariables).length}</p>
                                        <p>• Missing Variables: {validationResult.missingVariables.length}</p>
                                        <p>• Warnings: {validationResult.warnings.length}</p>
                                        <p>• Can Send: {validationResult.canSend ? 'Yes' : 'No'}</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </EmailSendingService>
        </div>
    );
};
