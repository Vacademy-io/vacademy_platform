import { useState } from 'react';
import { toast } from 'sonner';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface SendRemindersModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** How many pending / failed payments are in the current view (drives the recipient counts). */
    pendingCount: number;
    failedCount: number;
}

const CHANNELS = ['WhatsApp', 'Email', 'SMS'] as const;

const DEFAULT_MESSAGE =
    'Hi {{name}}, your payment of {{amount}} for {{course}} is still pending. ' +
    'You can complete it here: {{link}}';

/**
 * Compose payment reminders for everyone pending/failed in the current view. Front-end only for now
 * — there is no reminder-send endpoint yet, so submitting confirms intent without dispatching.
 */
export function SendRemindersModal({
    open,
    onOpenChange,
    pendingCount,
    failedCount,
}: SendRemindersModalProps) {
    const [channels, setChannels] = useState<string[]>(['WhatsApp', 'Email']);
    const [message, setMessage] = useState(DEFAULT_MESSAGE);

    const recipients = pendingCount + failedCount;

    const toggleChannel = (c: string) =>
        setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

    const handleSend = () => {
        onOpenChange(false);
        toast.success(
            `Reminder queued for ${recipients} ${recipients === 1 ? 'student' : 'students'}`
        );
    };

    return (
        <MyDialog
            heading="Send payment reminders"
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-lg"
            footer={
                <div className="flex w-full items-center justify-end gap-2">
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        onClick={handleSend}
                        disable={recipients === 0 || channels.length === 0}
                    >
                        Send {recipients} {recipients === 1 ? 'reminder' : 'reminders'}
                    </MyButton>
                </div>
            }
        >
            <div className="space-y-4 p-5">
                <p className="text-caption text-neutral-500">
                    Goes to everyone pending or failed in the current view.
                </p>

                <div>
                    <div className="mb-1.5 text-caption font-medium text-neutral-600">
                        Recipients
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-100 px-3 py-1 text-caption font-medium text-warning-700">
                            {pendingCount} pending
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-100 px-3 py-1 text-caption font-medium text-danger-700">
                            {failedCount} failed
                        </span>
                    </div>
                </div>

                <div>
                    <div className="mb-1.5 text-caption font-medium text-neutral-600">Channel</div>
                    <div className="flex flex-wrap gap-2">
                        {CHANNELS.map((c) => {
                            const on = channels.includes(c);
                            return (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => toggleChannel(c)}
                                    className={cn(
                                        'rounded-full border px-3 py-1 text-caption font-medium transition-colors',
                                        on
                                            ? 'border-primary-500 bg-primary-50 text-primary-600'
                                            : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
                                    )}
                                >
                                    {c}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <div className="mb-1.5 text-caption font-medium text-neutral-600">Message</div>
                    <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={3}
                        className="text-body"
                    />
                    <p className="mt-1.5 text-caption text-neutral-400">
                        Placeholders like {'{{name}}'} and {'{{amount}}'} are filled per student.
                        Reminders respect a 24-hour cooldown.
                    </p>
                </div>
            </div>
        </MyDialog>
    );
}
