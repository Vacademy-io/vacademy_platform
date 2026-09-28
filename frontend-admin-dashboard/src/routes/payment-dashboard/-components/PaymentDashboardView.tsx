import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
    ArrowRight,
    CheckCircle,
    DownloadSimple,
    Lightning,
    TrendUp,
    Warning,
    WarningCircle,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MyButton } from '@/components/design-system/button';
import { SearchableSelect } from '@/components/design-system/searchable-select';
import { cn } from '@/lib/utils';
import { getBrowserTimezoneOrUndefined } from '@/utils/timezone';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { fetchPaymentDashboard, type PaymentDashboard } from '@/services/payment-dashboard';
import { DateRangeDropdown } from '@/routes/manage-payments/-components/DateRangeDropdown';
import {
    rangeToLocalIsoWindow,
    resolvePreset,
    type DateRangeValue,
} from '@/routes/manage-payments/-utils/dateRange';
import {
    exportEntriesToCsv,
    fetchAllPaymentLogs,
} from '@/routes/manage-payments/-utils/exportPaymentLogsCsv';
import {
    AGEING_LABELS,
    AGEING_ORDER,
    DASHBOARD_PERIODS,
    SOURCE_LABELS,
    buildHighlights,
    collectionRate,
    formatCompact,
    percentChange,
    resolveDashboardPeriod,
    toApiDateTime,
    toMethodSlices,
    type CourseRow,
    type DashboardPeriodKey,
    type Highlight,
} from '../-utils/dashboardMath';
import { BarList, DeltaPill, KpiTile, SectionCard } from './DashboardParts';
import { CollectionCalendar, ForecastChart, RevenueByMonth, YearChart } from './DashboardCharts';
import { BatchesTable, CoursesTable } from './DashboardTables';

const ALL = '__all__';
/** Matches no batch — see packageSessionIds. */
const NO_BATCH = '__none__';

/** "1 Apr – 28 Sep 2026" from the API's UTC date-times, shown in the admin's own zone. */
const formatWindow = (start: string | null, end: string | null): string => {
    if (!end) return '';
    const fmt = (s: string, withYear: boolean) =>
        new Date(`${s}Z`).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            ...(withYear ? { year: 'numeric' } : {}),
        });
    if (!start) return `All time to ${fmt(end, true)}`;
    const sameYear = start.slice(0, 4) === end.slice(0, 4);
    return `${fmt(start, !sameYear)} – ${fmt(end, true)}`;
};

const PERIOD_TABS: { key: DashboardPeriodKey; label: string }[] = [
    ...DASHBOARD_PERIODS,
    { key: 'custom', label: 'Custom' },
];

const HIGHLIGHT_STYLES: Record<Highlight['tone'], { icon: typeof TrendUp; className: string }> = {
    brand: { icon: TrendUp, className: 'bg-primary-50 text-primary-500' },
    info: { icon: Lightning, className: 'bg-info-50 text-info-600' },
    danger: { icon: Warning, className: 'bg-danger-50 text-danger-600' },
    success: { icon: CheckCircle, className: 'bg-success-50 text-success-600' },
};

