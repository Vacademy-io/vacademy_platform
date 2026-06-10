import { ColumnDef } from '@tanstack/react-table';
import { Doubt } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-types/get-doubts-type';
import { useDoubtTable } from './useDoubtTable';
import { DoubtCell } from '../-components/doubt-table/doubt-cell';
import { MarkAsResolvedCell } from '../-components/doubt-table/mark-as-resolved-cell';
import { BatchCell } from '../-components/doubt-table/batch-cell';
import { TypeCell } from '../-components/doubt-table/type-cell';
import { CategoryCell } from '../-components/doubt-table/category-cell';
import { AssigneeCell } from '../-components/doubt-table/assignee-cell';
import { ActionsCell } from '../-components/doubt-table/actions-cell';
import { NavigateCell } from '../-components/doubt-table/navigate-cell';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const getInitials = (name?: string) => {
    const cleaned = (name ?? '').trim();
    if (!cleaned) return '?';
    const parts = cleaned.split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
    return (first + last).toUpperCase();
};

const formatDateAndTime = (iso?: string | null): { date: string; time: string } | null => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return {
        date: d.toLocaleDateString(undefined, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        }),
        time: d.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        }),
    };
};

const DateStack = ({ iso }: { iso?: string | null }) => {
    const parts = formatDateAndTime(iso);
    if (!parts) {
        return <span className="text-xs text-neutral-400">—</span>;
    }
    return (
        <div className="flex flex-col leading-tight">
            <span className="text-sm font-medium text-neutral-800">{parts.date}</span>
            <span className="text-caption text-neutral-500">{parts.time}</span>
        </div>
    );
};

export const useDoubtTableColumns = () => {
    const { refetch, userDetailsRecord } = useDoubtTable();

    const columns: ColumnDef<Doubt>[] = [
        {
            accessorKey: 'navigate',
            header: '',
            cell: ({ row }) => <NavigateCell doubt={row.original} />,
            size: 50,
        },
        {
            accessorKey: 'doubt',
            header: 'Doubt',
            cell: ({ row }) => <DoubtCell doubt={row.original} />,
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => <MarkAsResolvedCell doubt={row.original} refetch={refetch} />,
        },
        {
            accessorKey: 'learner',
            header: getTerminology(RoleTerms.Learner, SystemTerms.Learner),
            cell: ({ row }) => {
                // Logged-out (guest) queries have no user_id — show the contact the guest left.
                const isGuest = !row.original.user_id && !!row.original.guest_name;
                const name = isGuest
                    ? row.original.guest_name!
                    : userDetailsRecord[row.original.user_id]?.name ?? 'Unknown';
                return (
                    <div className="flex items-center gap-2">
                        <Avatar className="size-8">
                            <AvatarFallback className="bg-primary-100 text-caption font-semibold text-primary-700">
                                {getInitials(name)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                            <span className="flex items-center gap-1.5 truncate text-sm font-medium text-neutral-800">
                                {name}
                                {isGuest && (
                                    <span className="shrink-0 rounded-full bg-neutral-100 px-1.5 py-0.5 text-caption font-semibold text-neutral-500">
                                        Guest
                                    </span>
                                )}
                            </span>
                            {isGuest && row.original.guest_email && (
                                <span className="truncate text-caption text-neutral-500">
                                    {row.original.guest_email}
                                </span>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            accessorKey: 'batch',
            header: getTerminology(ContentTerms.Batch, SystemTerms.Batch),
            cell: ({ row }) => <BatchCell batch_id={row.original.batch_id} />,
        },
        {
            accessorKey: 'category',
            header: 'Category',
            cell: ({ row }) => <CategoryCell doubt={row.original} />,
        },
        {
            accessorKey: 'type',
            header: 'Format',
            cell: ({ row }) => <TypeCell doubt={row.original} />,
        },
        {
            accessorKey: 'assignedTo',
            header: 'Assigned To',
            cell: ({ row }) => <AssigneeCell doubt={row.original} />,
        },
        {
            accessorKey: 'raised',
            header: 'Raised',
            cell: ({ row }) => <DateStack iso={row.original.raised_time} />,
        },
        {
            accessorKey: 'resolved',
            header: 'Resolved',
            cell: ({ row }) => <DateStack iso={row.original.resolved_time} />,
        },
        {
            accessorKey: 'actions',
            header: 'Actions',
            cell: ({ row }) => <ActionsCell doubt={row.original} refetch={refetch} />,
        },
    ];

    return { columns };
};
