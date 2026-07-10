// Track B — "Class Materials" card on the session view page: lets the teacher
// upload a PDF or a video (file upload or YouTube link) and push it straight
// into one or more course chapters, always visible (not tied to a recording).
// See docs/LIVE_CLASS_PAST_SESSIONS_AND_CONTENT_LINKING_PLAN.md, "Track B".

import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
    FilePdf,
    VideoCamera as Video,
    UploadSimple,
    YoutubeLogo,
    Notebook,
} from '@phosphor-icons/react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MyInput } from '@/components/design-system/input';
import { MyButton } from '@/components/design-system/button';
import { cn } from '@/lib/utils';

import { getInstituteId } from '@/constants/helper';
import { UploadFileInS3 } from '@/services/upload_file';
import {
    useLinkSessionContent,
    useSessionContentLinks,
    summarizeContentLinkOutcomes,
    type ContentLinkSourceKind,
} from '../../-services/content-link-service';
import {
    SessionContentDestinationPicker,
    type DestinationBatch,
    type DestinationPickerSubmitPayload,
} from './SessionContentDestinationPicker';
import { UnlinkContentLinkButton } from './UnlinkContentLinkButton';

interface Props {
    sessionId: string;
    scheduleId?: string;
    sessionTitle?: string;
    batches: DestinationBatch[];
}

type PanelMode = null | 'PDF' | 'VIDEO';
type VideoTab = 'UPLOAD' | 'YOUTUBE';

const isLikelyYoutubeUrl = (url: string) =>
    /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url.trim());

