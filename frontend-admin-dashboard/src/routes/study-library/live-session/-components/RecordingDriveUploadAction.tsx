// "Upload to library" for Google Meet recordings. Meet saves recordings to the
// organiser's Google Drive and we hold no Drive scope, so unlike Zoom there is
// no server-side mirror: the admin downloads the MP4 from Drive and uploads it
// here. Once attached (fileId set, storage S3) the recording behaves like any
// library recording — Add to course and Upload to YouTube work off the fileId.

import { useState } from 'react';
import { toast } from 'sonner';
import { CloudArrowUp, ArrowSquareOut } from '@phosphor-icons/react';

import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { getInstituteId } from '@/constants/helper';
import { UploadFileInS3 } from '@/services/upload_file';

import { attachGoogleRecordingFile, type MeetingRecording } from '../-services/utils';
import { extractContentLinkErrorMessage } from '../-services/content-link-service';

interface Props {
    rec: MeetingRecording & { scheduleId: string };
    /** Receives the schedule's updated recording list once the file is attached. */
    onAttached: (scheduleId: string, recordings: MeetingRecording[]) => void;
}

export function RecordingDriveUploadAction({ rec, onAttached }: Props) {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const driveUrl = rec.playbackUrl || rec.downloadUrl;

    const handleOpenChange = (next: boolean) => {
        if (isSaving) return; // don't abandon an upload mid-flight
        setOpen(next);
        if (!next) setFile(null);
    };

    const handleUpload = async () => {
        const instituteId = getInstituteId();
        if (!file || !instituteId) return;
        setIsSaving(true);
        try {
            const fileId = await UploadFileInS3(
                file,
                () => undefined,
                instituteId,
                'GOOGLE_MEET_RECORDING',
                rec.scheduleId,
                false
            );
            if (!fileId) throw new Error('Upload failed');
            const result = await attachGoogleRecordingFile(rec.scheduleId, rec.recordingId, fileId);
            onAttached(rec.scheduleId, result.recordings ?? []);
            toast.success('Recording saved to library');
            setOpen(false);
            setFile(null);
        } catch (err) {
            toast.error(
                extractContentLinkErrorMessage(err) ||
                    'Could not save the recording. Please try again.'
            );
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <MyDialog
            heading="Upload recording to library"
            dialogWidth="max-w-md"
            open={open}
            onOpenChange={handleOpenChange}
            triggerTooltip="Google Meet keeps this recording in Google Drive. Upload a copy to add it to a course."
            trigger={
                <button
                    type="button"
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border bg-white px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                    <CloudArrowUp className="size-3" />
                    Upload to library
                </button>
            }
            footer={
                <>
                    <MyButton
                        buttonType="secondary"
                        onClick={() => handleOpenChange(false)}
                        disable={isSaving}
                    >
                        Cancel
                    </MyButton>
                    <MyButton onClick={handleUpload} disable={!file || isSaving}>
                        {isSaving ? 'Uploading…' : 'Upload'}
                    </MyButton>
                </>
            }
        >
            <div className="space-y-4 text-sm">
                <p className="text-muted-foreground">
                    Google Meet saves recordings to the organiser&apos;s Google Drive, which
                    Vacademy can&apos;t read directly. Upload a copy to add it to a course or
                    YouTube.
                </p>
                <div className="space-y-2">
                    <div className="font-medium">1. Download the recording from Drive</div>
                    {driveUrl ? (
                        <a
                            href={driveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md border bg-white px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                        >
                            <ArrowSquareOut className="size-3" />
                            Open in Google Drive
                        </a>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            Find it in the organiser&apos;s Drive under &quot;Meet Recordings&quot;.
                        </p>
                    )}
                </div>
                <div className="space-y-2">
                    <div className="font-medium">2. Choose the downloaded MP4</div>
                    <input
                        type="file"
                        accept="video/*"
                        disabled={isSaving}
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        className="block w-full text-xs file:mr-3 file:rounded-md file:border file:bg-white file:px-2.5 file:py-1.5 file:text-xs file:font-medium"
                    />
                    {file && (
                        <p className="text-xs text-muted-foreground">
                            {file.name} · {Math.round(file.size / (1024 * 1024))} MB
                        </p>
                    )}
                </div>
                {isSaving && (
                    <p className="text-xs text-muted-foreground">
                        Uploading — large recordings can take a few minutes. Keep this tab open.
                    </p>
                )}
            </div>
        </MyDialog>
    );
}