export function PaymentDashboardView() {
    const navigate = useNavigate();
    const instituteDetails = useInstituteDetailsStore((s) => s.instituteDetails);
    const courseTerm = getTerminology(ContentTerms.Course, SystemTerms.Course);
    const batchTerm = getTerminology(ContentTerms.Batch, SystemTerms.Batch);

    const [period, setPeriod] = useState<DashboardPeriodKey>('fy');
    const [customRange, setCustomRange] = useState<DateRangeValue>(() => resolvePreset('30d'));
    const [courseId, setCourseId] = useState<string>(ALL);
    const [batchId, setBatchId] = useState<string>(ALL);
    // A course picked from the Courses table can be one the institute list does not carry (an
    // inactive batch, a faculty-limited list). Its batches come from the dashboard data instead.
    const [pickedCourse, setPickedCourse] = useState<CourseRow | null>(null);
    const [exporting, setExporting] = useState(false);

    // The window is fixed when the period is picked, so the query key does not tick with the clock.
    const window = useMemo(() => {
        if (period === 'custom') return rangeToLocalIsoWindow(customRange);
        const r = resolveDashboardPeriod(period);
        return { start: r.start ? toApiDateTime(r.start) : undefined, end: toApiDateTime(r.end) };
    }, [period, customRange]);

    const batches = useMemo(() => instituteDetails?.batches_for_sessions ?? [], [instituteDetails]);
    const courseOptions = useMemo(() => {
        const seen = new Map<string, string>();
        for (const b of batches) {
            if (b.package_dto?.id && !seen.has(b.package_dto.id)) {
                seen.set(b.package_dto.id, b.package_dto.package_name || 'Untitled');
            }
        }
        if (pickedCourse && !seen.has(pickedCourse.key))
            seen.set(pickedCourse.key, pickedCourse.name);
        return [
            { value: ALL, label: `All ${courseTerm.toLowerCase()}s` },
            ...[...seen.entries()]
                .map(([value, label]) => ({ value, label }))
                .sort((a, b) => a.label.localeCompare(b.label)),
        ];
    }, [batches, courseTerm, pickedCourse]);
    const courseBatches = useMemo(() => {
        if (courseId === ALL) return [];
        const out = new Map<string, string>();
        for (const b of batches) {
            if (b.package_dto?.id !== courseId) continue;
            out.set(
                b.id,
                [b.level?.level_name, b.session?.session_name].filter(Boolean).join(' · ')
            );
        }
        if (pickedCourse?.key === courseId) {
            for (const b of pickedCourse.batches) if (!out.has(b.id)) out.set(b.id, b.label);
        }
        return [...out.entries()].map(([value, label]) => ({ value, label: label || batchTerm }));
    }, [batches, batchTerm, courseId, pickedCourse]);
    const batchOptions = useMemo(
        () => [
            { value: ALL, label: `All ${batchTerm.toLowerCase()}es` },
            ...(courseId === ALL
                ? batches.map((b) => ({
                      value: b.id,
                      label: [
                          b.package_dto?.package_name,
                          b.level?.level_name,
                          b.session?.session_name,
                      ]
                          .filter(Boolean)
                          .join(' · '),
                  }))
                : courseBatches
            ).sort((a, b) => a.label.localeCompare(b.label)),
        ],
        [batches, batchTerm, courseId, courseBatches]
    );
    const packageSessionIds = useMemo(() => {
        if (batchId !== ALL) return [batchId];
        if (courseId === ALL) return undefined;
        const ids = courseBatches.map((b) => b.value);
        // An empty list means "no filter" to the API; a chosen course with no batches must show
        // nothing rather than the whole institute.
        return ids.length > 0 ? ids : [NO_BATCH];
    }, [batchId, courseId, courseBatches]);

    const request = useMemo(
        () => ({
            start_date_in_utc: window.start,
            end_date_in_utc: window.end,
            package_session_ids: packageSessionIds,
            // Normalised: some browsers report Asia/Calcutta, which Postgres rejects.
            time_zone: getBrowserTimezoneOrUndefined(),
        }),
        [window, packageSessionIds]
    );

    const { data, isLoading, isError, isFetching, refetch } = useQuery<PaymentDashboard>({
        queryKey: ['payment-dashboard', request],
        queryFn: () => fetchPaymentDashboard(request),
        staleTime: 60_000,
        // Balances change on Manage Payments (a payment recorded, a due date moved), so coming back
        // here asks again rather than showing the copy cached before the change.
        refetchOnMount: 'always',
        placeholderData: keepPreviousData,
        retry: false,
    });

    const handleExport = async () => {
        setExporting(true);
        try {
            const { entries } = await fetchAllPaymentLogs({
                sort_columns: { createdAt: 'DESC' },
                ...(window.start ? { start_date_in_utc: window.start } : {}),
                ...(window.end ? { end_date_in_utc: window.end } : {}),
                ...(packageSessionIds ? { package_session_ids: packageSessionIds } : {}),
            });
            if (entries.length === 0) {
                toast.info('No payment records to export for this period.');
                return;
            }
            const count = exportEntriesToCsv(entries, instituteDetails?.institute_name);
            toast.success(`Exported ${count.toLocaleString()} payment records.`);
        } catch (error) {
            console.error('Failed to export payment logs:', error);
            toast.error('Failed to export payment records. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    const selectCourse = (id: string) => {
        setCourseId(id);
        setBatchId(ALL);
    };
    const selectCourseRow = (course: CourseRow) => {
        setPickedCourse(course);
        selectCourse(course.key);
    };

    return (
        <div className="space-y-5">
            {/* Header: what the page covers, and the period that governs every flow figure */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h2 className="text-h3 font-semibold text-neutral-900">Payment overview</h2>
                    <p className="mt-0.5 text-body text-neutral-500">
                        {data ? (
                            <>
                                {formatWindow(data.period_start, data.period_end)}
                                {data.previous_start && data.previous_end && (
                                    <>
                                        {' '}
                                        · compared with{' '}
                                        {formatWindow(data.previous_start, data.previous_end)}
                                    </>
                                )}
                            </>
                        ) : (
                            'Money collected, still owed and on its way'
                        )}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div
                        className="flex rounded-lg border border-neutral-200 bg-white p-0.5"
                        role="tablist"
                    >
                        {PERIOD_TABS.map((p) => (
                            <button
                                key={p.key}
                                type="button"
                                role="tab"
                                aria-selected={period === p.key}
                                onClick={() => setPeriod(p.key)}
                                className={cn(
                                    'rounded-md px-3 py-1.5 text-caption font-medium transition-colors',
                                    period === p.key
                                        ? 'bg-primary-500 text-white'
                                        : 'text-neutral-600 hover:bg-neutral-100'
                                )}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    {/* Only a custom period has dates to pick; the presets are the tabs themselves. */}
                    {period === 'custom' && (
                        <DateRangeDropdown
                            value={customRange}
                            align="end"
                            onChange={setCustomRange}
                        />
                    )}
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        className="gap-2"
                        onClick={handleExport}
                        disable={exporting}
                    >
                        <DownloadSimple size={16} />
                        {exporting ? 'Exporting…' : 'Export'}
                    </MyButton>
                </div>
            </div>

            {/* Filters: a course or batch narrows every figure on the page */}
            <div className="flex flex-wrap items-center gap-2">
                <SearchableSelect
                    options={courseOptions}
                    value={courseId}
                    onChange={(v) => selectCourse(v || ALL)}
                    placeholder={`All ${courseTerm.toLowerCase()}s`}
                    searchPlaceholder={`Search ${courseTerm.toLowerCase()}`}
                    className="w-full sm:w-64"
                />
                <SearchableSelect
                    options={batchOptions}
                    value={batchId}
                    onChange={(v) => setBatchId(v || ALL)}
                    placeholder={`All ${batchTerm.toLowerCase()}es`}
                    searchPlaceholder={`Search ${batchTerm.toLowerCase()}`}
                    className="w-full sm:w-72"
                />
                {(courseId !== ALL || batchId !== ALL) && (
                    <MyButton buttonType="text" scale="small" onClick={() => selectCourse(ALL)}>
                        Clear
                    </MyButton>
                )}
                {isFetching && !isLoading && (
                    <span className="text-caption text-neutral-400">Updating…</span>
                )}
            </div>

            {isLoading ? (
                <DashboardSkeleton />
            ) : isError || !data ? (
                <Card className="flex flex-col items-center gap-3 rounded-xl border-neutral-200 p-10 text-center">
                    <WarningCircle size={32} className="text-danger-500" />
                    <div>
                        <p className="text-subtitle font-semibold text-neutral-800">
                            The dashboard could not be loaded
                        </p>
                        <p className="text-body text-neutral-500">
                            Check your connection and try again.
                        </p>
                    </div>
                    <MyButton buttonType="secondary" scale="medium" onClick={() => refetch()}>
                        Try again
                    </MyButton>
                </Card>
            ) : data.kpis.collected_all_time <= 0 &&
              data.kpis.outstanding <= 0 &&
              data.kpis.still_to_come <= 0 ? (
                <Card className="flex flex-col items-center gap-2 rounded-xl border-neutral-200 p-10 text-center">
                    <TrendUp size={32} className="text-neutral-400" />
                    <p className="text-subtitle font-semibold text-neutral-800">No payments yet</p>
                    <p className="max-w-md text-body text-neutral-500">
                        {packageSessionIds
                            ? `No money has been collected or billed for this ${courseTerm.toLowerCase()} or ${batchTerm.toLowerCase()} yet.`
                            : 'Once learners start paying, their payments, dues and trends will appear here.'}
                    </p>
                </Card>
            ) : (
                <DashboardBody
                    data={data}
                    courseTerm={courseTerm}
                    batchTerm={batchTerm}
                    onSelectCourse={selectCourseRow}
                    onOpenManagePayments={() => navigate({ to: '/manage-payments' })}
                />
            )}
        </div>
    );
}

function DashboardBody({
    data,
    courseTerm,
    batchTerm,
    onSelectCourse,
    onOpenManagePayments,
}: {
    data: PaymentDashboard;
    courseTerm: string;
    batchTerm: string;
    onSelectCourse: (course: CourseRow) => void;
    onOpenManagePayments: () => void;
}) {
    const k = data.kpis;
    const cur = data.currency;
    const compared = k.previous_collected !== null;
    const last12 = data.months.slice(-12);
    const rate = collectionRate(k.collected_all_time, k.outstanding);
    const highlights = useMemo(() => buildHighlights(data), [data]);
    const methods = useMemo(() => toMethodSlices(data.methods), [data.methods]);
    const ageing = useMemo(
        () =>
            AGEING_ORDER.map((key) => data.ageing.find((a) => a.bucket === key))
                .filter((a): a is NonNullable<typeof a> => !!a && a.amount > 0)
                .map((a) => ({
                    key: a.bucket,
                    label: AGEING_LABELS[a.bucket] ?? a.bucket,
                    value: a.amount,
                    detail: `${a.learners} learner${a.learners === 1 ? '' : 's'}`,
                    barClassName: a.bucket === 'D0_30' ? 'bg-warning-400' : 'bg-danger-500',
                })),
        [data.ageing]
    );
    const comparedCaption = compared ? 'vs the same period a year earlier' : 'All time';

    return (
        <div className="space-y-5">
            {/* KPI row: three flows for the period, three balances as of today */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
                <KpiTile
                    label="Collected"
                    info="Money received in the selected period from successful payments. Failed or abandoned payment attempts are not counted."
                    value={formatCompact(k.collected, cur)}
                    delta={<DeltaPill change={percentChange(k.collected, k.previous_collected)} />}
                    caption={`${k.payments.toLocaleString('en-IN')} payments · ${comparedCaption}`}
                    trend={last12.map((m) => m.collected)}
                />
                <KpiTile
                    label="Paying learners"
                    info="Distinct learners who made at least one successful payment in the selected period."
                    value={k.paying_learners.toLocaleString('en-IN')}
                    delta={
                        <DeltaPill
                            change={percentChange(k.paying_learners, k.previous_paying_learners)}
                        />
                    }
                    caption={comparedCaption}
                    trend={last12.map((m) => m.payers)}
                />
                <KpiTile
                    label="New paying learners"
                    info="Learners whose first ever payment to your institute was in the selected period."
                    value={k.new_paying_learners.toLocaleString('en-IN')}
                    delta={
                        <DeltaPill
                            change={percentChange(
                                k.new_paying_learners,
                                k.previous_new_paying_learners
                            )}
                        />
                    }
                    caption={comparedCaption}
                    trend={last12.map((m) => m.new_payers ?? 0)}
                />
                <KpiTile
                    label="Overdue"
                    info="Instalments, renewals and invoices whose due date has passed and are still unpaid, on every active enrolment. This is as of today and does not change with the period."
                    value={formatCompact(k.overdue, cur)}
                    caption={`${k.learners_overdue.toLocaleString('en-IN')} learner${k.learners_overdue === 1 ? '' : 's'} · as of today`}
                />
                <KpiTile
                    label={`Due in next ${k.upcoming_days} days`}
                    info={`Unpaid instalments, renewals and invoices falling due within the next ${k.upcoming_days} days. As of today.`}
                    value={formatCompact(k.due_soon, cur)}
                    caption={`${k.learners_due_soon.toLocaleString('en-IN')} learner${k.learners_due_soon === 1 ? '' : 's'} · as of today`}
                />
                <KpiTile
                    label="Collection rate"
                    info="Share of the fee on your enrolments that has been collected: everything collected so far, divided by that plus what is still owed (overdue amounts and unpaid instalments and invoices). Subscription renewals that have not fallen due yet are not counted."
                    value={rate === null ? '—' : `${rate.toFixed(1)}%`}
                    caption={`${formatCompact(k.outstanding, cur)} still owed in total`}
                />
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                <SectionCard
                    className="xl:col-span-2"
                    title="Revenue by month"
                    info="Money collected each month over the last 12 months, with the same month a year earlier as a line for comparison. Switch the tab to see paying learners or new paying learners instead."
                    subtitle="Last 12 months, with the same month a year earlier"
                >
                    <RevenueByMonth months={data.months} currency={cur} />
                </SectionCard>
                <SectionCard
                    title="Highlights"
                    info="Short takeaways worked out from the figures on this page."
                    subtitle="What stands out right now"
                >
                    {highlights.length === 0 ? (
                        <p className="py-6 text-center text-caption text-neutral-500">
                            Nothing stands out yet.
                        </p>
                    ) : (
                        <ul className="space-y-3">
                            {highlights.map((h) => {
                                const style = HIGHLIGHT_STYLES[h.tone];
                                const Icon = style.icon;
                                return (
                                    <li key={h.text} className="flex gap-3">
                                        <span
                                            className={cn(
                                                'flex size-8 shrink-0 items-center justify-center rounded-lg',
                                                style.className
                                            )}
                                        >
                                            <Icon size={16} weight="bold" />
                                        </span>
                                        <p className="text-body text-neutral-700">{h.text}</p>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </SectionCard>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                <SectionCard
                    className="xl:col-span-2"
                    title={`${courseTerm}s`}
                    info={`Money collected in the selected period for each ${courseTerm.toLowerCase()}, with what is overdue and still to come on its active enrolments. When one payment covers several ${batchTerm.toLowerCase()}es, it is split evenly between them.`}
                    subtitle={`Collected, overdue and still to come · click a ${courseTerm.toLowerCase()} to filter the page`}
                >
                    <CoursesTable
                        batches={data.batches}
                        currency={cur}
                        courseTerm={courseTerm}
                        onSelectCourse={onSelectCourse}
                    />
                </SectionCard>
                <SectionCard
                    title="Cash-flow forecast"
                    info="Unpaid instalments, invoices and renewals on active enrolments, grouped by the month they fall due. Overdue amounts are not included here."
                    subtitle="Instalments and renewals falling due"
                    action={
                        <MyButton
                            buttonType="text"
                            scale="small"
                            className="gap-1"
                            onClick={onOpenManagePayments}
                        >
                            See learners <ArrowRight size={14} />
                        </MyButton>
                    }
                >
                    <ForecastChart months={data.forecast} currency={cur} />
                </SectionCard>
            </div>

            <SectionCard
                title={`${batchTerm}es`}
                info={`Every ${batchTerm.toLowerCase()} with a payment in the period or money still owed, sorted by the money still to collect.`}
                subtitle="Sorted by money still to collect"
            >
                <BatchesTable
                    batches={data.batches}
                    currency={cur}
                    courseTerm={courseTerm}
                    batchTerm={batchTerm}
                />
            </SectionCard>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <SectionCard
                    title="Revenue by source"
                    info="Where the money in the selected period came from: online checkout (payment links, catalogue and invite pages), live class registration, payments recorded manually by an admin, or a sub-organisation."
                    subtitle="How learners enrolled and paid"
                >
                    <BarList
                        rows={data.sources.map((s) => ({
                            key: s.key ?? 'OTHER',
                            label: SOURCE_LABELS[s.key ?? ''] ?? 'Other',
                            value: s.amount,
                            detail: `${s.payments.toLocaleString('en-IN')} payment${s.payments === 1 ? '' : 's'}`,
                        }))}
                        formatValue={(v) => formatCompact(v, cur)}
                        emptyText="No payments in this period."
                    />
                </SectionCard>
                <SectionCard
                    title="Payment methods"
                    info="How the money in the selected period was paid: the payment gateway, or offline when an admin recorded the payment."
                    subtitle="How the money was paid"
                >
                    <BarList
                        rows={methods.map((m) => ({
                            key: m.label,
                            label: m.label,
                            value: m.amount,
                            detail: `${m.payments.toLocaleString('en-IN')} payment${m.payments === 1 ? '' : 's'}`,
                        }))}
                        formatValue={(v) => formatCompact(v, cur)}
                        barClassName="bg-info-500"
                        emptyText="No payments in this period."
                    />
                </SectionCard>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <SectionCard
                    title="Year over year"
                    info="Money collected in each financial year (April to March)."
                    subtitle="Collected per financial year"
                >
                    <YearChart years={data.years} currency={cur} />
                </SectionCard>
                <SectionCard
                    title="Overdue ageing"
                    info="Overdue money grouped by how long ago it fell due. The older the balance, the harder it usually is to collect."
                    subtitle={
                        k.overdue > 0
                            ? `${formatCompact(k.overdue, cur)} overdue from ${k.learners_overdue} learner${k.learners_overdue === 1 ? '' : 's'}`
                            : 'Nothing is overdue'
                    }
                    action={
                        k.overdue > 0 ? (
                            <MyButton
                                buttonType="text"
                                scale="small"
                                className="gap-1"
                                onClick={onOpenManagePayments}
                            >
                                Follow up <ArrowRight size={14} />
                            </MyButton>
                        ) : undefined
                    }
                >
                    <BarList
                        rows={ageing}
                        formatValue={(v) => formatCompact(v, cur)}
                        emptyText="Nothing is overdue right now."
                    />
                </SectionCard>
            </div>

            <SectionCard
                title="Collection calendar"
                info="Money received on each day over the last 26 weeks. Darker squares are days with more money in."
                subtitle="Money received per day, last 26 weeks"
            >
                <CollectionCalendar days={data.days} currency={cur} />
            </SectionCard>
        </div>
    );
}

function DashboardSkeleton() {
    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-36 rounded-xl" />
                ))}
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                <Skeleton className="h-96 rounded-xl xl:col-span-2" />
                <Skeleton className="h-96 rounded-xl" />
            </div>
            <Skeleton className="h-72 rounded-xl" />
        </div>
    );
}