export function ClassMaterialsCard({ sessionId, scheduleId, sessionTitle, batches }: Props) {
    const [panel, setPanel] = useState<PanelMode>(null);
    const [videoTab, setVideoTab] = useState<VideoTab>('UPLOAD');
    const [title, setTitle] = useState(() => buildDefaultTitle(sessionTitle));
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const linksQuery = useSessionContentLinks(sessionId);
    const linkMutation = useLinkSessionContent();

    const materialLinks = useMemo(
        () =>
            (linksQuery.data ?? []).filter(
                (l) => l.content_type === 'MATERIAL_PDF' || l.content_type === 'MATERIAL_VIDEO'
            ),
        [linksQuery.data]
    );

    const openPanel = (mode: PanelMode) => {
        setPanel(mode);
        setTitle(buildDefaultTitle(sessionTitle));
        setYoutubeUrl('');
        setSelectedFile(null);
        setVideoTab('UPLOAD');
    };

    const acceptType = panel === 'PDF' ? 'application/pdf' : 'video/*';
    const youtubeValid = videoTab === 'YOUTUBE' ? isLikelyYoutubeUrl(youtubeUrl) : true;
    const fileReady = panel === 'PDF' ? !!selectedFile : videoTab === 'UPLOAD' ? !!selectedFile : true;
    const canSubmitContent = !!title.trim() && fileReady && youtubeValid;

    const handleSubmit = async (payload: DestinationPickerSubmitPayload) => {
        const instituteId = getInstituteId();
        if (!instituteId) {
            toast.error('Could not resolve your institute.');
            return;
        }

        try {
            let sourceKind: ContentLinkSourceKind;
            let fileId: string | undefined;
            let url: string | undefined;

            if (panel === 'PDF') {
                sourceKind = 'UPLOAD_PDF';
                setIsUploading(true);
                fileId = await UploadFileInS3(
                    selectedFile ?? undefined,
                    setIsUploading,
                    instituteId,
                    'PDF_DOCUMENTS',
                    undefined,
                    false
                );
                if (!fileId) throw new Error('Could not upload the PDF.');
            } else if (videoTab === 'UPLOAD') {
                sourceKind = 'UPLOAD_VIDEO';
                setIsUploading(true);
                fileId = await UploadFileInS3(
                    selectedFile ?? undefined,
                    setIsUploading,
                    instituteId,
                    'VIDEO_DOCUMENTS',
                    undefined,
                    false
                );
                if (!fileId) throw new Error('Could not upload the video.');
            } else {
                sourceKind = 'YOUTUBE';
                url = youtubeUrl.trim();
            }

            const outcomes = await linkMutation.mutateAsync({
                session_id: sessionId,
                schedule_id: scheduleId,
                source: { kind: sourceKind, file_id: fileId, url },
                title: title.trim() || buildDefaultTitle(sessionTitle),
                slide_status: payload.slideStatus,
                notify: payload.notify,
                position: payload.position,
                destinations: payload.destinations,
            });
            toast.success(summarizeContentLinkOutcomes(outcomes));
            openPanel(null);
        } catch (err) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(message || (err instanceof Error ? err.message : 'Could not add this material.'));
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Card className="overflow-hidden border-border/60 shadow-sm">
            <CardHeader className="bg-muted/40 px-6 py-4">
                <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-3 text-lg font-semibold">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600 shadow-sm">
                            <Notebook className="size-5" />
                        </div>
                        Class Materials
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => openPanel(panel === 'PDF' ? null : 'PDF')}
                            className={cn(
                                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border bg-white px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted',
                                panel === 'PDF' && 'border-primary-400 bg-primary-50 text-primary-700'
                            )}
                        >
                            <FilePdf className="size-3" />
                            Upload PDF
                        </button>
                        <button
                            type="button"
                            onClick={() => openPanel(panel === 'VIDEO' ? null : 'VIDEO')}
                            className={cn(
                                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border bg-white px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted',
                                panel === 'VIDEO' && 'border-primary-400 bg-primary-50 text-primary-700'
                            )}
                        >
                            <Video className="size-3" />
                            Add Video
                        </button>
                    </div>
                </div>
            </CardHeader>
            <Separator />
            <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
                {materialLinks.length === 0 && !panel && (
                    <p className="text-xs text-muted-foreground">
                        No class materials added yet. Upload a PDF or add a video to link it to a
                        chapter.
                    </p>
                )}

                {materialLinks.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {materialLinks.map((link) => (
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
                )}

                {panel && (
                    <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3">
                        <MyInput
                            inputType="text"
                            label="Title"
                            input={title}
                            onChangeFunction={(e) => setTitle(e.target.value)}
                            size="large"
                            className="w-full sm:w-full"
                            required
                        />

                        {panel === 'VIDEO' && (
                            <div className="flex gap-2">
                                <TabButton
                                    active={videoTab === 'UPLOAD'}
                                    label="Upload file"
                                    icon={<UploadSimple className="size-3.5" />}
                                    onClick={() => setVideoTab('UPLOAD')}
                                />
                                <TabButton
                                    active={videoTab === 'YOUTUBE'}
                                    label="YouTube URL"
                                    icon={<YoutubeLogo className="size-3.5" />}
                                    onClick={() => setVideoTab('YOUTUBE')}
                                />
                            </div>
                        )}

                        {(panel === 'PDF' || (panel === 'VIDEO' && videoTab === 'UPLOAD')) && (
                            <div className="flex flex-col gap-2">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept={acceptType}
                                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                                    className="text-xs text-neutral-600 file:mr-3 file:rounded-md file:border file:border-neutral-300 file:bg-white file:px-2.5 file:py-1.5 file:text-xs file:font-medium"
                                />
                                {selectedFile && (
                                    <p className="text-xs text-neutral-500">
                                        {selectedFile.name} · {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                                    </p>
                                )}
                            </div>
                        )}

                        {panel === 'VIDEO' && videoTab === 'YOUTUBE' && (
                            <MyInput
                                inputType="text"
                                label="YouTube URL"
                                inputPlaceholder="https://www.youtube.com/watch?v=..."
                                input={youtubeUrl}
                                onChangeFunction={(e) => setYoutubeUrl(e.target.value)}
                                size="large"
                                className="w-full sm:w-full"
                                error={youtubeUrl.trim() && !youtubeValid ? 'Enter a valid YouTube URL' : undefined}
                                required
                            />
                        )}

                        <SessionContentDestinationPicker
                            batches={batches}
                            existingLinks={linksQuery.data}
                            onSubmit={handleSubmit}
                            isSubmitting={linkMutation.isPending || isUploading}
                            submitDisabled={!canSubmitContent}
                            submitLabel={isUploading ? 'Uploading…' : 'Add'}
                        />

                        <div className="flex justify-end">
                            <MyButton
                                type="button"
                                buttonType="text"
                                scale="small"
                                onClick={() => openPanel(null)}
                            >
                                Cancel
                            </MyButton>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function TabButton({
    active,
    label,
    icon,
    onClick,
}: {
    active: boolean;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                active
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-primary-300'
            )}
        >
            {icon}
            {label}
        </button>
    );
}

function buildDefaultTitle(sessionTitle: string | undefined): string {
    const label = sessionTitle?.trim() || 'Session';
    const formatted = new Date().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
    return `${label} – Notes (${formatted})`;
}
