import React, { useState } from 'react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { PaperPlaneTilt, Spinner } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useEnrollRequestsDialogStore } from '../bulk-actions-store';

// Define message templates
const MESSAGE_TEMPLATES = [
    {
        id: 'template1',
        name: 'Welcome Message',
        content: 'Hello {{name}}! Welcome to our learning platform.',
    },
    {
        id: 'template2',
        name: 'Session Reminder',
        content: 'Hi {{name}}, this is a reminder about your upcoming session.',
    },
    {
        id: 'template3',
        name: 'Assignment Due',
        content: 'Hey {{name}}, your assignment is due soon. Please complete it on time.',
    },
    { id: 'template4', name: 'Custom Message', content: 'Hi {{name}}, {{custom_message_text}}' },
];

type MessageSendingStatus = 'pending' | 'sending' | 'sent' | 'failed';

export const SendMessageDialogIndividual = () => {
    const { isSendMessageOpen, selectedStudent, closeAllDialogs } = useEnrollRequestsDialogStore();
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
        MESSAGE_TEMPLATES[0]?.id || ''
    );
    const [messageStatus, setMessageStatus] = useState<MessageSendingStatus>('pending');
    const [isSending, setIsSending] = useState(false);

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
                        console.log(
                            `Mock API: Message sent to ${userName} (${userId}): ${message}`
                        );
                        resolve();
                    } else {
                        console.error(`Mock API: Failed to send to ${userName} (${userId})`);
                        reject(new Error('Simulated API Error'));
                    }
                },
                1000 + Math.random() * 1500
            ); // Simulate network delay
        });
    };

    const handleSendMessage = async () => {
        if (!selectedTemplateId || !selectedStudent) {
            toast.error('No template selected or student not available.');
            return;
        }

        const template = MESSAGE_TEMPLATES.find((t) => t.id === selectedTemplateId);
        if (!template) {
            toast.error('Selected template not found.');
            return;
        }

        setIsSending(true);
        setMessageStatus('sending');
        toast.info('Sending message...', { id: 'send-message-progress' });

        try {
            // Replace placeholders in the message
            let messageContent = template.content.replace(
                /\{\{name\}\}/g,
                selectedStudent.full_name
            );
            // Add other placeholder replacements as needed
            messageContent = messageContent.replace(
                /\{\{mobile_number\}\}/g,
                selectedStudent.mobile_number || ''
            );
            messageContent = messageContent.replace(
                /\{\{custom_message_text\}\}/g,
                'Please check your dashboard for updates.'
            );

            await mockSendMessageAPI(
                selectedStudent.user_id,
                selectedStudent.full_name,
                messageContent
            );

            setMessageStatus('sent');
            toast.success('Message sent successfully!', {
                id: 'send-message-progress',
                duration: 5000,
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            setMessageStatus('failed');
            toast.error(`Failed to send message: ${errorMessage}`, {
                id: 'send-message-progress',
                duration: 5000,
            });
        } finally {
            setIsSending(false);
        }
    };

    const handleClose = () => {
        if (isSending) return;
        setMessageStatus('pending');
        setSelectedTemplateId(MESSAGE_TEMPLATES[0]?.id || '');
        closeAllDialogs();
    };

    if (!selectedStudent) {
        return null;
    }

    return (
        <MyDialog
            heading="Send WhatsApp Message"
            open={isSendMessageOpen}
            onOpenChange={handleClose}
            dialogWidth="w-[90vw] max-w-md"
            footer={
                <div className="flex items-center justify-end gap-2">
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={handleClose}
                        disable={isSending}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        onClick={handleSendMessage}
                        disable={!selectedTemplateId || isSending}
                        className="min-w-[120px] bg-green-600 text-white hover:bg-green-700"
                    >
                        {isSending ? (
                            <>
                                <Spinner className="mr-2 size-4 animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <PaperPlaneTilt className="mr-2 size-4" />
                                Send Message
                            </>
                        )}
                    </MyButton>
                </div>
            }
        >
            <div className="space-y-4">
                <div className="mb-4 text-sm text-neutral-600">
                    Send a message to{' '}
                    <span className="font-medium">{selectedStudent.full_name}</span>
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium text-neutral-700">
                        Message Template
                    </label>
                    <Select
                        value={selectedTemplateId}
                        onValueChange={(value: string) => setSelectedTemplateId(value)}
                        disabled={isSending}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                        <SelectContent>
                            {MESSAGE_TEMPLATES.map((template) => (
                                <SelectItem key={template.id} value={template.id}>
                                    {template.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {selectedTemplateId && (
                    <div className="rounded-lg bg-neutral-50 p-3">
                        <div className="mb-1 text-sm font-medium text-neutral-700">Preview:</div>
                        <div className="text-sm text-neutral-600">
                            {MESSAGE_TEMPLATES.find((t) => t.id === selectedTemplateId)?.content ||
                                ''}
                        </div>
                    </div>
                )}

                {isSending && (
                    <div className="rounded-lg bg-neutral-100 p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-neutral-700">
                                Sending message to {selectedStudent.full_name}...
                            </span>
                            <Spinner className="size-4 animate-spin text-blue-500" />
                        </div>
                    </div>
                )}

                {messageStatus === 'sent' && (
                    <div className="rounded-lg bg-green-50 p-3">
                        <div className="flex items-center">
                            <span className="text-sm font-medium text-green-700">
                                ✓ Message sent successfully to {selectedStudent.full_name}
                            </span>
                        </div>
                    </div>
                )}

                {messageStatus === 'failed' && (
                    <div className="rounded-lg bg-red-50 p-3">
                        <div className="flex items-center">
                            <span className="text-sm font-medium text-red-700">
                                ✗ Failed to send message to {selectedStudent.full_name}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </MyDialog>
    );
};
