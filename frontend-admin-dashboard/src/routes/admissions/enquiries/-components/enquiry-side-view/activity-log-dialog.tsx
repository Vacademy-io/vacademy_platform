import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    createTimelineEvent,
    timelineQueryKeys,
    type CreateTimelineEventPayload,
} from '../../../-services/timeline-services';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { NotePencil, Phone, EnvelopeSimple, Buildings } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';

interface ActivityLogDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    enquiryId: string;
}

const NOTE_ACTION_TYPES = [
    { value: 'NOTE_ADDED', label: 'Note', icon: <NotePencil weight="fill" className="size-3.5" /> },
    {
        value: 'PHONE_CALL',
        label: 'Phone Call',
        icon: <Phone weight="fill" className="size-3.5" />,
    },
    {
        value: 'EMAIL_SENT',
        label: 'Email Sent',
        icon: <EnvelopeSimple weight="fill" className="size-3.5" />,
    },
    {
        value: 'CAMPUS_VISIT',
        label: 'Campus Visit',
        icon: <Buildings weight="fill" className="size-3.5" />,
    },
];

export const ActivityLogDialog = ({ isOpen, onOpenChange, enquiryId }: ActivityLogDialogProps) => {
    const [noteText, setNoteText] = useState('');
    const [actionType, setActionType] = useState('NOTE_ADDED');
    const queryClient = useQueryClient();

    const createMutation = useMutation({
        mutationFn: createTimelineEvent,
        onSuccess: () => {
            toast.success('Activity logged successfully');
            setNoteText('');
            setActionType('NOTE_ADDED');
            onOpenChange(false);
            queryClient.invalidateQueries({
                queryKey: timelineQueryKeys.events('ENQUIRY', enquiryId),
            });
        },
        onError: () => {
            toast.error('Failed to add activity. Please try again.');
        },
    });

    const handleSubmit = () => {
        if (!noteText.trim()) {
            toast.warning('Please enter a note');
            return;
        }

        const actionLabel = NOTE_ACTION_TYPES.find((t) => t.value === actionType)?.label || 'Note';

        const payload: CreateTimelineEventPayload = {
            type: 'ENQUIRY',
            type_id: enquiryId,
            action_type: actionType,
            title: `${actionLabel}`,
            description: noteText.trim(),
        };

        createMutation.mutate(payload);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader className="my-2">
                    <DialogTitle>Add Activity Log</DialogTitle>
                    <DialogDescription>Log an activity or note for this enquiry</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Action type selector */}
                    <div className="flex flex-wrap items-center gap-2">
                        {NOTE_ACTION_TYPES.map((type) => (
                            <button
                                key={type.value}
                                onClick={() => setActionType(type.value)}
                                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all
                                    ${
                                        actionType === type.value
                                            ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                                            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                                    }`}
                            >
                                {type.icon}
                                {type.label}
                            </button>
                        ))}
                    </div>

                    {/* Note input */}
                    <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Type your note here…"
                        rows={4}
                        autoFocus
                        className="w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-primary-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-300"
                    />
                </div>

                {/* Dialog actions */}
                <div className="flex items-center justify-end gap-2">
                    <MyButton
                        buttonType="secondary"
                        onClick={() => {
                            onOpenChange(false);
                            setNoteText('');
                            setActionType('NOTE_ADDED');
                        }}
                        disabled={createMutation.isPending}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        onClick={handleSubmit}
                        disabled={createMutation.isPending || !noteText.trim()}
                        className="bg-primary-500 hover:bg-primary-600"
                    >
                        {createMutation.isPending ? 'Saving…' : 'Add Activity'}
                    </MyButton>
                </div>
            </DialogContent>
        </Dialog>
    );
};
