import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
    ArrowClockwise,
    ArrowSquareOut,
    ClockCounterClockwise,
    Exam,
    FilmSlate,
    GraduationCap,
    Note,
    Spinner,
    Trash,
    WarningCircle,
} from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { StatusChip } from '@/components/design-system/status-chips';
import type { StatusType } from '@/components/design-system/status-chips';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteGeneration, listGenerations } from '../-services/paper-service';
import type { ArtifactType, GenerationStatus, KbGeneration } from '../-types/paper';

/**
 * Icon and label per artifact type. Adding a capability means one entry here —
 * the table, the endpoints and this list are all artifact-agnostic.
 */
const ARTIFACT_META: Record<ArtifactType, { label: string; icon: typeof Exam }> = {
    QUESTION_PAPER: { label: 'Question paper', icon: Exam },
    COURSE: { label: 'Course', icon: GraduationCap },
    PRESENTATION: { label: 'Presentation', icon: FilmSlate },
    QUIZ: { label: 'Quiz', icon: Exam },
    ASSESSMENT: { label: 'Assessment', icon: Exam },
    NOTES: { label: 'Notes', icon: Note },
    SUMMARY: { label: 'Summary', icon: Note },
    LESSON_PLAN: { label: 'Lesson plan', icon: Note },
    WORKSHEET: { label: 'Worksheet', icon: Note },
};

const STATUS_META: Record<GenerationStatus, { label: string; tone: StatusType }> = {
    DRAFT: { label: 'Draft', tone: 'INFO' },
    GENERATING: { label: 'Generating', tone: 'INFO' },
    READY: { label: 'Not saved yet', tone: 'WARNING' },
    SAVED: { label: 'Saved', tone: 'SUCCESS' },
    FAILED: { label: 'Failed', tone: 'DANGER' },
};

const when = (iso: string | null): string => {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    const mins = Math.round((Date.now() - then) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} h ago`;
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

interface GenerationHistoryProps {
    kbId: string;
    /** Bump to refetch — e.g. after returning from a generation. */
    refreshKey?: number;
}

/**
 * Everything this knowledge base has produced.
 *
 * Exists because a generation used to live only in one browser tab: navigating
 * away, or a job failing, lost both the output AND the plan that produced it,
 * with no trace that it ever happened. A failed run stays here with its reason
 * and its blueprint, so it can be picked up rather than started over.
 */
export const GenerationHistory = ({ kbId, refreshKey = 0 }: GenerationHistoryProps) => {
    const navigate = useNavigate();
    const [rows, setRows] = useState<KbGeneration[] | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        listGenerations(kbId)
            .then((r) => !cancelled && setRows(r))
            .catch(() => !cancelled && setRows([]));
        return () => {
            cancelled = true;
        };
    }, [kbId, refreshKey]);

    // Anything still running should resolve without a manual refresh.
    useEffect(() => {
        if (!rows?.some((r) => r.status === 'GENERATING')) return;
        const handle = setTimeout(() => {
            listGenerations(kbId)
                .then(setRows)
                .catch(() => undefined);
        }, 5000);
        return () => clearTimeout(handle);
    }, [rows, kbId]);

    const remove = async (row: KbGeneration) => {
        setBusyId(row.id);
        try {
            await deleteGeneration(row.id);
            setRows((prev) => prev?.filter((r) => r.id !== row.id) ?? null);
            toast.success('Removed from history');
        } catch {
            toast.error('Could not remove that entry');
        } finally {
            setBusyId(null);
        }
    };

    if (rows === null) return <Skeleton className="h-28 w-full rounded-lg" />;

    if (rows.length === 0) {
        return (
            <Card className="flex flex-col items-center gap-2 p-6 text-center">
                <ClockCounterClockwise className="size-6 text-neutral-300" />
                <p className="text-body text-neutral-500">
                    Nothing made from this knowledge base yet.
                </p>
                <p className="text-caption text-neutral-400">
                    Papers and courses you create will be listed here so you can come back to them.
                </p>
            </Card>
        );
    }

    return (
        <Card className="overflow-hidden">
            {rows.map((row) => {
                const meta = ARTIFACT_META[row.artifact_type] ?? ARTIFACT_META.QUESTION_PAPER;
                const status = STATUS_META[row.status] ?? STATUS_META.DRAFT;
                const Icon = meta.icon;
                const resumable = row.artifact_type === 'QUESTION_PAPER';

                return (
                    <div
                        key={row.id}
                        className="flex flex-col gap-2 border-b border-neutral-100 px-4 py-3 last:border-b-0"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                                <Icon className="mt-0.5 size-5 shrink-0 text-neutral-400" />
                                <div className="min-w-0">
                                    <p className="break-words text-body font-medium text-neutral-700">
                                        {row.title}
                                    </p>
                                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-caption text-neutral-500">
                                        <span>{meta.label}</span>
                                        {row.items_planned > 0 && (
                                            <span>
                                                {row.items_delivered} of {row.items_planned}{' '}
                                                questions
                                            </span>
                                        )}
                                        {row.credits_charged > 0 && (
                                            <span>{Math.round(row.credits_charged)} credits</span>
                                        )}
                                        <span>{when(row.created_at)}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                {row.status === 'GENERATING' ? (
                                    <span className="flex items-center gap-1.5 text-caption text-primary-500">
                                        <Spinner className="size-4 animate-spin" />
                                        Generating
                                    </span>
                                ) : (
                                    <StatusChip
                                        status={status.tone}
                                        text={status.label}
                                        textSize="text-caption"
                                        showIcon={false}
                                    />
                                )}
                            </div>
                        </div>

                        {row.status === 'FAILED' && row.error_message && (
                            <p className="ml-8 flex items-start gap-1.5 break-words text-caption text-danger-600">
                                <WarningCircle className="mt-0.5 size-3.5 shrink-0" />
                                {row.error_message}
                            </p>
                        )}

                        <div className="ml-8 flex flex-wrap items-center gap-2">
                            {resumable && row.status !== 'GENERATING' && (
                                <MyButton
                                    buttonType="secondary"
                                    scale="small"
                                    disable={busyId === row.id}
                                    onClick={() =>
                                        navigate({
                                            to: '/knowledge-base/paper/$kbId',
                                            params: { kbId },
                                            search: { resume: row.id },
                                        })
                                    }
                                >
                                    <ArrowClockwise className="mr-1 size-3.5" />
                                    {row.status === 'FAILED' ? 'Try again' : 'Open'}
                                </MyButton>
                            )}
                            {row.status === 'SAVED' && (
                                <MyButton
                                    buttonType="text"
                                    scale="small"
                                    onClick={() => navigate({ to: '/assessment/question-papers' })}
                                >
                                    <ArrowSquareOut className="mr-1 size-3.5" />
                                    In question bank
                                </MyButton>
                            )}
                            <MyButton
                                buttonType="text"
                                scale="small"
                                disable={busyId === row.id}
                                onClick={() => remove(row)}
                                className="text-danger-600"
                            >
                                <Trash className="mr-1 size-3.5" />
                                Remove
                            </MyButton>
                        </div>
                    </div>
                );
            })}
        </Card>
    );
};
