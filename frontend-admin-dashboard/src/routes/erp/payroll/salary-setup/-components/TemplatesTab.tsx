import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowSquareOut, Plus, Star, Warning } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { StatusChip } from '@/components/design-system/status-chips';
import { MyTable, type TableData } from '@/components/design-system/table';
import { Card, CardContent } from '@/components/ui/card';
import { getInstituteId } from '@/constants/helper';
import { fetchSalaryTemplates, hrKeys } from '@/routes/erp/-shared/hr-service';
import type { SalaryTemplateDTO } from '@/routes/erp/-shared/hr-types';
import { TemplateEditorDialog } from './TemplateEditorDialog';

/**
 * Salary templates — the reusable shape of a pay structure.
 *
 * The list is intentionally thin (name, default, size, status): everything that
 * matters about a template is in its component rows, and those need the width of
 * the editor, not four more columns here.
 */
export const TemplatesTab = ({ isHrAdmin }: { isHrAdmin: boolean }) => {
    const instituteId = getInstituteId();
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: hrKeys.salaryTemplates(),
        queryFn: fetchSalaryTemplates,
        enabled: !!instituteId,
    });

    const rows = useMemo(() => data ?? [], [data]);

    const openTemplate = (id: string | undefined) => {
        if (!id) return;
        setEditingId(id);
        setEditorOpen(true);
    };

    const openCreate = () => {
        setEditingId(null);
        setEditorOpen(true);
    };

    const columns = useMemo<ColumnDef<SalaryTemplateDTO>[]>(
        () => [
            {
                id: 'name',
                header: 'Template',
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="text-body text-neutral-700">
                            {row.original.name ?? '—'}
                        </span>
                        {row.original.description && (
                            <span className="truncate text-caption text-neutral-500">
                                {row.original.description}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'is_default',
                header: 'Default',
                cell: ({ row }) =>
                    row.original.is_default ? (
                        <span className="flex items-center gap-1 text-caption text-primary-600">
                            <Star size={14} weight="fill" />
                            Default
                        </span>
                    ) : (
                        <span className="text-caption text-neutral-400">—</span>
                    ),
            },
            {
                id: 'component_count',
                header: 'Components',
                cell: ({ row }) => (
                    <span className="text-body tabular-nums text-neutral-600">
                        {row.original.components?.length ?? '—'}
                    </span>
                ),
            },
            {
                id: 'status',
                header: 'Status',
                cell: ({ row }) => {
                    const status = (row.original.status ?? 'ACTIVE').toUpperCase();
                    return (
                        <StatusChip
                            text={status === 'ACTIVE' ? 'Active' : 'Inactive'}
                            textSize="text-caption"
                            status={status === 'ACTIVE' ? 'SUCCESS' : 'INFO'}
                            showIcon={false}
                        />
                    );
                },
            },
            {
                id: 'actions',
                header: '',
                cell: ({ row }) => (
                    <MyButton
                        buttonType="text"
                        scale="small"
                        onClick={() => openTemplate(row.original.id)}
                    >
                        <ArrowSquareOut size={16} />
                        {isHrAdmin ? 'Edit' : 'View'}
                    </MyButton>
                ),
            },
        ],
        [isHrAdmin]
    );

    const tableData: TableData<SalaryTemplateDTO> = {
        content: rows,
        total_pages: 1,
        page_no: 0,
        page_size: rows.length,
        total_elements: rows.length,
        last: true,
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <p className="max-w-2xl text-body text-neutral-600">
                    A template says how each component is derived from an employee&apos;s CTC. Put
                    an employee on a template and their monthly amounts are computed, not typed.
                </p>
                {isHrAdmin && (
                    <MyButton buttonType="primary" scale="medium" onClick={openCreate}>
                        <Plus size={16} />
                        New template
                    </MyButton>
                )}
            </div>

            {isError ? (
                <Card>
                    <CardContent className="flex flex-col items-start gap-3 p-6">
                        <div className="flex items-center gap-2 text-body text-danger-600">
                            <Warning size={18} />
                            Could not load salary templates.
                        </div>
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            onAsyncClick={async () => {
                                await refetch();
                            }}
                            loadingText="Retrying…"
                        >
                            Retry
                        </MyButton>
                    </CardContent>
                </Card>
            ) : !isLoading && rows.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-start gap-3 p-6">
                        <p className="text-subtitle text-neutral-700">No templates yet</p>
                        <p className="max-w-xl text-body text-neutral-600">
                            Create one for each pay shape you use — typically a standard staff
                            structure and one for teaching roles.
                        </p>
                        {isHrAdmin && (
                            <MyButton buttonType="primary" scale="medium" onClick={openCreate}>
                                <Plus size={16} />
                                New template
                            </MyButton>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <MyTable<SalaryTemplateDTO>
                    data={tableData}
                    columns={columns}
                    isLoading={isLoading}
                    error={null}
                    currentPage={0}
                    scrollable
                />
            )}

            <TemplateEditorDialog
                open={editorOpen}
                onOpenChange={setEditorOpen}
                templateId={editingId}
                isHrAdmin={isHrAdmin}
            />
        </div>
    );
};
