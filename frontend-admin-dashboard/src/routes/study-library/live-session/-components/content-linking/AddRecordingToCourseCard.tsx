// Track B — per-recording "Add to course" inline panel, rendered inside the
// existing Recordings card row on the session view page. Lets the teacher
// pick destination chapter(s) for a recording in ≤3 clicks without leaving
// the page. See docs/LIVE_CLASS_PAST_SESSIONS_AND_CONTENT_LINKING_PLAN.md.

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CaretDown, CaretUp, FolderPlus } from '@phosphor-icons/react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MyInput } from '@/components/design-system/input';
import { cn } from '@/lib/utils';

import {
    useLinkSessionContent,
    useSessionContentLinks,
    summarizeContentLinkOutcomes,
} from '../../-services/content-link-service';
import {
    SessionContentDestinationPicker,
    type DestinationBatch,
    type DestinationPickerSubmitPayload,
} from './SessionContentDestinationPicker';
import { UnlinkContentLinkButton } from './UnlinkContentLinkButton';
import type { MeetingRecording } from '../../-services/utils';

interface Props {
    sessionId: string;
    scheduleId?: string;
    sessionTitle?: string;
    /** The recording row this panel is attached to (allRecordings entry). */
    recording: MeetingRecording & { date: string; scheduleId: string };
    batches: DestinationBatch[];
    /** True when this recording has no fileId/youtubeVideoUrl and is Zoom-cloud-only. */
    needsSaveToLibraryFirst: boolean;
    /** Save-to-S3 + refetch, reused from the page's existing handler. Resolves once the recording has a fileId. */
    onSaveToLibrary: () => Promise<void>;
    /**
     * When false, only the linked-chapter chips (with unlink) are rendered —
     * no manual "Add to course" action. Used when the institute has
     * auto-upload on but the manual add-to-course feature off.
     */
    showAddAction?: boolean;
}

export function AddRecordingToCourseCard({
    sessionId,
    scheduleId,
    sessionTitle,
    recording,
    batches,
    needsSaveToLibraryFirst,
    onSaveToLibrary,
    showAddAction = true,
}: Props) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState(() => buildDefaultTitle(sessionTitle, recording.date));
    const [isSyncing, setIsSyncing] = useState(false);

    const linksQuery = useSessionContentLinks(sessionId);
    const linkMutation = useLinkSessionContent();

    const linkedChapters = useMemo(
        () => (linksQuery.data ?? []).filter((l) => l.recording_id === recording.recordingId),
        [linksQuery.data, recording.recordingId]
    );

    const handleSubmit = async (payload: DestinationPickerSubmitPayload) => {
        try {
            let syncedFirst = false;
            if (needsSaveToLibraryFirst) {
                setIsSyncing(true);
                try {
                    await onSaveToLibrary();
                    syncedFirst = true;
                } finally {
                    setIsSyncing(false);
                }
            }

            const outcomes = await linkMutation.mutateAsync({
                session_id: sessionId,
                schedule_id: scheduleId,
                source: { kind: 'RECORDING', recording_id: recording.recordingId },
                title: title.trim() || buildDefaultTitle(sessionTitle, recording.date),
                slide_status: payload.slideStatus,
                notify: payload.notify,
                position: payload.position,
                destinations: payload.destinations,
            });
            toast.success(summarizeContentLinkOutcomes(outcomes));
            setOpen(false);
            void syncedFirst; // informational only — no separate toast needed
        } catch (err) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            if (message?.toLowerCase().includes('save recording to library')) {
                toast.error('Save the recording to the library first, then try again.');
            } else {
                toast.error(message || 'Could not add this recording to the course.');
            }
        }
    };

    return (
        <Collapsible open={open} onOpenChange={setOpen} className="w-full">
            <div className="flex flex-wrap items-center gap-2">
                {showAddAction && (
                    <CollapsibleTrigger asChild>
                        <button
                            type="button"
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border bg-white px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                        >
                            <FolderPlus className="size-3" />
                            Add to course
                            {open ? (
                                <CaretUp className="size-3" />
                            ) : (
                                <CaretDown className="size-3" />
                            )}
                        </button>
                    </CollapsibleTrigger>
                )}
                {linkedChapters.map((link) => (
                    <UnlinkContentLinkButton
                        key={link.id}
                        linkId={link.id}
                        chapterName={link.chapter_name}
                        slideTitle={link.slide_title}
                        contentType={link.content_type}
                        batchName={
                            batches.find(
                                (b) => b.packageSessionId === link.package_session_id
                            )?.displayName
                        }
                    />
                ))}
            </div>

            <CollapsibleContent className="mt-3 w-full">
                <div className={cn('flex flex-col gap-3 rounded-lg border bg-muted/20 p-3')}>
                    <MyInput
                        inputType="text"
                        label="Title"
                        input={title}
                        onChangeFunction={(e) => setTitle(e.target.value)}
                        size="large"
                        className="w-full sm:w-full"
                        required
                    />
                    <SessionContentDestinationPicker
                        batches={batches}
                        existingLinks={linksQuery.data}
                        onSubmit={handleSubmit}
                        isSubmitting={linkMutation.isPending || isSyncing}
                        submitDisabled={!title.trim()}
                        submitLabel={
                            isSyncing
                                ? 'Saving…'
                                : needsSaveToLibraryFirst
                                  ? 'Save to library & add'
                                  : 'Add'
                        }
                    />
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

function buildDefaultTitle(sessionTitle: string | undefined, date: string): string {
    const label = sessionTitle?.trim() || 'Session';
    try {
        const formatted = new Date(date).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
        return `${label} – Recording (${formatted})`;
    } catch {
        return `${label} – Recording`;
    }
}
