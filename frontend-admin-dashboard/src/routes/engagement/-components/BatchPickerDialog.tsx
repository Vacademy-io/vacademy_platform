import { useEffect, useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlass, CaretLeft, CaretRight } from '@phosphor-icons/react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { MyButton } from '@/components/design-system/button';
import { fetchPaginatedBatches } from '@/routes/admin-package-management/-services/package-service';
import type { PackageSessionDTO } from '@/routes/admin-package-management/-types/package-types';

const PAGE_SIZE = 10;

export interface BatchOption {
    id: string;
    label: string;
}

export function batchLabel(b: PackageSessionDTO): string {
    const course = b.package_dto?.package_name ?? 'Course';
    const level = b.level?.level_name;
    return b.name ?? (level ? `${course} · ${level}` : course);
}

/**
 * Pick one or more batches.
 *
 * Search and paging are done by the SERVER, not by filtering a fetched array: an
 * institute can have hundreds of batches, and the earlier dropdown loaded 100 and
 * silently hid the rest. Selections are kept across pages and searches, so choosing
 * a batch on page 1 and another on page 4 works.
 */
export function BatchPickerDialog({
    open,
    onOpenChange,
    selected,
    onConfirm,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selected: BatchOption[];
    onConfirm: (next: BatchOption[]) => void;
}) {
    const [search, setSearch] = useState('');
    const [debounced, setDebounced] = useState('');
    const [page, setPage] = useState(0);
    const { t } = useTranslation('engagement');
    const [draft, setDraft] = useState<BatchOption[]>(selected);

    // Re-seed the draft each time the dialog opens so Cancel truly discards.
    useEffect(() => {
        if (open) {
            setDraft(selected);
            setSearch('');
            setDebounced('');
            setPage(0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebounced(search.trim());
            setPage(0);
        }, 300);
        return () => window.clearTimeout(timer);
    }, [search]);

    const { data, isFetching } = useQuery({
        queryKey: ['engagement-batch-picker', debounced, page],
        queryFn: () =>
            fetchPaginatedBatches({
                page,
                size: PAGE_SIZE,
                statuses: ['ACTIVE'],
                ...(debounced ? { search: debounced } : {}),
            }),
        enabled: open,
        placeholderData: keepPreviousData,
    });

    const rows = data?.content ?? [];
    // The batches DTO is snake_case; total_pages, not totalPages.
    const totalPages = data?.total_pages ?? 1;
    const selectedIds = useMemo(() => new Set(draft.map((b) => b.id)), [draft]);

    function toggle(batch: PackageSessionDTO) {
        const id = batch.id;
        setDraft((prev) =>
            prev.some((b) => b.id === id)
                ? prev.filter((b) => b.id !== id)
                : [...prev, { id, label: batchLabel(batch) }]
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-screen w-full overflow-hidden sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="text-start">{t('batchPicker.title')}</DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                    <div className="relative">
                        <MagnifyingGlass
                            size={16}
                            className="absolute start-3 top-1/2 -translate-y-1/2 text-neutral-400"
                        />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('batchPicker.search')}
                            className="ps-9"
                        />
                    </div>

                    {draft.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {draft.map((b) => (
                                <button
                                    key={b.id}
                                    type="button"
                                    onClick={() =>
                                        setDraft((prev) => prev.filter((x) => x.id !== b.id))
                                    }
                                    className="rounded-md bg-primary-50 px-2 py-1 text-xs text-primary-700 hover:bg-primary-100"
                                    title={t('batchPicker.remove')}
                                >
                                    {b.label} ✕
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="max-h-80 divide-y divide-neutral-100 overflow-y-auto rounded-md border border-neutral-200">
                        {rows.length === 0 && !isFetching && (
                            <p className="p-6 text-center text-sm text-neutral-500">
                                {t('batchPicker.noMatch')}
                            </p>
                        )}
                        {rows.map((batch) => (
                            <label
                                key={batch.id}
                                className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-neutral-50"
                            >
                                <Checkbox
                                    checked={selectedIds.has(batch.id)}
                                    onCheckedChange={() => toggle(batch)}
                                />
                                <span className="min-w-0 flex-1 truncate text-neutral-800">
                                    {batchLabel(batch)}
                                </span>
                            </label>
                        ))}
                    </div>

                    <div className="flex items-center justify-between text-sm text-neutral-500">
                        <span>
                            {t('batchPicker.selected', { count: draft.length })}
                            {isFetching ? ` · ${t('batchPicker.loading')}` : ''}
                        </span>
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
                                {page + 1} / {Math.max(1, totalPages)}
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
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        {t('batchPicker.cancel')}
                    </Button>
                    <MyButton
                        type="button"
                        onClick={() => {
                            onConfirm(draft);
                            onOpenChange(false);
                        }}
                    >
                        {t('batchPicker.use', { count: draft.length })}
                    </MyButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
