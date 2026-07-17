/**
 * Translation review screen (Phase 1 i18n).
 *
 * Reads the sidecar rows a translation job wrote (admin-core
 * /translations/v1/items + /status) and lets a reviewer approve (-> PUBLISHED,
 * learner-visible) or reject (-> DRAFT) each one. When the screen is opened
 * from a DRAFT-mode job it also polls the ai-service job and exposes
 * "Approve & publish" while the job is parked at REVIEW/AWAITING_INPUT.
 *
 * Base and translated content are author-supplied HTML, so both are rendered
 * through DOMPurify — never injected raw.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, CheckCircle, Translate, XCircle } from '@phosphor-icons/react';

import { MyButton } from '@/components/design-system/button';
import { MyTable } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { LOCALE_LABELS, isSupportedLocale } from '@/i18n/locales';
import {
    useApproveTranslationJobMutation,
    useTranslationItemsQuery,
    useTranslationJobQuery,
    useTranslationStatusQuery,
    useUpdateTranslationItemStateMutation,
    type TranslationItemState,
    type TranslationReviewItem,
} from '@/services/translation/translation-services';
import { Route } from '..';

const PAGE_SIZE = 20;

const REVIEW_STATES: TranslationItemState[] = ['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'STALE'];

/** Sidecar state -> token classes. PUBLISHED/STALE are the learner-visible pair. */
const STATE_CLASSES: Record<TranslationItemState, string> = {
    DRAFT: 'bg-neutral-100 text-neutral-700',
    IN_REVIEW: 'bg-warning-50 text-warning-700',
    PUBLISHED: 'bg-success-50 text-success-700',
    STALE: 'bg-danger-50 text-danger-700',
};

function StateBadge({ state }: { state: TranslationItemState }) {
    const { t } = useTranslation();
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-md px-2 py-0.5 text-caption font-medium',
                STATE_CLASSES[state] ?? STATE_CLASSES.DRAFT
            )}
        >
            {t(`translation.state.${state}`)}
        </span>
    );
}

/** Author HTML — sanitized before render, matching the app's other HTML previews. */
function ContentPreview({ html, dir }: { html?: string; dir?: 'ltr' | 'rtl' }) {
    const { t } = useTranslation();
    if (!html) {
        return <span className="text-caption text-neutral-400">{t('translation.noContent')}</span>;
    }
    return (
        <div
            dir={dir}
            className="max-h-32 overflow-y-auto text-body text-neutral-800"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
        />
    );
}

