import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { cn, parseHtmlToString } from '@/lib/utils';
import { toast } from 'sonner';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { CREATE_TIMELINE_EVENT } from '@/constants/urls';
import { CallRecordingInput } from '@/components/shared/lead-calls/CallRecordingInput';
import {
    type CallActivity,
    callActivityToMetadata,
    isCallActivityEmpty,
} from '@/components/shared/lead-calls/call-activity';
import { NotePencil, Phone, CalendarCheck, Buildings } from '@phosphor-icons/react';
import { LeadAvatar } from '@/components/shared/leads/lead-avatar';

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
    const [callActivity, setCallActivity] = useState<CallActivity | null>(null);
    const queryClient = useQueryClient();

    // The rich text editor emits HTML — check the rendered text for emptiness.
    const isNoteEmpty = !parseHtmlToString(noteText).trim();

    // For Call Log, a recording / call details alone are enough to submit.
    const callMeta =
        actionType === 'CALL_LOG' && !isCallActivityEmpty(callActivity)
            ? callActivityToMetadata(callActivity as CallActivity)
            : undefined;
    const canSubmit = !isNoteEmpty || callMeta !== undefined;

    const createMutation = useMutation({
        mutationFn: async () => {
            const label = NOTE_ACTION_TYPES.find((t) => t.value === actionType)?.label ?? 'Note';
            const response = await authenticatedAxiosInstance.post(CREATE_TIMELINE_EVENT, {
                type: 'STUDENT',
                type_id: userId,
                action_type: actionType,
                title: label,
                description: noteText.trim(),
                student_user_id: userId,
                metadata: callMeta,
            });
            return response.data;
        },
        onSuccess: () => {
            toast.success('Note added');
            setNoteText('');
            setActionType('NOTE');
            setCallActivity(null);
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
        setCallActivity(null);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <LeadAvatar name={userName} size="md" />
                        <div className="min-w-0 text-left">
                            <DialogTitle>Add activity</DialogTitle>
                            <DialogDescription className="truncate">
                                {userName
                                    ? `Log a note or activity for ${userName}`
                                    : 'Log a note or activity for this lead'}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4 py-1">
                    {/* Activity type — segmented control */}
                    <div className="flex rounded-lg bg-neutral-100 p-0.5">
                        {NOTE_ACTION_TYPES.map((type) => (
                            <button
                                key={type.value}
                                type="button"
                                onClick={() => setActionType(type.value)}
                                className={cn(
                                    'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all',
                                    actionType === type.value
                                        ? 'bg-white text-primary-700 shadow-sm'
                                        : 'text-neutral-500 hover:text-neutral-700'
                                )}
                            >
                                {type.icon}
                                {type.label}
                            </button>
                        ))}
                    </div>

                    {/* Writing surface */}
                    <div
                        className="overflow-hidden rounded-lg border border-neutral-200 bg-white text-sm text-neutral-800 transition-colors focus-within:border-primary-300 focus-within:ring-1 focus-within:ring-primary-300 [&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                if (canSubmit) createMutation.mutate();
                            }
                        }}
                    >
                        <RichTextEditor
                            value={noteText}
                            onChange={setNoteText}
                            placeholder="Type your note here…"
                            minHeight={120}
                            minimalToolbar
                        />
                    </div>

                    {actionType === 'CALL_LOG' && (
                        <CallRecordingInput value={callActivity} onChange={setCallActivity} />
                    )}
                </div>

                <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
                    <span className="hidden items-center gap-1.5 text-xs text-neutral-400 sm:flex">
                        <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-xs font-medium text-neutral-500">
                            Ctrl + Enter
                        </kbd>
                        to save
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            onClick={handleClose}
                            disabled={createMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => createMutation.mutate()}
                            disabled={createMutation.isPending || !canSubmit}
                        >
                            {createMutation.isPending ? 'Saving…' : 'Add note'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
