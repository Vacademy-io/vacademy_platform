import { ColumnDef } from '@tanstack/react-table';
import { Doubt } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-types/get-doubts-type';
import { useDoubtTable } from './useDoubtTable';
import { formatISODateTimeReadable } from '@/helpers/formatISOTime';
import { DoubtCell } from '../-components/doubt-table/doubt-cell';
import { MarkAsResolvedCell } from '../-components/doubt-table/mark-as-resolved-cell';
import { BatchCell } from '../-components/doubt-table/batch-cell';
import { TypeCell } from '../-components/doubt-table/type-cell';
import { AssigneeCell } from '../-components/doubt-table/assignee-cell';
import { ActionsCell } from '../-components/doubt-table/actions-cell';
import { NavigateCell } from '../-components/doubt-table/navigate-cell';

export const useDoubtTableColumns = () => {
    const { refetch } = useDoubtTable();
    const { userDetailsRecord } = useDoubtTable();

    const columns: ColumnDef<Doubt>[] = [
        {
            accessorKey: 'navigate',
            header: '',
            cell: ({ row }) => {
                const doubt = row.original;
                return <NavigateCell doubt={doubt} />;
            },
            size: 50,
        },
        {
            accessorKey: 'doubt',
            header: 'Doubt',
            cell: ({ row }) => {
                const doubt = row.original;
                return <DoubtCell doubt={doubt} />;
            },
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const doubt = row.original;
                return <MarkAsResolvedCell doubt={doubt} refetch={refetch} />;
            },
        },
        {
            accessorKey: 'learner',
            header: 'Learner',
            cell: ({ row }) => <p>{userDetailsRecord[row.original.user_id]?.name}</p>,
        },
        {
            accessorKey: 'batch',
            header: 'Batch',
            cell: ({ row }) => <BatchCell batch_id={row.original.batch_id} />,
        },
        {
            accessorKey: 'type',
            header: 'Type',
            cell: ({ row }) => <TypeCell doubt={row.original} />,
        },
        {
            accessorKey: 'assignedTo',
            header: 'Assigned To',
            cell: ({ row }) => {
                return <AssigneeCell doubt={row.original} />;
            },
        },
        {
            accessorKey: 'raised',
            header: 'Raised',
            cell: ({ row }) => <div>{formatISODateTimeReadable(row.original.raised_time)}</div>,
        },
        {
            accessorKey: 'resolved',
            header: 'Resolved',
            cell: ({ row }) => (
                <div>
                    {row.original.resolved_time
                        ? formatISODateTimeReadable(row.original.resolved_time)
                        : '-'}
                </div>
            ),
        },
        {
            accessorKey: 'actions',
            header: 'Actions',
            cell: ({ row }) => {
                return <ActionsCell doubt={row.original} refetch={refetch} />;
            },
        },
    ];

    return { columns };
};
