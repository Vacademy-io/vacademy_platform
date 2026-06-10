import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
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
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { OPEN_DOUBT_CREATE } from '@/constants/urls';
import { GuestQueryTypeOption } from '@/services/public-doubt-config';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface GuestQueryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    instituteId: string;
    queryTypes: GuestQueryTypeOption[];
}

/**
 * Logged-out "Need help?" dialog on the login page. Posts to the open guest-create endpoint with
 * the visitor's name + email; staff replies are emailed to that address. The institute is already
 * known pre-login via domain routing.
 */
export const GuestQueryDialog = ({
    open,
    onOpenChange,
    instituteId,
    queryTypes,
}: GuestQueryDialogProps) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const [text, setText] = useState('');

    useEffect(() => {
        if (open && !selectedType && queryTypes.length > 0) {
            setSelectedType(queryTypes[0]!.key);
        }
    }, [open, queryTypes, selectedType]);

    const reset = () => {
        setName('');
        setEmail('');
        setText('');
        setSelectedType('');
    };

    const submitGuestQuery = useMutation({
        mutationFn: async () =>
            authenticatedAxiosInstance.post(OPEN_DOUBT_CREATE, {
                institute_id: instituteId,
                guest_name: name.trim(),
                guest_email: email.trim(),
                type: selectedType,
                html_text: text,
            }),
        onSuccess: () => {
            toast.success(`Thanks! We'll reply to ${email.trim()}`);
            reset();
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            // Surface the backend's specific reason (e.g. "Query text is too long") when present.
            const data = (err as { response?: { data?: { ex?: string; message?: string } } })
                ?.response?.data;
            toast.error(
                data?.ex || data?.message || 'Could not submit your query. Please try again.'
            );
        },
    });

    const TEXT_MAX = 5000;

    const handleSubmit = () => {
        if (!name.trim()) {
            toast.error('Please enter your name');
            return;
        }
        if (!EMAIL_PATTERN.test(email.trim())) {
            toast.error('Please enter a valid email');
            return;
        }
        if (!selectedType) {
            toast.error('Please choose a query type');
            return;
        }
        if (!text.trim()) {
            toast.error('Please describe your query');
            return;
        }
        submitGuestQuery.mutate();
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) reset();
                onOpenChange(next);
            }}
        >
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Need help?</DialogTitle>
                    <DialogDescription>
                        Can’t log in, or have a question? Tell us and we’ll reply to your email.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-2">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-caption font-medium text-neutral-600">
                            Your name
                        </label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Full name"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-caption font-medium text-neutral-600">Email</label>
                        <Input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-caption font-medium text-neutral-600">
                            Query type
                        </label>
                        <Select value={selectedType} onValueChange={setSelectedType}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a type" />
                            </SelectTrigger>
                            <SelectContent>
                                {queryTypes.map((t) => (
                                    <SelectItem key={t.key} value={t.key}>
                                        {t.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-caption font-medium text-neutral-600">Details</label>
                        <Textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Describe your problem or question…"
                            rows={4}
                            maxLength={TEXT_MAX}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => {
                            reset();
                            onOpenChange(false);
                        }}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        onClick={handleSubmit}
                        disable={submitGuestQuery.isPending}
                    >
                        {submitGuestQuery.isPending ? 'Submitting…' : 'Submit'}
                    </MyButton>
                </div>
            </DialogContent>
        </Dialog>
    );
};
