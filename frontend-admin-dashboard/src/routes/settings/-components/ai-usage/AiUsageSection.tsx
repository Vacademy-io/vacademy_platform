import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useDebounce } from 'use-debounce';
import * as XLSX from 'xlsx';
import { Sparkle, Users, MagnifyingGlass, DownloadSimple } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { MyTable } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { DateRangeFilter, type DateRangeResult } from '@/components/design-system/date-range-filter';
import { mapRoleToCustomName } from '@/utils/roleUtils';
import {
    useUsageUsersQuery,
    useUsageSummaryQuery,
    fetchUsageUsers,
    ddmmyyyyToMillis,
    type UsageDateRange,
    type UserUsageRow,
} from '../../-services/ai-usage-service';
import { LearnerActivityDialog, type SelectedLearner } from './LearnerActivityDialog';

const PAGE_SIZE = 20;
// Per-user usage is bounded (one row per member who used AI), so one big page
// pulls the whole filtered set for an export.
const EXPORT_PAGE_SIZE = 10000;

const formatRoles = (roles: string | null): string =>
    roles
        ? Array.from(new Set(roles.split(',').map((r) => r.trim()).filter(Boolean)))
              .map((r) => mapRoleToCustomName(r))
              .join(', ')
        : '';

const fileDate = (ms?: number): string => {
    if (!ms) return '';
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const defaultRange = (): UsageDateRange => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    return { startDate: start.getTime(), endDate: now.getTime() };
};

function RoleChips({ roles }: { roles: string | null }) {
    if (!roles) return <span className="text-neutral-400">—</span>;
    const list = Array.from(new Set(roles.split(',').map((r) => r.trim()).filter(Boolean)));
    return (
        <div className="flex flex-wrap gap-1">
            {list.map((r) => (
                <span
                    key={r}
                    className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-caption text-neutral-600"
                >
                    {mapRoleToCustomName(r)}
                </span>
            ))}
        </div>
    );
}

