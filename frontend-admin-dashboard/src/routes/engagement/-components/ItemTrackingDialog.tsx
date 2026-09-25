import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
    CaretLeft,
    CaretRight,
    DownloadSimple,
    Paperclip,
    WarningCircle,
} from '@phosphor-icons/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MyButton } from '@/components/design-system/button';
import { getPublicUrl } from '@/services/upload_file';
import { getLanguageSetting } from '@/services/language-settings';
import { normalizeTimezone } from '@/utils/timezone';
import { downloadItemTrackingCsv, getItemTracking } from '../-services/engagement-service';
import type { EngagementItemDTO, EngagementTrackingRow } from '../-types/types';

const PAGE_SIZE = 20;

/**
 * The answer format of a question, read the way the server grades it
 * (EngagementLearnerService.questionFormat): blank means MCQ, and case is ignored.
 * Null for any other task type.
 */
function questionFormat(item: EngagementItemDTO | null): string | null {
    if (item?.itemType !== 'QUESTION_OF_DAY') return null;
    try {
        const payload = JSON.parse(item.payloadJson ?? '{}') as { format?: string | null };
        const format = payload?.format?.trim().toUpperCase();
        return format || 'MCQ';
    } catch {
        return 'MCQ';
    }
}

/**
 * Only a multiple-choice question with an answer key has a right answer. Written and
 * uploaded answers are stored with isCorrect=null, so counting them as "0 correct,
 * 0% accuracy" would read as a class that got everything wrong.
 */
function isGradable(item: EngagementItemDTO | null): boolean {
    if (questionFormat(item) !== 'MCQ') return false;
    try {
        const payload = JSON.parse(item?.payloadJson ?? '{}') as {
            correctOptionId?: string | null;
        };
        return Boolean(payload?.correctOptionId);
    } catch {
        return false;
    }
}

/** A server instant, shown in the institute's timezone and the admin's language. */
function formatInstant(iso: string, locale: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    const options: Intl.DateTimeFormatOptions = {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: normalizeTimezone(getLanguageSetting()?.timezone),
    };
    try {
        return new Intl.DateTimeFormat(locale, options).format(date);
    } catch {
        return new Intl.DateTimeFormat(undefined, options).format(date);
    }
}

/**
 * Who did what on one task.
 *
 * Learner names are hydrated server-side from auth_service; when that lookup fails
 * the row falls back to a shortened id rather than showing nothing, so the table is
 * still usable.
 */
