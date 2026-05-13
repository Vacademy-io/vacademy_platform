import { useState, useEffect } from 'react';
import * as Sentry from '@sentry/react';
import { useLocation } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { getCachedInstituteBranding } from '@/services/domain-routing';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { MyButton } from '../design-system/button';

interface ErrorFeedbackDialogProps {
    error?: Error | unknown;
    eventId?: string;
    trigger?: React.ReactNode;
}

function getInstituteName(): string {
    const branding = getCachedInstituteBranding();
    if (branding?.instituteName) return branding.instituteName;

    const storeDetails = useInstituteDetailsStore.getState().instituteDetails;
    if (storeDetails?.institute_name) return storeDetails.institute_name;

    const host = window.location.hostname.replace(/^(admin\.|app\.|www\.)/, '');
    const domain = host.split('.')[0];
    if (!domain) return 'Vacademy';
    return domain.charAt(0).toUpperCase() + domain.slice(1);
}

interface ReportPayload {
    type: 'user_feedback';
    description: string;
    userName: string;
    userEmail: string;
    instituteName: string;
    timezone: string;
    route: string;
    errorMessage: string;
    attachments: { name: string; size: number; type: string }[];
}

// POSTs to the Cloudflare Pages Function at /send-alert. The function reads
// SLACK_WEBHOOK_URL from `context.env` (server-side only) and forwards to
// Slack — so the webhook URL never touches the client bundle.
async function postReport(payload: ReportPayload): Promise<void> {
    const res = await fetch('/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`send-alert returned ${res.status}`);
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

    useEffect(() => {
        if (!isOpen) return;
        const tokenData = getTokenDecodedData(getTokenFromCookie(TokenKey.accessToken));
        if (tokenData?.username && !name) setName(tokenData.username);
        if (tokenData?.email && !email) setEmail(tokenData.email);
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const tokenData = getTokenDecodedData(getTokenFromCookie(TokenKey.accessToken));
            const username = (tokenData?.username ?? name) || 'Anonymous';
            const userEmail = (tokenData?.email ?? email) || 'unknown@example.com';

            const attachments = files
                ? Array.from(files).map((f) => ({ name: f.name, size: f.size, type: f.type }))
                : [];

            await postReport({
                type: 'user_feedback',
                description,
                userName: username,
                userEmail,
                instituteName: getInstituteName(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                route: location.pathname,
                errorMessage: error ? String(error).slice(0, 500) : '',
                attachments,
            });

            if (import.meta.env.VITE_ENABLE_SENTRY === 'true') {
                let eventId = initialEventId;

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

                if (files && files.length > 0) {
                    Sentry.withScope((scope) => {
                        Array.from(files).forEach((file) => {
                            scope.addAttachment({
                                filename: file.name,
                                data: file as unknown as Uint8Array,
                                contentType: file.type,
                            });
                        });
                        Sentry.captureMessage('User Feedback Attachment', {
                            level: 'info',
                            tags: { feedbackParams: 'true' },
                        });
                    });
                }

                await Sentry.captureFeedback({
                    associatedEventId: eventId,
                    name: name || 'Anonymous',
                    email: email || 'anonymous@example.com',
                    message: description,
                });
            }

            toast.success('Thank you! Your report has been sent.');
            setIsOpen(false);
            setDescription('');
            setFiles(null);
        } catch (err) {
            console.error('Failed to submit feedback', err);
            toast.error('Failed to submit report. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                {trigger || <MyButton buttonType="secondary">Report an Issue</MyButton>}
            </SheetTrigger>
            <SheetContent className="sm:max-w-md w-[90vw] overflow-y-auto bg-white border-l border-gray-200 p-6">
                <SheetHeader className="mb-6">
                    <SheetTitle className="text-xl font-bold text-gray-900">Report an Issue</SheetTitle>
                    <SheetDescription className="text-gray-500">
                        Help us improve by providing details. Context is automatically included.
                    </SheetDescription>
                </SheetHeader>

                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    <div className="grid gap-2">
                        <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                            Name (Optional)
                        </Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                            className="bg-white border-gray-300 focus-visible:ring-1 focus-visible:ring-primary-500"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                            Email (Optional)
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Your email for follow-up"
                            className="bg-white border-gray-300 focus-visible:ring-1 focus-visible:ring-primary-500"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                            What went wrong? <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                            id="description"
                            required
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Please describe what you were doing when the error occurred..."
                            className="min-h-[120px] resize-y bg-white border-gray-300 focus-visible:ring-1 focus-visible:ring-primary-500"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label className="text-sm font-medium text-gray-700">
                            Attachments
                        </Label>
                        <Input
                            type="file"
                            accept="image/*,video/*"
                            multiple
                            onChange={(e) => setFiles(e.target.files)}
                            className="cursor-pointer file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 focus-visible:ring-1 focus-visible:ring-primary-500"
                        />
                        {files && files.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                                {files.length} file(s) selected — file names will be included in the report.
                            </p>
                        )}
                    </div>

                    <div className="flex gap-3 pt-4 mt-2 border-t border-gray-100">
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            onClick={() => setIsOpen(false)}
                            className="w-full"
                        >
                            Cancel
                        </MyButton>
                        <MyButton
                            type="submit"
                            buttonType="primary"
                            disabled={isSubmitting}
                            className="w-full"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="mr-2 h-4 w-4" />
                                    Send Report
                                </>
                            )}
                        </MyButton>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}
