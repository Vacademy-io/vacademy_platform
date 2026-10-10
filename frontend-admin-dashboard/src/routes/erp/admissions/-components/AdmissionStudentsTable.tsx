import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { MyTable } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { StatusChips } from '@/components/design-system/chips';
import { useStudentList } from '@/routes/manage-students/students-list/-services/getStudentTable';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { getBatchDisplayName } from '@/utils/helpers/student-management/batch-display-name';
import { getInstituteId } from '@/constants/helper';
import type { StudentTable } from '@/types/student-table-types';

const PAGE_SIZE = 10;

/**
 * The learner list behind both Admission sub-pages. The only difference between
 * Enrolled and Flexi is which batches are in scope, so the caller passes the ids
 * rather than this deciding — a Flexi batch is just a batch whose own name is
 * "Flexi Batch", and that name is institute data, not a product concept.
 *
 * Rendered from the existing learner endpoint so the figures here can never drift
 * from Manage Students; nothing new is computed on this page.
 */
export function AdmissionStudentsTable({
    packageSessionIds,
    emptyTitle,
    emptyDescription,
}: {
    /** Batches in scope. `null` means "not resolved yet" — render as loading, not empty. */
    packageSessionIds: string[] | null;
    emptyTitle: string;
    emptyDescription: string;
}) {
    const { t } = useTranslation('erpAdmissions');
    const [page, setPage] = useState(0);
    const instituteId = getInstituteId();
    const instituteDetails = useInstituteDetailsStore((s) => s.instituteDetails);

    const batchNameById = useMemo(() => {
        const map = new Map<string, string>();
        instituteDetails?.batches_for_sessions?.forEach((b) => map.set(b.id, getBatchDisplayName(b)));
        return map;
    }, [instituteDetails]);

    const { data, isLoading, error } = useStudentList(
        {
            institute_ids: instituteId ? [instituteId] : [],
            package_session_ids: packageSessionIds ?? [],
            statuses: ['ACTIVE'],
            sort_columns: {},
        },
        page,
        PAGE_SIZE
    );

    const columns = useMemo<ColumnDef<StudentTable>[]>(
        () => [
            {
                accessorKey: 'institute_enrollment_number',
                header: t('columns.regId'),
                cell: ({ row }) => row.original.institute_enrollment_number || '—',
            },
            { accessorKey: 'full_name', header: t('columns.name') },
            {
                accessorKey: 'package_session_id',
                header: t('columns.batch'),
                cell: ({ row }) => batchNameById.get(row.original.package_session_id) || '—',
            },
            {
                accessorKey: 'mobile_number',
                header: t('columns.mobile'),
                cell: ({ row }) => row.original.mobile_number || '—',
            },
            {
                accessorKey: 'email',
                header: t('columns.email'),
                cell: ({ row }) => row.original.email || '—',
            },
            {
                accessorKey: 'enrolled_date',
                header: t('columns.enrolledOn'),
                cell: ({ row }) =>
                    row.original.enrolled_date
                        ? new Date(row.original.enrolled_date).toLocaleDateString()
                        : '—',
            },
            {
                accessorKey: 'payment_status',
                header: t('columns.payment'),
                // StatusChips renders NOTHING for a status outside its union, and the column
                // files that would have caught that are @ts-nocheck'd. Only the two values it
                // actually knows get a chip; anything else falls back to its own text so the
                // cell can never silently go blank.
                cell: ({ row }) => {
                    const raw = row.original.payment_status;
                    if (!raw) return '—';
                    const known = raw.toUpperCase();
                    if (known === 'PAID' || known === 'PAYMENT_PENDING') {
                        return <StatusChips status={known}>{t(`payment.${known}`)}</StatusChips>;
                    }
                    return raw;
                },
            },
        ],
        [t, batchNameById]
    );

    // An unresolved batch list is not an empty one: showing "no students" while the
    // institute details are still loading reads as data loss.
    const resolving = packageSessionIds === null;

    if (!resolving && packageSessionIds.length === 0) {
        return (
            <div className="rounded-lg border border-neutral-200 p-8 text-center">
                <p className="text-subtitle font-semibold text-neutral-700">{emptyTitle}</p>
                <p className="mt-1 text-body text-neutral-500">{emptyDescription}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <MyTable<StudentTable>
                data={{
                    content: data?.content ?? [],
                    total_pages: data?.total_pages ?? 0,
                    page_no: page,
                    page_size: PAGE_SIZE,
                    total_elements: data?.total_elements ?? 0,
                    last: data?.last ?? true,
                }}
                columns={columns}
                isLoading={resolving || isLoading}
                error={error as Error | null}
                currentPage={page}
                scrollable
            />
            {(data?.total_pages ?? 0) > 1 && (
                <MyPagination
                    currentPage={page}
                    totalPages={data?.total_pages ?? 0}
                    onPageChange={setPage}
                />
            )}
        </div>
    );
}
