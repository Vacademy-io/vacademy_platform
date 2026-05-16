import { useEffect, useState } from 'react';
import { PaperPlaneTilt, Warning } from '@phosphor-icons/react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    getEmailConfigurations,
    type EmailConfiguration,
} from '@/services/email-configuration-service';
import { sendEmailReply, type EmailMessage } from '../../-services/email-inbox-api';
import { toast } from 'sonner';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    instituteId: string;
    toEmail: string | null;
    /** Default subject (e.g. "Re: <last received subject>"). Empty string = no prefill. */
    defaultSubject?: string;
    onSent: (msg: EmailMessage) => void;
}

export function EmailReplyComposer({
    open,
    onOpenChange,
    instituteId,
    toEmail,
    defaultSubject = '',
    onSent,
}: Props) {
    const [senders, setSenders] = useState<EmailConfiguration[]>([]);
    const [loadingSenders, setLoadingSenders] = useState(false);
    const [from, setFrom] = useState<string>('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);

    // Load senders once per institute. Filter out the platform-default fallback so admins
    // only see addresses they actually configured.
    useEffect(() => {
        if (!instituteId) return;
        let cancelled = false;
        setLoadingSenders(true);
        getEmailConfigurations()
            .then((cfgs) => {
                if (cancelled) return;
                const real = cfgs.filter(
                    (c) =>
                        !(
                            c.displayText?.includes('default') ||
                            c.description?.includes('Default platform sender')
                        )
                );
                setSenders(real);
                const first = real[0];
                if (first && !from) setFrom(first.email);
            })
            .catch((err) => console.error('Failed to load email senders', err))
            .finally(() => {
                if (!cancelled) setLoadingSenders(false);
            });
        return () => {
            cancelled = true;
        };
    }, [instituteId]);

    // Reset draft on each open so opening the dialog for a different conversation doesn't
    // surface a previous draft (or leak a partial reply across recipients).
    useEffect(() => {
        if (open) {
            setSubject(defaultSubject);
            setBody('');
        }
    }, [open, defaultSubject]);

    const disabled = senders.length === 0;

    const handleSend = async () => {
        if (!body.trim()) {
            toast.error('Body cannot be empty');
            return;
        }
        if (!from) {
            toast.error('Pick a sender');
            return;
        }
        if (!toEmail) return;

        setSending(true);
        try {
            const sent = await sendEmailReply({
                instituteId,
                toEmail,
                fromEmail: from,
                subject: subject.trim() || undefined,
                body,
            });
            onSent(sent);
            setSubject('');
            setBody('');
            toast.success('Reply sent');
            onOpenChange(false);
        } catch (err: any) {
            console.error('Send reply failed', err);
            toast.error(
                err?.response?.data?.message ||
                    err?.response?.data?.error ||
                    'Failed to send reply'
            );
        } finally {
            setSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[640px] max-w-[92vw] p-0 gap-0">
                <DialogHeader className="px-5 pt-5 pb-3 border-b">
                    <DialogTitle className="text-base">Reply</DialogTitle>
                    <DialogDescription className="text-xs">
                        Send a reply through one of your institute's configured senders.
                    </DialogDescription>
                </DialogHeader>

                {disabled ? (
                    <div className="p-5">
                        <Alert variant="default" className="border-amber-200 bg-amber-50 text-amber-900">
                            <Warning className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-xs">
                                {loadingSenders
                                    ? 'Loading senders…'
                                    : 'No configured sender for this institute. Add one in Settings → Notification Settings → Email Settings to enable replies.'}
                            </AlertDescription>
                        </Alert>
                    </div>
                ) : (
                    <div className="px-5 py-4 space-y-3">
                        <div className="grid grid-cols-[64px_1fr] gap-x-3 gap-y-3 items-center">
                            <Label className="text-xs text-muted-foreground">From</Label>
                            <Select value={from} onValueChange={setFrom}>
                                <SelectTrigger className="h-9 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {senders.map((s) => (
                                        <SelectItem
                                            key={s.email}
                                            value={s.email}
                                            className="text-sm"
                                        >
                                            {s.name ? `${s.name} <${s.email}>` : s.email}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Label className="text-xs text-muted-foreground">To</Label>
                            <div className="text-sm text-foreground bg-muted/60 rounded px-3 py-2 truncate">
                                {toEmail || ''}
                            </div>

                            <Label className="text-xs text-muted-foreground">Subject</Label>
                            <Input
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="(optional)"
                                className="h-9 text-sm"
                            />
                        </div>

                        <Textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Write a reply…"
                            rows={8}
                            className="text-sm resize-none"
                            autoFocus
                        />
                    </div>
                )}

                <DialogFooter className="px-5 py-3 border-t bg-muted/30">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenChange(false)}
                        disabled={sending}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSend}
                        disabled={sending || disabled || !body.trim()}
                        size="sm"
                        className="gap-1.5"
                    >
                        <PaperPlaneTilt size={12} weight="fill" />
                        {sending ? 'Sending…' : 'Send reply'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
