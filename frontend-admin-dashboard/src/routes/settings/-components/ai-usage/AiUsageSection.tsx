import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Sparkle, Users, ListBullets } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { MyButton } from '@/components/design-system/button';
import { MyTable } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { MyDialog } from '@/components/design-system/dialog';
import { DateRangeFilter, type DateRangeResult } from '@/components/design-system/date-range-filter';
import { mapRoleToCustomName } from '@/utils/roleUtils';
import {
    useUsageUsersQuery,
    useUsageSummaryQuery,
    useUsageUserLogsQuery,
    ddmmyyyyToMillis,
    type UsageDateRange,
    type UserUsageRow,
    type UsageLogRow,
} from '../../-services/ai-usage-service';

const PAGE_SIZE = 20;

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
    const [page, setPage] = useState(0);
    const [selectedUser, setSelectedUser] = useState<{ userId: string; name: string } | null>(null);
    const [logPage, setLogPage] = useState(0);

    const summaryQ = useUsageSummaryQuery(range);
    const usersQ = useUsageUsersQuery(page, PAGE_SIZE, { ...range, role: roleTab });
    const logsQ = useUsageUserLogsQuery(selectedUser?.userId ?? null, logPage, PAGE_SIZE, range);

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

    const userColumns: ColumnDef<UserUsageRow>[] = useMemo(
        () => [
            {
                accessorKey: 'name',
                header: 'User',
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="font-medium text-neutral-700">
                            {row.original.name || row.original.userId}
                        </span>
                        {row.original.email && (
                            <span className="text-caption text-neutral-500">{row.original.email}</span>
                        )}
                    </div>
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
                        onClick={() => {
                            setSelectedUser({
                                userId: row.original.userId,
                                name: row.original.name || row.original.email || row.original.userId,
                            });
                            setLogPage(0);
                        }}
                    >
                        View logs
                    </MyButton>
                ),
            },
        ],
        []
    );

    const logColumns: ColumnDef<UsageLogRow>[] = useMemo(
        () => [
            {
                accessorKey: 'createdAt',
                header: 'When',
                cell: ({ row }) =>
                    row.original.createdAt ? new Date(row.original.createdAt).toLocaleString() : '—',
            },
            { accessorKey: 'requestType', header: 'Tool' },
            {
                accessorKey: 'model',
                header: 'Model',
                cell: ({ row }) => row.original.model || '—',
            },
            {
                accessorKey: 'credits',
                header: 'Credits',
                cell: ({ row }) => (
                    <span className="font-semibold text-neutral-800">
                        {row.original.credits.toFixed(4)}
                    </span>
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
                    see their detailed activity.
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

            <MyDialog
                open={!!selectedUser}
                onOpenChange={(o) => { if (!o) setSelectedUser(null); }}
                heading={selectedUser ? `Usage — ${selectedUser.name}` : 'Usage'}
                dialogWidth="max-w-3xl"
            >
                <div className="space-y-3 p-6">
                    <div className="flex items-center gap-2 text-body text-neutral-500">
                        <ListBullets className="size-4" />
                        Individual credit deductions in the selected period.
                    </div>
                    <MyTable<UsageLogRow>
                        data={logsQ.data}
                        columns={logColumns}
                        isLoading={logsQ.isLoading}
                        error={logsQ.error}
                        currentPage={logPage}
                    />
                    {logsQ.data && logsQ.data.total_pages > 1 && (
                        <MyPagination
                            currentPage={logPage}
                            totalPages={logsQ.data.total_pages}
                            onPageChange={setLogPage}
                        />
                    )}
                </div>
            </MyDialog>
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
