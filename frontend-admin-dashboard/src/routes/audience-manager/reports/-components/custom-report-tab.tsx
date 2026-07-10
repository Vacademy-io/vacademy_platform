/**
 * Reports Center — Custom Report Builder tab.
 *
 * Self-serve report builder over a curated semantic model. The user picks dimensions (group-by),
 * measures (aggregates) and filters from the server's catalog (GET /custom/catalog), then runs the
 * spec (POST /custom/run). No SQL ever leaves the browser — only whitelisted field keys. The page
 * date range + team/counsellor scope from the shared filter bar are applied to every run.
 */
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowClockwise, FunnelSimple, Play, Table as TableIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    customCatalogQueryKey,
    fetchCustomCatalog,
    runCustomReport,
    type CustomReportFilter,
} from '../-services/get-custom-report';
import {
    EmptyHint,
    ExportWithColumnPickerButton,
    ReportErrorState,
    ReportSection,
    ReportTabSkeleton,
    type ReportTabProps,
} from './report-shared';

export function CustomReportTab({
    instituteId,
    fromDate,
    toDate,
    teamId,
    counsellorUserId,
}: ReportTabProps) {
    const catalog = useQuery({
        queryKey: customCatalogQueryKey(instituteId),
        queryFn: () => fetchCustomCatalog(instituteId),
        enabled: !!instituteId,
        staleTime: 5 * 60 * 1000,
        retry: false,
    });

    const [dims, setDims] = useState<string[]>([]);
    const [measures, setMeasures] = useState<string[]>([]);
    const [filters, setFilters] = useState<Record<string, string[]>>({});

    const run = useMutation({ mutationFn: runCustomReport });

    const canRun = dims.length > 0 && measures.length > 0 && !!instituteId;

    const toggle = (list: string[], set: (v: string[]) => void, key: string) =>
        set(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

    const toggleFilterValue = (field: string, value: string) =>
        setFilters((prev) => {
            const cur = prev[field] ?? [];
            const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
            return { ...prev, [field]: next };
        });

    const doRun = () => {
        if (!canRun) return;
        const activeFilters: CustomReportFilter[] = Object.entries(filters)
            .filter(([, values]) => values.length > 0)
            .map(([field, values]) => ({ field, values }));
        run.mutate({
            instituteId,
            fromDate,
            toDate,
            teamId,
            counsellorUserId,
            dimensions: dims,
            measures,
            filters: activeFilters,
        });
    };

    const result = run.data ?? null;


    if (catalog.isLoading) return <ReportTabSkeleton />;
    if (catalog.isError)
        return <ReportErrorState error={catalog.error} onRetry={() => catalog.refetch()} />;

    const data = catalog.data;

    return (
        <div className="flex flex-col gap-6">
            <ReportSection title="Build a report" icon={<TableIcon size={18} />}>
                <FieldPicker
                    label="Group by (dimensions)"
                    fields={data?.dimensions ?? []}
                    selected={dims}
                    onToggle={(k) => toggle(dims, setDims, k)}
                />
                <FieldPicker
                    label="Measures"
                    fields={data?.measures ?? []}
                    selected={measures}
                    onToggle={(k) => toggle(measures, setMeasures, k)}
                    tone="primary"
                />

                {(data?.filters ?? []).some((f) => f.options.length > 0) && (
                    <div className="flex flex-col gap-3 border-t border-neutral-100 pt-4">
                        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
                            <FunnelSimple size={13} /> Filters
                        </span>
                        {(data?.filters ?? [])
                            .filter((f) => f.options.length > 0)
                            .map((f) => (
                                <div key={f.key} className="flex flex-col gap-1.5">
                                    <span className="text-xs text-neutral-600">{f.label}</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {f.options.map((o) => {
                                            const active = (filters[f.key] ?? []).includes(o.value);
                                            return (
                                                <Chip
                                                    key={o.value}
                                                    label={o.label}
                                                    active={active}
                                                    onClick={() =>
                                                        toggleFilterValue(f.key, o.value)
                                                    }
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                    </div>
                )}

                <div className="flex items-center gap-3 border-t border-neutral-100 pt-4">
                    <Button
                        onClick={doRun}
                        disabled={!canRun || run.isPending}
                        size="sm"
                        className="gap-1.5"
                    >
                        {run.isPending ? (
                            <ArrowClockwise size={14} className="animate-spin" />
                        ) : (
                            <Play size={14} />
                        )}
                        Run report
                    </Button>
                    {!canRun && (
                        <span className="text-xs text-neutral-400">
                            Pick at least one dimension and one measure.
                        </span>
                    )}
                </div>
            </ReportSection>

            {run.isError && <ReportErrorState error={run.error} onRetry={doRun} />}

            {result && (
                <ReportSection
                    title="Result"
                    icon={<TableIcon size={18} />}
                    actions={
                        <ExportWithColumnPickerButton
                            filename={`custom-report_${fromDate}_${toDate}.csv`}
                            disabled={result.rows.length === 0}
                            getHeadersAndRows={() => ({
                                headers: result.columns.map((c) => c.label),
                                rows: result.rows.map((row) =>
                                    row.map((cell, i) =>
                                        formatCell(cell, result.columns[i]?.type)
                                    )
                                ),
                            })}
                        />
                    }
                >
                    {result.rows.length === 0 ? (
                        <EmptyHint message="No rows match this spec." />
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                                            {result.columns.map((c) => (
                                                <th
                                                    key={c.key}
                                                    className={cn(
                                                        'py-2 pr-3',
                                                        c.kind === 'measure'
                                                            ? 'text-right'
                                                            : 'text-left'
                                                    )}
                                                >
                                                    {c.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.rows.map((row, ri) => (
                                            <tr
                                                key={ri}
                                                className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                                            >
                                                {row.map((cell, ci) => {
                                                    const col = result.columns[ci];
                                                    return (
                                                        <td
                                                            key={ci}
                                                            className={cn(
                                                                'py-2.5 pr-3',
                                                                col?.kind === 'measure'
                                                                    ? 'text-right text-neutral-800'
                                                                    : 'font-medium text-neutral-900'
                                                            )}
                                                        >
                                                            {formatCell(cell, col?.type)}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {result.truncated && (
                                <p className="text-xs text-amber-600">
                                    Showing the first {result.row_count} rows — refine your filters
                                    to narrow the result.
                                </p>
                            )}
                        </>
                    )}
                </ReportSection>
            )}
        </div>
    );
}

function FieldPicker({
    label,
    fields,
    selected,
    onToggle,
    tone = 'default',
}: {
    label: string;
    fields: { key: string; label: string }[];
    selected: string[];
    onToggle: (key: string) => void;
    tone?: 'default' | 'primary';
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {label}
            </span>
            <div className="flex flex-wrap gap-1.5">
                {fields.map((f) => (
                    <Chip
                        key={f.key}
                        label={f.label}
                        active={selected.includes(f.key)}
                        tone={tone}
                        onClick={() => onToggle(f.key)}
                    />
                ))}
            </div>
        </div>
    );
}

function Chip({
    label,
    active,
    onClick,
    tone = 'default',
}: {
    label: string;
    active: boolean;
    onClick: () => void;
    tone?: 'default' | 'primary';
}) {
    const activeClass =
        tone === 'primary'
            ? 'border-primary-500 bg-primary-50 text-primary-700'
            : 'border-green-500 bg-green-50 text-green-700';
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                active
                    ? activeClass
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
            )}
        >
            {label}
        </button>
    );
}

/** Measures render as grouped numbers; dimensions as their string value. Null → em-dash. */
function formatCell(cell: string | number | null, type?: string): string {
    if (cell == null) return '—';
    if (type === 'number' && typeof cell === 'number') {
        return cell.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    return String(cell);
}
