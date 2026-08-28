import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, DownloadSimple } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MoneyCell } from '@/components/design-system/money-cell';
import {
    MonthPicker,
    formatMonthValue,
    previousMonthValue,
    type MonthValue,
} from '@/components/design-system/month-picker';
import { Card, CardContent } from '@/components/ui/card';
import { useHrRole } from '@/hooks/use-hr-role';
import { reportApiError } from '@/lib/report-api-error';
import { downloadJournalCsv } from '@/routes/erp/-shared/hr-service';
import {
    HrEmptyState,
    HrErrorState,
    HrLoadingRows,
    HrNoAccessCard,
} from '@/routes/erp/people/-components/HrStates';
import { downloadBlobAsFile, monthFileStamp, useJournal } from '../-hooks/use-finance';
import { JournalEntryCard } from './JournalEntryCard';

const toAmount = (value: number | string | null | undefined): number => {
    const numeric = typeof value === 'string' ? Number(value) : (value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
};

/**
 * The month's accounting journal.
 *
 * Read-only, and deliberately so: nothing on this screen posts to the ledger.
 * Entries land here when a payroll run is approved and are reversed when that run
 * is rejected, which is why the empty state points at payroll rather than offering
 * a "create entry" button that would not exist server-side.
 *
 * Defaults to last month for the same reason payroll does — you close a month
 * after it ends, so the month you came to look at is almost never the current one.
 */
export const JournalMain = () => {
    const { isHrAdmin, isHrStaff } = useHrRole();
    const [period, setPeriod] = useState<MonthValue>(() => previousMonthValue());

    const { entries, isLoading, isError, refetch } = useJournal(period, isHrStaff);

    const totals = useMemo(() => {
        const debit = entries.reduce((sum, entry) => sum + toAmount(entry.total_debit), 0);
        const credit = entries.reduce((sum, entry) => sum + toAmount(entry.total_credit), 0);
        return { debit, credit, currency: entries[0]?.currency };
    }, [entries]);

    if (!isHrStaff) return <HrNoAccessCard />;

    const exportCsv = async () => {
        try {
            const blob = await downloadJournalCsv(period.year, period.month);
            downloadBlobAsFile(blob, `journal-${monthFileStamp(period)}.csv`);
            toast.success(`Journal for ${formatMonthValue(period)} downloaded`);
        } catch (error) {
            reportApiError(error, {
                feature: 'erp-finance',
                tags: { action: 'export-journal' },
                extra: { month: period.month, year: period.year },
                fallbackMessage: 'Could not export the journal for this month.',
            });
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <p className="max-w-3xl text-body text-muted-foreground">
                Every double-entry posting made for the month, newest first. Entries are written by
                the module they come from — approving a payroll run posts its salary journal — and
                each one must balance: total debits equal total credits.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <MonthPicker label="Period" value={period} onChange={setPeriod} disableFuture />
                {isHrAdmin && (
                    <div className="flex flex-col items-start gap-1 sm:items-end">
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            onAsyncClick={exportCsv}
                            loadingText="Preparing CSV…"
                        >
                            <DownloadSimple size={16} />
                            Export CSV
                        </MyButton>
                        <span className="text-caption text-muted-foreground">
                            Imports into Zoho Books or Tally as a journal voucher batch.
                        </span>
                    </div>
                )}
            </div>

            {isError ? (
                <HrErrorState
                    message={`Couldn't load the journal for ${formatMonthValue(period)}.`}
                    onRetry={refetch}
                />
            ) : isLoading ? (
                <HrLoadingRows rows={4} />
            ) : entries.length === 0 ? (
                <HrEmptyState
                    icon={<BookOpen size={40} className="text-muted-foreground" />}
                    title={`No journal entries for ${formatMonthValue(period)}`}
                    description="Journals are posted automatically — a payroll run writes its salary journal the moment it is APPROVED. If you expected entries here, check whether that month's run has been approved yet."
                />
            ) : (
                <div className="flex flex-col gap-3">
                    <Card>
                        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                            <span className="text-body text-muted-foreground">
                                {entries.length} {entries.length === 1 ? 'entry' : 'entries'} posted
                                in {formatMonthValue(period)}
                            </span>
                            <div className="flex items-center gap-4">
                                <span className="flex flex-col">
                                    <span className="text-caption text-muted-foreground">
                                        Total debits
                                    </span>
                                    <MoneyCell
                                        value={totals.debit}
                                        currency={totals.currency}
                                        className="text-body font-semibold text-foreground"
                                    />
                                </span>
                                <span className="flex flex-col">
                                    <span className="text-caption text-muted-foreground">
                                        Total credits
                                    </span>
                                    <MoneyCell
                                        value={totals.credit}
                                        currency={totals.currency}
                                        className="text-body font-semibold text-foreground"
                                    />
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {entries.map((entry, index) => (
                        <JournalEntryCard
                            key={entry.id ?? `${entry.reference ?? 'entry'}-${index}`}
                            entry={entry}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
