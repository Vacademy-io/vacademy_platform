import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UploadSimple } from '@phosphor-icons/react';
import { toast } from 'sonner';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { CALL_INTELLIGENCE_MANUAL_UPLOAD } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useCallIntelligenceEnabled } from './use-call-intelligence-enabled';

/**
 * Upload a recording of a call a counsellor made off-platform. Creates a MANUAL
 * call_log row (provider-agnostic) which — if Call Intelligence is on for the
 * institute — is transcribed + analyzed like any provider call. The acting user
 * is recorded as the counsellor by the backend.
 */

interface Props {
    userId: string;
    responseId?: string;
    /** Refetch the call list after a successful upload. */
    onUploaded?: () => void;
}

export function ManualCallUploadDialog({ userId, responseId, onUploaded }: Props) {
    const featureEnabled = useCallIntelligenceEnabled();
    const queryClient = useQueryClient();
    const instituteId = getCurrentInstituteId() ?? '';
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [direction, setDirection] = useState<'OUTBOUND' | 'INBOUND'>('OUTBOUND');
    const [durationSeconds, setDurationSeconds] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const reset = () => {
        setFile(null);
        setDirection('OUTBOUND');
        setDurationSeconds('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const { mutate: upload, isPending } = useMutation({
        mutationFn: async () => {
            if (!file) throw new Error('No file selected');
            const form = new FormData();
            form.append('file', file);
            form.append('instituteId', instituteId);
            form.append('userId', userId);
            if (responseId) form.append('responseId', responseId);
            form.append('direction', direction);
            const dur = parseInt(durationSeconds, 10);
            if (!Number.isNaN(dur) && dur > 0) form.append('durationSeconds', String(dur));
            await authenticatedAxiosInstance.post(CALL_INTELLIGENCE_MANUAL_UPLOAD, form);
        },
        onSuccess: () => {
            toast.success('Recording uploaded — analysis will appear shortly.');
            queryClient.invalidateQueries({
                queryKey: ['telephony-call-history', userId, instituteId],
            });
            onUploaded?.();
            reset();
            setOpen(false);
        },
        onError: (err: unknown) => {
            const msg = (err as { response?: { data?: { ex?: string } } })?.response?.data?.ex;
            toast.error(msg ?? 'Failed to upload recording');
        },
    });

    // No point offering an upload-for-analysis when Call Intelligence is off.
    if (!featureEnabled) return null;

    return (
        <MyDialog
            heading="Upload call recording"
            open={open}
            onOpenChange={(o) => {
                setOpen(o);
                if (!o) reset();
            }}
            trigger={
                <MyButton buttonType="secondary" scale="medium">
                    <UploadSimple className="size-4" /> Upload recording
                </MyButton>
            }
            footer={
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    onClick={() => upload()}
                    disable={!file || isPending}
                >
                    {isPending ? 'Uploading…' : 'Upload & analyze'}
                </MyButton>
            }
        >
            <div className="space-y-4 p-6">
                <div className="grid gap-2">
                    <Label htmlFor="manual-call-file">Recording file</Label>
                    <Input
                        id="manual-call-file"
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                    <p className="text-caption text-muted-foreground">
                        An audio recording (mp3, wav, m4a…) of a call you made off-platform.
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>Direction</Label>
                        <Select
                            value={direction}
                            onValueChange={(v) => setDirection(v as 'OUTBOUND' | 'INBOUND')}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="OUTBOUND">Outbound (you called)</SelectItem>
                                <SelectItem value="INBOUND">Inbound (lead called)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="manual-call-duration">Duration (seconds, optional)</Label>
                        <Input
                            id="manual-call-duration"
                            type="number"
                            min={0}
                            value={durationSeconds}
                            onChange={(e) => setDurationSeconds(e.target.value)}
                        />
                    </div>
                </div>
            </div>
        </MyDialog>
    );
}
