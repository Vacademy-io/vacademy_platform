import { Waveform } from '@phosphor-icons/react';
import { type CallActivity, CALL_OUTCOME_LABELS, formatCallDuration } from './call-activity';

interface CallRecordingPlayerProps {
    call: CallActivity;
}

const SOURCE_LABELS: Record<string, string> = {
    MANUAL_UPLOAD: 'Uploaded',
    BROWSER_RECORDING: 'Recorded in browser',
};

/**
 * Read-only call card for the activity timeline: an audio player (when a
 * recording exists) plus a small meta line (duration · source / vendor).
 */
export const CallRecordingPlayer = ({ call }: CallRecordingPlayerProps) => {
    const { recording } = call;
    const outcomeLabel = call.outcome
        ? (CALL_OUTCOME_LABELS[call.outcome] ?? call.outcome)
        : null;
    if (!recording && !outcomeLabel) return null;

    const duration = formatCallDuration(recording?.durationSeconds);
    const sourceLabel = recording
        ? (call.provider ?? SOURCE_LABELS[recording.source] ?? recording.source)
        : null;
    const metaParts = [duration, sourceLabel].filter(Boolean);

    return (
        <div className="mt-2 flex flex-col gap-1.5 rounded-lg border border-neutral-100 bg-neutral-50 p-2">
            {recording && (
                <div className="flex items-center gap-2">
                    <Waveform weight="fill" className="size-4 shrink-0 text-teal-600" />
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <audio controls src={recording.url} className="h-8 min-w-0 flex-1" />
                </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
                {outcomeLabel && (
                    <span className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-caption font-medium text-neutral-600">
                        {outcomeLabel}
                    </span>
                )}
                {metaParts.length > 0 && (
                    <span className="text-caption text-neutral-400">{metaParts.join(' · ')}</span>
                )}
            </div>
        </div>
    );
};

export default CallRecordingPlayer;