export function AiUsageSection() {
    const [range, setRange] = useState<UsageDateRange>(defaultRange);
    const [roleTab, setRoleTab] = useState<string | null>(null); // null = All
    const [nameInput, setNameInput] = useState('');
    const [debouncedName] = useDebounce(nameInput, 300);
    const [page, setPage] = useState(0);
    const [selectedLearner, setSelectedLearner] = useState<SelectedLearner | null>(null);

    const summaryQ = useUsageSummaryQuery(range);
    const usersQ = useUsageUsersQuery(page, PAGE_SIZE, { ...range, role: roleTab, name: debouncedName });

    const onDateChange = (r: DateRangeResult | null) => {
        setPage(0);
        if (!r) {
            setRange(defaultRange());
            return;
        }
        setRange({
            startDate: ddmmyyyyToMillis(r.startDate),
            endDate: ddmmyyyyToMillis(r.endDate, true),
        });
    };

    const roleTabs = useMemo(
        () => (summaryQ.data ?? []).slice().sort((a, b) => b.totalCredits - a.totalCredits),
        [summaryQ.data]
    );

    // Export the currently-filtered usage list (role tab + name search + date range).
    const handleExport = async () => {
        const all = await fetchUsageUsers(0, EXPORT_PAGE_SIZE, {
            ...range,
            role: roleTab,
            name: debouncedName,
        });
        const rows = all.content ?? [];
        const header = ['Name', 'Email', 'Role', 'Credits used', 'Requests'];
        const body = rows.map((u) => [
            u.name || u.userId,
            u.email || '',
            formatRoles(u.roles),
            Number(u.totalCredits.toFixed(2)),
            u.requestCount,
        ]);
        const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
        ws['!cols'] = [{ wch: 28 }, { wch: 32 }, { wch: 22 }, { wch: 14 }, { wch: 12 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'AI Credit Usage');
        XLSX.writeFile(wb, `ai-credit-usage_${fileDate(range.startDate)}_${fileDate(range.endDate)}.xlsx`);
    };

    const userColumns: ColumnDef<UserUsageRow>[] = useMemo(
        () => [
            {
                accessorKey: 'name',
                header: 'Name',
                cell: ({ row }) => (
                    <span className="font-medium text-neutral-700">
                        {row.original.name || row.original.userId}
                    </span>
                ),
            },
            {
                accessorKey: 'email',
                header: 'Email',
                cell: ({ row }) =>
                    row.original.email ? (
                        <span className="text-neutral-600">{row.original.email}</span>
                    ) : (
                        <span className="text-neutral-400">—</span>
                    ),
            },
            {
                accessorKey: 'roles',
                header: 'Role',
                cell: ({ row }) => <RoleChips roles={row.original.roles} />,
            },
            {
                accessorKey: 'totalCredits',
                header: 'Credits used',
                cell: ({ row }) => (
                    <span className="font-semibold text-neutral-800">
                        {row.original.totalCredits.toFixed(2)}
                    </span>
                ),
            },
            { accessorKey: 'requestCount', header: 'Requests' },
            {
                id: 'actions',
                header: '',
                cell: ({ row }) => (
                    <MyButton
                        buttonType="text"
                        scale="small"
                        onClick={() =>
                            setSelectedLearner({
                                userId: row.original.userId,
                                name: row.original.name || row.original.email || row.original.userId,
                                email: row.original.email,
                                roles: row.original.roles,
                                totalCredits: row.original.totalCredits,
                                requestCount: row.original.requestCount,
                            })
                        }
                    >
                        View logs
                    </MyButton>
                ),
            },
        ],
        []
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <Sparkle className="size-5 text-primary-500" weight="fill" />
                    <h3 className="text-h3 font-semibold text-neutral-700">AI Credit Usage by User</h3>
                </div>
                <p className="text-body text-neutral-500">
                    Credits consumed per member in the selected period (net of refunds). Pick a member to
                    see their detailed activity — including the prompts they sent and the AI's answers.
                </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Role sub-tabs */}
                <div className="flex flex-wrap items-center gap-2">
                    <RoleTabButton active={roleTab === null} onClick={() => { setRoleTab(null); setPage(0); }}>
                        <Users className="size-3.5" /> All
                    </RoleTabButton>
                    {roleTabs.map((rs) => (
                        <RoleTabButton
                            key={rs.role}
                            active={roleTab === rs.role}
                            onClick={() => { setRoleTab(rs.role); setPage(0); }}
                        >
                            {mapRoleToCustomName(rs.role)}
                            <span className="rounded-full bg-neutral-100 px-1.5 text-caption text-neutral-500">
                                {rs.userCount}
                            </span>
                        </RoleTabButton>
                    ))}
                </div>
                <DateRangeFilter onChange={onDateChange} defaultFilter="7 Days" />
            </div>

            {/* Name search + export */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                    <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                    <MyInput
                        inputType="text"
                        inputPlaceholder="Search by name or email…"
                        input={nameInput}
                        onChangeFunction={(e) => {
                            setNameInput(e.target.value);
                            setPage(0);
                        }}
                        size="medium"
                        className="w-full pl-9 sm:w-80"
                    />
                </div>
                <MyButton
                    buttonType="secondary"
                    scale="medium"
                    layoutVariant="default"
                    onAsyncClick={handleExport}
                    loadingText="Exporting…"
                    disable={!usersQ.data || usersQ.data.total_elements === 0}
                >
                    <DownloadSimple className="size-4" />
                    Export to Excel
                </MyButton>
            </div>

            <MyTable<UserUsageRow>
                data={usersQ.data}
                columns={userColumns}
                isLoading={usersQ.isLoading}
                error={usersQ.error}
                currentPage={page}
            />
            {usersQ.data && usersQ.data.total_pages > 1 && (
                <MyPagination
                    currentPage={page}
                    totalPages={usersQ.data.total_pages}
                    onPageChange={setPage}
                />
            )}

            <LearnerActivityDialog
                learner={selectedLearner}
                range={range}
                onClose={() => setSelectedLearner(null)}
            />
        </div>
    );
}

function RoleTabButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-body font-medium transition-colors',
                active
                    ? 'border-primary-500 bg-primary-50 text-primary-600'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-primary-200'
            )}
        >
            {children}
        </button>
    );
}
