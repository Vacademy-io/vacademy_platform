import { useState } from 'react';
import { toast } from 'sonner';
import {
    ArrowClockwise,
    DotsThreeVertical,
    FilePdf,
    Globe,
    Note,
    Trash,
    YoutubeLogo,
} from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { StatusChip } from '@/components/design-system/status-chips';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LANGUAGE_LABEL, SOURCE_STATUS_META, STAGE_LABEL } from '../-constants';
import { useSourceActions } from '../-hooks';
import type { KnowledgeSource, SourceKind } from '../-types';

const KIND_ICON: Record<SourceKind, typeof FilePdf> = {
    PDF: FilePdf,
    URL: Globe,
    YOUTUBE: YoutubeLogo,
    TEXT: Note,
};

const formatCount = (n: number) => new Intl.NumberFormat('en-IN').format(n);

interface SourcesTableProps {
    kbId: string;
    sources: KnowledgeSource[];
    writable: boolean;
}

function SourceRow({
    source,
    kbId,
    writable,
    onDeleteRequest,
}: {
    source: KnowledgeSource;
    kbId: string;
    writable: boolean;
    onDeleteRequest: (source: KnowledgeSource) => void;
}) {
    const { toggleActive, reindex } = useSourceActions(kbId);
    const Icon = KIND_ICON[source.source_kind] ?? Note;
    const meta = SOURCE_STATUS_META[source.status];
    const busy = source.status === 'PENDING' || source.status === 'PROCESSING';

    return (
        <div className="flex flex-col gap-2 border-b border-neutral-100 px-4 py-3 last:border-b-0">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <Icon className="mt-0.5 size-5 shrink-0 text-neutral-400" />
                    <div className="min-w-0">
                        <p className="truncate text-body font-medium text-neutral-700">
                            {source.title}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-caption text-neutral-500">
                            {source.page_count > 0 && (
                                <span>{formatCount(source.page_count)} pages</span>
                            )}
                            {source.chunk_count > 0 && (
                                <span>{formatCount(source.chunk_count)} passages</span>
                            )}
                            {source.figure_count > 0 && (
                                <span>
                                    {formatCount(source.figure_count)} diagrams &amp; tables
                                </span>
                            )}
                            {source.detected_languages.length > 0 && (
                                <span>
                                    {source.detected_languages
                                        .map((l) => LANGUAGE_LABEL[l] ?? l)
                                        .join(', ')}
                                </span>
                            )}
                            {/* Cost transparency per source: what was actually charged, and
                                how many pages needed the paid OCR path. */}
                            {source.credits_charged > 0 && (
                                <span>{formatCount(source.credits_charged)} credits</span>
                            )}
                            {source.ocr_pages > 0 && (
                                <span>{formatCount(source.ocr_pages)} scanned pages read</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <StatusChip
                        status={meta.tone}
                        text={meta.label}
                        textSize="text-caption"
                        showIcon={false}
                    />
                    {writable && (
                        <>
                            <Switch
                                checked={source.is_active}
                                disabled={busy || toggleActive.isPending}
                                aria-label={
                                    source.is_active
                                        ? `Stop using ${source.title}`
                                        : `Start using ${source.title}`
                                }
                                onCheckedChange={(next) =>
                                    toggleActive.mutate(
                                        { sourceId: source.id, isActive: next },
                                        {
                                            onSuccess: () =>
                                                toast.success(
                                                    next
                                                        ? 'Now being used for answers'
                                                        : 'No longer used for answers'
                                                ),
                                            onError: () => toast.error('Could not update this'),
                                        }
                                    )
                                }
                            />
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <MyButton
                                        buttonType="secondary"
                                        layoutVariant="icon"
                                        scale="small"
                                        aria-label={`Actions for ${source.title}`}
                                    >
                                        <DotsThreeVertical className="size-4" />
                                    </MyButton>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        disabled={busy || reindex.isPending}
                                        onClick={() =>
                                            reindex.mutate(source.id, {
                                                onSuccess: () =>
                                                    toast.success(
                                                        'Reading it again — you are not charged twice.'
                                                    ),
                                                onError: () =>
                                                    toast.error('Could not start re-reading'),
                                            })
                                        }
                                    >
                                        <ArrowClockwise className="mr-2 size-4" />
                                        Read again
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="text-danger-600"
                                        onClick={() => onDeleteRequest(source)}
                                    >
                                        <Trash className="mr-2 size-4" />
                                        Remove
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </>
                    )}
                </div>
            </div>

            {busy && (
                <div className="flex flex-col gap-1 pl-8">
                    <Progress value={source.progress} className="h-1.5" />
                    <p className="text-caption text-neutral-500">
                        {source.stage ? STAGE_LABEL[source.stage] ?? 'Working' : 'Getting started'}
                        {' · '}
                        {source.progress}%
                    </p>
                </div>
            )}

            {/* An honest, actionable message beats a green tick over bad text. */}
            {source.status === 'PARTIAL' && source.pages_low_confidence > 0 && (
                <p className="pl-8 text-caption text-warning-600">
                    {formatCount(source.pages_low_confidence)} of {formatCount(source.page_count)}{' '}
                    pages could not be read reliably. The rest is usable — re-upload a clearer scan
                    of those pages if it matters.
                </p>
            )}
            {source.status === 'FAILED' && source.error_message && (
                <p className="pl-8 text-caption text-danger-600">{source.error_message}</p>
            )}
            {!source.is_active && source.status !== 'FAILED' && (
                <p className="pl-8 text-caption text-neutral-400">
                    Not being used for answers right now.
                </p>
            )}
        </div>
    );
}

export const SourcesTable = ({ kbId, sources, writable }: SourcesTableProps) => {
    const [pendingDelete, setPendingDelete] = useState<KnowledgeSource | null>(null);
    const { remove } = useSourceActions(kbId);

    if (sources.length === 0) {
        return (
            <Card className="flex flex-col items-center gap-2 p-8 text-center">
                <FilePdf className="size-6 text-neutral-300" />
                <p className="text-body text-neutral-500">
                    Nothing added yet. Add a textbook, a set of notes or a past paper to begin.
                </p>
            </Card>
        );
    }

    return (
        <>
            <Card className="overflow-hidden">
                {sources.map((source) => (
                    <SourceRow
                        key={source.id}
                        source={source}
                        kbId={kbId}
                        writable={writable}
                        onDeleteRequest={setPendingDelete}
                    />
                ))}
            </Card>

            <AlertDialog
                open={Boolean(pendingDelete)}
                onOpenChange={(open) => !open && setPendingDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove this source?</AlertDialogTitle>
                        <AlertDialogDescription>
                            &ldquo;{pendingDelete?.title}&rdquo; and everything read from it will be
                            deleted. Adding it again later will cost credits again. To stop using it
                            without losing the work, switch it off instead.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={remove.isPending}
                            className="bg-danger-600 text-white hover:bg-danger-700"
                            onClick={() => {
                                if (!pendingDelete) return;
                                remove.mutate(pendingDelete.id, {
                                    onSuccess: () => {
                                        toast.success('Removed');
                                        setPendingDelete(null);
                                    },
                                    onError: () => toast.error('Could not remove this source'),
                                });
                            }}
                        >
                            {remove.isPending ? 'Removing…' : 'Remove'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
