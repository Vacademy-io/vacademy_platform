import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { CREATE_TIMELINE_EVENT } from '@/constants/urls';
import {
    NotePencil,
    Phone,
    CalendarCheck,
    Buildings,
} from '@phosphor-icons/react';

const NOTE_ACTION_TYPES = [
    { value: 'NOTE', label: 'Note', icon: <NotePencil weight="fill" className="size-3.5" /> },
    { value: 'CALL_LOG', label: 'Call Log', icon: <Phone weight="fill" className="size-3.5" /> },
    {
        value: 'FOLLOW_UP',
        label: 'Follow Up',
        icon: <CalendarCheck weight="fill" className="size-3.5" />,
    },
    { value: 'MEETING', label: 'Meeting', icon: <Buildings weight="fill" className="size-3.5" /> },
];

interface AddLeadNoteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId: string;
    userName?: string;
    onSuccess?: () => void;
}

export const AddLeadNoteDialog = ({
    open,
    onOpenChange,
    userId,
    userName,
    onSuccess,
}: AddLeadNoteDialogProps) => {
    const [noteText, setNoteText] = useState('');
    const [actionType, setActionType] = useState('NOTE');
    const queryClient = useQueryClient();

    const createMutation = useMutation({
        mutationFn: async () => {
            const label =
                NOTE_ACTION_TYPES.find((t) => t.value === actionType)?.label ?? 'Note';
            const response = await authenticatedAxiosInstance.post(CREATE_TIMELINE_EVENT, {
                type: 'STUDENT',
                type_id: userId,
                action_type: actionType,
                title: label,
                description: noteText.trim(),
                student_user_id: userId,
            });
            return response.data;
        },
        onSuccess: () => {
            toast.success('Note added');
            setNoteText('');
            setActionType('NOTE');
            queryClient.invalidateQueries({ queryKey: ['latest-notes-batch'] });
            queryClient.invalidateQueries({ queryKey: ['cross-stage-timeline', userId] });
            onSuccess?.();
            onOpenChange(false);
        },
        onError: () => toast.error('Failed to add note'),
    });

    const handleClose = () => {
        if (createMutation.isPending) return;
        setNoteText('');
        setActionType('NOTE');
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
            <DialogContent className="sm:max-w-[460px]">
                <DialogHeader>
                    <DialogTitle>
                        Add Note{userName ? ` — ${userName}` : ''}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-3 py-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {NOTE_ACTION_TYPES.map((type) => (
                            <button
                                key={type.value}
                                type="button"
                                onClick={() => setActionType(type.value)}
                                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                                    actionType === type.value
                                        ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                                        : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100'
                                }`}
                            >
                                {type.icon}
                                {type.label}
                            </button>
                        ))}
                    </div>
                    <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Type your note here…"
                        rows={4}
                        autoFocus
                        className="w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-primary-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-300"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                if (noteText.trim()) createMutation.mutate();
                            }
                        }}
                    />
                    <p className="text-[10px] text-neutral-400">Ctrl+Enter to submit</p>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={handleClose} disabled={createMutation.isPending}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => createMutation.mutate()}
                        disabled={createMutation.isPending || !noteText.trim()}
                    >
                        {createMutation.isPending ? 'Saving…' : 'Add Note'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
