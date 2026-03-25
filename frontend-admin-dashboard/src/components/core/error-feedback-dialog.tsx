import { useState } from 'react';
import * as Sentry from '@sentry/react';
import { useLocation } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

interface ErrorFeedbackDialogProps {
    error?: Error | unknown;
    eventId?: string;
    trigger?: React.ReactNode;
}

export function ErrorFeedbackDialog({
    error,
    eventId: initialEventId,
    trigger,
}: ErrorFeedbackDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [description, setDescription] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [files, setFiles] = useState<FileList | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const location = useLocation();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            if (import.meta.env.VITE_ENABLE_SENTRY === 'true') {
                let eventId = initialEventId;

                // If no eventId was provided (e.g. from 404 page), capture a message to generate one
                if (!eventId) {
                    eventId = Sentry.captureMessage('User Feedback Reported', {
                        level: 'info',
                        extra: {
                            route: location.pathname,
                            description,
                            errorDetails: error ? String(error) : 'No error object provided',
                        },
                    });
                }

                // Prepare attachments if files exist
                if (files && files.length > 0) {
                    Sentry.withScope((scope) => {
                        Array.from(files).forEach((file) => {
                            scope.addAttachment({
                                filename: file.name,
                                data: file as unknown as Uint8Array, // Cast to satisfy lint; browser handles File/Blob
                                contentType: file.type,
                            });
                        });
                        // Capture a specific event for the feedback with attachments
                        Sentry.captureMessage('User Feedback Attachment', {
                            level: 'info',
                            tags: { feedbackParams: 'true' },
                        });
                    });
                }

                // Submit User Feedback
                const userFeedback = {
                    event_id: eventId,
                    name: name || 'Anonymous',
                    email: email || 'anonymous@example.com',
                    message: description,
                    comments: description, // Include both to ensure compatibility
                };

                await Sentry.captureFeedback(userFeedback);
                toast.success('Thank you! Your feedback has been sent.');
            } else {
                console.log('Sentry is disabled, feedback not sent:', {
                    name,
                    email,
                    description,
                    files,
                    error,
                });
                toast.success('Thank you! Your feedback has been received (Local Mode).');
            }

            setIsOpen(false);
            setDescription('');
            setFiles(null);
        } catch (err) {
            console.error('Failed to submit feedback', err);
            toast.error('Failed to submit feedback properly, but we have logged the error.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || <Button variant="outline">Report an Issue</Button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Report an Issue</DialogTitle>
                    <DialogDescription>
                        Help us improve by providing details about what happened. Information about
                        the current page and error will be automatically included.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Name (Optional)</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="email">Email (Optional)</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Your email for follow-up"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="description">
                            What went wrong? <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                            id="description"
                            required
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Please describe what you were doing when the error occurred..."
                            className="min-h-[100px]"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label>Attachments (Screenshot/Video)</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                type="file"
                                accept="image/*,video/*"
                                multiple
                                onChange={(e) => setFiles(e.target.files)}
                                className="cursor-pointer"
                            />
                        </div>
                        {files && files.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                                {files.length} file(s) selected
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                'Send Report'
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