export function ItemTrackingDialog({
    item,
    open,
    onOpenChange,
}: {
    item: EngagementItemDTO | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { t } = useTranslation('engagement');
    const [page, setPage] = useState(0);
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setPage(0);
            setExportError(null);
        }
    }, [open, item?.id]);

    const { data, isFetching, isLoading, isError, refetch } = useQuery({
        queryKey: ['engagement-item-tracking', item?.id, page],
        queryFn: () => getItemTracking(item!.id, page, PAGE_SIZE),
        enabled: open && Boolean(item?.id),
        placeholderData: keepPreviousData,
    });

    const gradable = isGradable(item);
    // A written or uploaded question: the teacher reads the replies instead.
    const format = questionFormat(item);
    const readable = format === 'TEXT' || format === 'UPLOAD';
    // Written and uploaded answers get their own column; there is nothing to grade,
    // the teacher reads them.
    const hasAnswers = (data?.rows ?? []).some((r) => r.textAnswer || (r.fileIds?.length ?? 0) > 0);
    const accuracy =
        data && data.completedCount > 0
            ? Math.round((data.correctCount / data.completedCount) * 100)
            : null;
    const totalPages = data?.totalPages ?? 1;
    // A failed background refetch keeps the rows that did load; only a load with
    // nothing to show is an error state.
    const failed = isError && !data;

    async function handleExport() {
        if (!item) return;
        setExporting(true);
        setExportError(null);
        try {
            await downloadItemTrackingCsv(item.id, item.title);
        } catch {
            setExportError(t('tracking.exportError'));
        } finally {
            setExporting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-screen w-full overflow-y-auto sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle className="truncate text-start">
                        {item?.title ?? t('tracking.task')}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        {/* No numbers until they have loaded: a failed load is not "0 completed". */}
                        {data ? (
                            <div className="flex flex-wrap gap-3">
                                <Stat
                                    label={t('tracking.completed')}
                                    value={String(data.completedCount)}
                                />
                                {gradable && (
                                    <Stat
                                        label={t('tracking.correct')}
                                        value={String(data.correctCount)}
                                    />
                                )}
                                {gradable && accuracy !== null && (
                                    <Stat label={t('tracking.accuracy')} value={`${accuracy}%`} />
                                )}
                                {readable && (
                                    <Stat
                                        label={t('tracking.answersToRead')}
                                        value={String(data.completedCount)}
                                    />
                                )}
                            </div>
                        ) : isLoading ? (
                            <div className="flex flex-wrap gap-3" aria-hidden="true">
                                {[0, 1].map((i) => (
                                    <Skeleton key={i} className="h-14 w-28 rounded-lg" />
                                ))}
                            </div>
                        ) : (
                            <span />
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={exporting || (data?.totalRows ?? 0) === 0}
                            onClick={handleExport}
                        >
                            <DownloadSimple size={16} />
                            {exporting ? t('tracking.preparing') : t('tracking.export')}
                        </Button>
                    </div>

                    {exportError && (
                        <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">
                            {exportError}
                        </p>
                    )}

                    {failed ? (
                        <Alert className="border-danger-200 bg-danger-50">
                            <WarningCircle size={18} className="text-danger-600" />
                            <AlertDescription className="space-y-3 text-danger-700">
                                <p>{t('tracking.loadError')}</p>
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    scale="small"
                                    disable={isFetching}
                                    onClick={() => void refetch()}
                                >
                                    {t('tracking.retry')}
                                </MyButton>
                            </AlertDescription>
                        </Alert>
                    ) : isLoading ? (
                        <div className="space-y-2" aria-busy="true">
                            {[0, 1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-10 w-full" />
                            ))}
                        </div>
                    ) : data && data.totalRows === 0 ? (
                        <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
                            {t('tracking.nobody')}
                        </p>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-neutral-200">
                            <table className="w-full text-sm">
                                <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                                    <tr>
                                        <th className="px-3 py-2 text-start">
                                            {t('tracking.learner')}
                                        </th>
                                        <th className="px-3 py-2 text-start">
                                            {t('tracking.username')}
                                        </th>
                                        <th className="px-3 py-2 text-start">
                                            {t('tracking.status')}
                                        </th>
                                        {gradable && (
                                            <th className="px-3 py-2 text-start">
                                                {t('tracking.result')}
                                            </th>
                                        )}
                                        {hasAnswers && (
                                            <th className="px-3 py-2 text-start">
                                                {t('tracking.answer')}
                                            </th>
                                        )}
                                        <th className="px-3 py-2 text-start">
                                            {t('tracking.points')}
                                        </th>
                                        <th className="px-3 py-2 text-start">
                                            {t('tracking.time')}
                                        </th>
                                        <th className="px-3 py-2 text-start">
                                            {t('tracking.completedAt')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {(data?.rows ?? []).map((row) => (
                                        <TrackingRow
                                            key={row.userId}
                                            row={row}
                                            gradable={gradable}
                                            showAnswer={hasAnswers}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div
                        className={
                            failed
                                ? 'hidden'
                                : 'flex items-center justify-between text-sm text-neutral-500'
                        }
                    >
                        <span>
                            {t('tracking.learners', { count: data?.totalRows ?? 0 })}
                            {isFetching ? ` · ${t('tracking.loading')}` : ''}
                        </span>
                        {totalPages > 1 && (
                            <span className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={page === 0}
                                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                                >
                                    <CaretLeft size={14} />
                                </Button>
                                <span className="tabular-nums">
                                    {page + 1} / {totalPages}
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={page + 1 >= totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    <CaretRight size={14} />
                                </Button>
                            </span>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function TrackingRow({
    row,
    gradable,
    showAnswer,
}: {
    row: EngagementTrackingRow;
    gradable: boolean;
    showAnswer: boolean;
}) {
    const { t, i18n } = useTranslation('engagement');
    return (
        <tr>
            <td className="px-3 py-2">
                <span className="block text-neutral-900">
                    {row.fullName ?? `${row.userId.slice(0, 8)}…`}
                </span>
                {row.email && <span className="block text-xs text-neutral-500">{row.email}</span>}
            </td>
            <td className="px-3 py-2 text-neutral-600">{row.username ?? '—'}</td>
            <td className="px-3 py-2">
                <span className="text-neutral-700">{row.status}</span>
                {row.isLate && (
                    <span className="ms-2 rounded bg-warning-100 px-1.5 py-0.5 text-xs text-warning-700">
                        {t('tracking.late')}
                    </span>
                )}
            </td>
            {gradable && (
                <td className="px-3 py-2">
                    {row.isCorrect === true
                        ? t('tracking.correct')
                        : row.isCorrect === false
                          ? t('tracking.wrong')
                          : '—'}
                </td>
            )}
            {showAnswer && (
                <td className="max-w-xs px-3 py-2">
                    {row.textAnswer && (
                        <p className="whitespace-pre-wrap text-sm text-neutral-800">
                            {row.textAnswer}
                        </p>
                    )}
                    {(row.fileIds?.length ?? 0) > 0 && (
                        <ul className="mt-1 space-y-0.5">
                            {row.fileIds!.map((id) => (
                                <li key={id}>
                                    {/* Uploads live behind signed URLs; resolve on click
                                        rather than guessing a public path. */}
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-1 text-xs text-primary-600 underline"
                                        onClick={async () => {
                                            const url = await getPublicUrl(id);
                                            if (url) window.open(url, '_blank', 'noopener');
                                        }}
                                    >
                                        <Paperclip size={12} aria-hidden="true" />
                                        {t('tracking.openFile')}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    {!row.textAnswer && (row.fileIds?.length ?? 0) === 0 && '—'}
                </td>
            )}
            <td className="px-3 py-2 tabular-nums">{row.pointsAwarded}</td>
            <td className="px-3 py-2 tabular-nums text-neutral-500">
                {row.timeSpentMs ? `${Math.round(row.timeSpentMs / 1000)}s` : '—'}
            </td>
            <td className="px-3 py-2 text-neutral-500">
                {row.completedAt ? formatInstant(row.completedAt, i18n.language) : '—'}
            </td>
        </tr>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-neutral-200 px-4 py-2">
            <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
            <p className="text-lg font-semibold tabular-nums text-neutral-900">{value}</p>
        </div>
    );
}
