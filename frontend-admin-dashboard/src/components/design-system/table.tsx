import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
    RowSelectionState,
    OnChangeFn,
    ColumnDef,
    VisibilityState,
} from '@tanstack/react-table';
import { ChangeBatchDialog } from './table-components/student-menu-options/change-batch-dialog';
import { ExtendSessionDialog } from './table-components/student-menu-options/extend-session-dialog';
import { ReRegisterDialog } from './table-components/student-menu-options/re-register-dialog';
import { TerminateRegistrationDialog } from './table-components/student-menu-options/terminate-registration-dialog';
import { useDialogStore } from '../../routes/manage-students/students-list/-hooks/useDialogStore';
import { DeleteStudentDialog } from './table-components/student-menu-options/delete-student-dialog';
import { ColumnWidthConfig } from './utils/constants/table-layout';
import { DashboardLoader } from '../core/dashboard-loader';

const headerTextCss = 'p-3 border-r border-neutral-300';
const cellCommonCss = 'p-3';

export interface TableData<T> {
    content: T[];
    total_pages: number;
    page_no: number;
    page_size: number;
    total_elements: number;
    last: boolean;
}

interface MyTableProps<T> {
    data: TableData<T> | undefined;
    columns: ColumnDef<T>[];
    isLoading: boolean;
    error: unknown;
    onSort?: (columnId: string, direction: string) => void;
    rowSelection?: RowSelectionState;
    onRowSelectionChange?: OnChangeFn<RowSelectionState>;
    currentPage: number;
    columnWidths?: ColumnWidthConfig;
    scrollable?: boolean;
    className?: string;
    tableState?: { columnVisibility: VisibilityState };
    onCellClick?: (row: T, column: ColumnDef<T>) => void;
    onHeaderClick?: () => void;
}

export function MyTable<T>({
    data,
    columns,
    isLoading,
    error,
    onSort,
    columnWidths,
    rowSelection,
    onRowSelectionChange,
    scrollable = false,
    className = '',
    tableState,
    onCellClick,
    onHeaderClick,
}: MyTableProps<T>) {
    const table = useReactTable({
        data: data?.content || [],
        columns,
        getCoreRowModel: getCoreRowModel(),
        meta: { onSort },
        state: {
            columnVisibility: tableState?.columnVisibility || {},
            rowSelection,
        },
        enableRowSelection: true,
        onRowSelectionChange: (updaterOrValue) => {
            if (typeof updaterOrValue === 'function') {
                if (rowSelection) {
                    const newSelection = updaterOrValue(rowSelection);
                    if (onRowSelectionChange) {
                        onRowSelectionChange(newSelection);
                    }
                }
            } else {
                if (onRowSelectionChange) {
                    onRowSelectionChange(updaterOrValue);
                }
            }
        },
        autoResetPageIndex: false,
    });

    const {
        isChangeBatchOpen,
        isExtendSessionOpen,
        isReRegisterOpen,
        isTerminateRegistrationOpen,
        isDeleteOpen,
        closeAllDialogs,
    } = useDialogStore();

    if (isLoading) return <div>Loading...</div>;
    if (error) return <div>Error loading data</div>;
    if (!data) return null;
    if (!table) return <DashboardLoader />;

    return (
        <div
            className={`h-auto w-full ${
                scrollable ? 'overflow-auto' : 'overflow-visible'
            } rounded-lg border ${className}`}
        >
            <div className="max-w-full overflow-visible rounded-lg">
                <Table className="rounded-lg">
                    <TableHeader className="relative bg-primary-200">
                        {table &&
                            table?.getHeaderGroups()?.length > 0 &&
                            table?.getHeaderGroups()?.map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="hover:bg-primary-200">
                                    {headerGroup.headers.map((header) => (
                                        <TableHead
                                            key={header.id}
                                            className={`${headerTextCss} overflow-visible bg-primary-100 text-subtitle font-semibold text-neutral-600 ${
                                                columnWidths?.[header.column.id] || ''
                                            }`}
                                            style={{
                                                width: columnWidths?.[header.id] || 'auto',
                                            }}
                                            onClick={() => {
                                                if (onHeaderClick) {
                                                    onHeaderClick();
                                                }
                                            }}
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                      header.column.columnDef.header,
                                                      header.getContext()
                                                  )}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.map((row) => (
                            <TableRow key={row.id} className="cursor-pointer hover:bg-white">
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell
                                        key={cell.id}
                                        className={`${cellCommonCss} z-10 bg-white text-body font-regular text-neutral-600 ${
                                            columnWidths?.[cell.column.id] || ''
                                        }`}
                                        onClick={() => {
                                            if (onCellClick) {
                                                onCellClick(row.original, cell.column.columnDef);
                                            }
                                        }}
                                    >
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <ChangeBatchDialog
                trigger={null}
                open={isChangeBatchOpen}
                onOpenChange={(open) => {
                    if (!open) closeAllDialogs();
                }}
            />

            <ExtendSessionDialog
                trigger={null}
                open={isExtendSessionOpen}
                onOpenChange={(open) => {
                    if (!open) closeAllDialogs();
                }}
            />

            <ReRegisterDialog
                trigger={null}
                open={isReRegisterOpen}
                onOpenChange={(open) => {
                    if (!open) closeAllDialogs();
                }}
            />

            <TerminateRegistrationDialog
                trigger={null}
                open={isTerminateRegistrationOpen}
                onOpenChange={(open) => {
                    if (!open) closeAllDialogs();
                }}
            />

            <DeleteStudentDialog
                trigger={null}
                open={isDeleteOpen}
                onOpenChange={(open) => {
                    if (!open) closeAllDialogs();
                }}
            />
        </div>
    );
}
