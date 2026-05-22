import { useRef, useState } from 'react';
import { Microphone, UploadSimple, Stop, Trash, CircleNotch, Warning } from '@phosphor-icons/react';
import { UploadFileInS3, getPublicUrl } from '@/services/upload_file';
import { Button } from '@/components/ui/button';
import { useCallRecorder } from './use-call-recorder';
import {
    type CallActivity,
    type CallRecording,
    type CallRecordingSource,
    formatCallDuration,
    getMediaUploadContext,
} from './call-activity';
import { CallOutcomeSelect } from './CallOutcomeSelect';

interface CallRecordingInputProps {
    value: CallActivity | null;
    onChange: (next: CallActivity | null) => void;
}

/** Read an audio file's duration (seconds) via a throwaway <audio> element. */
function getAudioDuration(file: File): Promise<number | undefined> {
    return new Promise((resolve) => {
        try {
            const url = URL.createObjectURL(file);
            const audio = document.createElement('audio');
            audio.preload = 'metadata';
            audio.onloadedmetadata = () => {
                URL.revokeObjectURL(url);
                resolve(isFinite(audio.duration) ? audio.duration : undefined);
            };
            audio.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(undefined);
            };
            audio.src = url;
        } catch {
            resolve(undefined);
        }
    });
}

export const CallRecordingInput = ({ value, onChange }: CallRecordingInputProps) => {
    const recorder = useCallRecorder();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const recording = value?.recording ?? null;

    const update = (patch: Partial<CallActivity>) => onChange({ ...(value ?? {}), ...patch });

    const handleFile = async (
        file: File,
        source: CallRecordingSource,
        knownDuration?: number
    ) => {
        setUploadError(null);
        setIsUploading(true);
        try {
            const { userId, instituteId } = getMediaUploadContext();
            const fileId = await UploadFileInS3(
                file,
                () => {},
                userId,
                instituteId,
                'CALL_RECORDINGS',
                true
            );
            if (!fileId) throw new Error('Upload failed');
            const url = await getPublicUrl(fileId);
            if (!url) throw new Error('Could not resolve recording URL');
            const durationSeconds = knownDuration ?? (await getAudioDuration(file));
            const next: CallRecording = {
                source,
                url,
                fileId,
                mimeType: file.type || undefined,
                durationSeconds,
            };
            onChange({ ...(value ?? {}), recording: next });
        } catch {
            setUploadError('Could not upload the recording. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const startRecording = async () => {
        setUploadError(null);
        await recorder.start();
    };

    const stopRecording = async () => {
        const result = await recorder.stop();
        if (result) await handleFile(result.file, 'BROWSER_RECORDING', result.durationSeconds);
    };

    const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('audio/')) {
            setUploadError('Please choose an audio file.');
            return;
        }
        await handleFile(file, 'MANUAL_UPLOAD');
    };

    const removeRecording = () => {
        setUploadError(null);
        update({ recording: undefined });
    };

    return (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2.5">
            <span className="text-xs font-medium text-neutral-600">Call recording</span>

            {recorder.isRecording ? (
                <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-danger-600">
                        <span className="size-2 animate-pulse rounded-full bg-danger-500" />
                        Recording {formatCallDuration(recorder.elapsedSeconds)}
                    </span>
                    <Button
                        type="button"
                        size="sm"
                        className="h-7 gap-1 bg-danger-500 px-2.5 text-xs text-white hover:bg-danger-600"
                        onClick={stopRecording}
                    >
                        <Stop weight="fill" className="size-3.5" /> Stop
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2.5 text-xs text-neutral-500"
                        onClick={recorder.cancel}
                    >
                        Cancel
                    </Button>
                </div>
            ) : isUploading ? (
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <CircleNotch className="size-4 animate-spin" />
                    Uploading recording…
                </div>
            ) : recording ? (
                <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <audio controls src={recording.url} className="h-9 min-w-0 flex-1" />
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs text-neutral-500 hover:text-danger-600"
                        onClick={removeRecording}
                        title="Remove recording"
                    >
                        <Trash className="size-3.5" /> Remove
                    </Button>
                </div>
            ) : (
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 px-2.5 text-xs"
                        onClick={startRecording}
                    >
                        <Microphone className="size-3.5" /> Record
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 px-2.5 text-xs"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <UploadSimple className="size-3.5" /> Upload
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={onPickFile}
                    />
                </div>
            )}

            {(uploadError || recorder.error) && (
                <span className="flex items-center gap-1 text-xs text-danger-600">
                    <Warning className="size-3.5" /> {uploadError || recorder.error}
                </span>
            )}

            {/* Call outcome / disposition */}
            <CallOutcomeSelect
                value={value?.outcome}
                onChange={(outcome) => update({ outcome })}
            />
        </div>
    );
};

export default CallRecordingInput;