export function TranslationReviewPage() {
    const { t } = useTranslation();
    const navigate = Route.useNavigate();
    const { courseId, packageSessionId, locale, jobId } = Route.useSearch();

    const [page, setPage] = useState(0);
    const [stateFilter, setStateFilter] = useState<string>('');

    const jobQuery = useTranslationJobQuery(jobId);
    const statusQuery = useTranslationStatusQuery(packageSessionId, locale);
    const itemsQuery = useTranslationItemsQuery({
        packageSessionId,
        locale,
        state: stateFilter,
        page,
        size: PAGE_SIZE,
    });
    const updateState = useUpdateTranslationItemStateMutation();
    const approveJob = useApproveTranslationJobMutation();

    const localeLabel = locale && isSupportedLocale(locale) ? LOCALE_LABELS[locale] : locale ?? '';
    // Only the target column is written in the target language.
    const targetDir = locale === 'ar' ? 'rtl' : 'ltr';

    const setItemState = (item: TranslationReviewItem, next: TranslationItemState) => {
        if (!packageSessionId) return;
        updateState.mutate(
            { table: item.table, id: item.id, state: next, packageSessionId },
            {
                onSuccess: () =>
                    toast.success(
                        next === 'PUBLISHED'
                            ? t('translation.review.approved')
                            : t('translation.review.rejected')
                    ),
                onError: () => toast.error(t('translation.review.updateFailed')),
            }
        );
    };

    const columns: ColumnDef<TranslationReviewItem>[] = useMemo(
        () => [
            {
                id: 'baseContent',
                header: t('translation.review.baseContent'),
                cell: ({ row }) => <ContentPreview html={row.original.base_content} />,
            },
            {
                id: 'translatedContent',
                header: t('translation.review.translatedContent', { language: localeLabel }),
                cell: ({ row }) => (
                    <ContentPreview html={row.original.translated_content} dir={targetDir} />
                ),
            },
            {
                id: 'state',
                header: t('translation.review.state'),
                cell: ({ row }) => <StateBadge state={row.original.state} />,
            },
            {
                id: 'actions',
                header: t('translation.review.actions'),
                cell: ({ row }) => (
                    <div className="flex items-center gap-2">
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="small"
                            disable={updateState.isPending || row.original.state === 'PUBLISHED'}
                            onClick={() => setItemState(row.original, 'PUBLISHED')}
                        >
                            <CheckCircle size={14} className="text-success-600" />
                            {t('translation.review.approve')}
                        </MyButton>
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="small"
                            disable={updateState.isPending || row.original.state === 'DRAFT'}
                            onClick={() => setItemState(row.original, 'DRAFT')}
                        >
                            <XCircle size={14} className="text-danger-600" />
                            {t('translation.review.reject')}
                        </MyButton>
                    </div>
                ),
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, localeLabel, targetDir, updateState.isPending, packageSessionId]
    );

    const items = itemsQuery.data?.items ?? [];

    const approvablePageItems = items.filter((item) => item.state !== 'PUBLISHED');

    const handleBulkApprove = async () => {
        if (!packageSessionId || approvablePageItems.length === 0) return;
        try {
            // Sequential: the coverage counter is updated per row server-side.
            for (const item of approvablePageItems) {
                await updateState.mutateAsync({
                    table: item.table,
                    id: item.id,
                    state: 'PUBLISHED',
                    packageSessionId,
                });
            }
            toast.success(
                t('translation.review.bulkApproved', { value: approvablePageItems.length })
            );
        } catch {
            toast.error(t('translation.review.updateFailed'));
        }
    };

    const job = jobQuery.data;
    const jobAwaitingReview = job?.status === 'AWAITING_INPUT' && job?.current_stage === 'REVIEW';

    const handleApproveJob = () => {
        if (!jobId) return;
        approveJob.mutate(jobId, {
            onSuccess: () => toast.success(t('translation.review.jobApproved')),
            onError: () => toast.error(t('translation.review.jobApproveFailed')),
        });
    };

    const counts = statusQuery.data?.counts_by_state ?? {};

    // Guard: the screen is meaningless without a scope.
    if (!packageSessionId || !locale) {
        return (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
                <Translate size={32} className="text-neutral-400" />
                <p className="text-body text-neutral-600">{t('translation.review.missingScope')}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    {courseId && (
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            layoutVariant="icon"
                            scale="small"
                            aria-label={t('translation.review.back')}
                            onClick={() =>
                                navigate({
                                    to: '/study-library/courses/course-details',
                                    search: { courseId },
                                })
                            }
                        >
                            <ArrowLeft size={16} />
                        </MyButton>
                    )}
                    <div className="flex flex-col">
                        <h1 className="text-h3 font-semibold text-neutral-800">
                            {t('translation.review.heading')}
                        </h1>
                        <p className="text-caption text-neutral-500">
                            {t('translation.review.subheading', { language: localeLabel })}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {jobAwaitingReview && (
                        <MyButton
                            type="button"
                            buttonType="primary"
                            scale="medium"
                            disable={approveJob.isPending}
                            onClick={handleApproveJob}
                        >
                            {t('translation.review.approveAndPublishJob')}
                        </MyButton>
                    )}
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="medium"
                        disable={updateState.isPending || approvablePageItems.length === 0}
                        onClick={handleBulkApprove}
                    >
                        {t('translation.review.approvePage')}
                    </MyButton>
                </div>
            </div>

            {/* Job progress — only when the screen was opened from a job. */}
            {jobId && job && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-4">
                    <div className="flex flex-col">
                        <span className="text-caption text-neutral-500">
                            {t('translation.review.jobStatus')}
                        </span>
                        <span className="text-body font-medium text-neutral-800">
                            {t(`translation.jobStatus.${job.status}`)}
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-caption text-neutral-500">
                            {t('translation.review.jobStage')}
                        </span>
                        <span className="text-body font-medium text-neutral-800">
                            {t(`translation.jobStage.${job.current_stage}`)}
                        </span>
                    </div>
                    {job.items_total != null && (
                        <div className="flex flex-col">
                            <span className="text-caption text-neutral-500">
                                {t('translation.review.jobProgress')}
                            </span>
                            <span className="text-body font-medium text-neutral-800">
                                {job.items_done ?? 0} / {job.items_total}
                            </span>
                        </div>
                    )}
                    {job.error_message && (
                        <p className="text-caption text-danger-600">{job.error_message}</p>
                    )}
                </div>
            )}

            {/* Status counts + state filter */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    {REVIEW_STATES.map((state) => (
                        <span
                            key={state}
                            className={cn(
                                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-caption font-medium',
                                STATE_CLASSES[state]
                            )}
                        >
                            {t(`translation.state.${state}`)}
                            <span className="font-semibold">{counts[state] ?? 0}</span>
                        </span>
                    ))}
                </div>
                <Select
                    value={stateFilter || 'ALL'}
                    onValueChange={(value) => {
                        setStateFilter(value === 'ALL' ? '' : value);
                        setPage(0);
                    }}
                >
                    <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder={t('translation.review.filterAll')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">{t('translation.review.filterAll')}</SelectItem>
                        {REVIEW_STATES.map((state) => (
                            <SelectItem key={state} value={state}>
                                {t(`translation.state.${state}`)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {!itemsQuery.isLoading && !itemsQuery.error && items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-16 text-center">
                    <Translate size={32} className="text-neutral-400" />
                    <p className="text-body text-neutral-600">{t('translation.review.empty')}</p>
                </div>
            ) : (
                <>
                    <MyTable<TranslationReviewItem>
                        data={{
                            content: items,
                            total_pages: itemsQuery.data?.total_pages ?? 0,
                            page_no: itemsQuery.data?.page ?? 0,
                            page_size: itemsQuery.data?.size ?? PAGE_SIZE,
                            total_elements: itemsQuery.data?.total_elements ?? 0,
                            last:
                                (itemsQuery.data?.page ?? 0) + 1 >=
                                (itemsQuery.data?.total_pages ?? 0),
                        }}
                        columns={columns}
                        isLoading={itemsQuery.isLoading}
                        error={itemsQuery.error}
                        currentPage={page}
                        scrollable
                    />
                    {(itemsQuery.data?.total_pages ?? 0) > 1 && (
                        <MyPagination
                            currentPage={page}
                            totalPages={itemsQuery.data?.total_pages ?? 0}
                            onPageChange={setPage}
                        />
                    )}
                </>
            )}
        </div>
    );
}
