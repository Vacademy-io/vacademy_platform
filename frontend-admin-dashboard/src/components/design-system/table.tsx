// Safari compatibility: Using native HTML elements instead of wrapped components
// import {
//     Table,
//     TableBody,
//     TableCell,
//     TableHead,
//     TableHeader,
//     TableRow,
// } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
    RowSelectionState,
    OnChangeFn,
    ColumnDef,
    VisibilityState,
    ColumnResizeMode,
    ColumnSizingState,
    ColumnPinningState,
} from '@tanstack/react-table';
import { ChangeBatchDialog } from './table-components/student-menu-options/change-batch-dialog';
import { ExtendSessionDialog } from './table-components/student-menu-options/extend-session-dialog';
import { ReRegisterDialog } from './table-components/student-menu-options/re-register-dialog';
import { TerminateRegistrationDialog } from './table-components/student-menu-options/terminate-registration-dialog';
import { useDialogStore } from '../../routes/manage-students/students-list/-hooks/useDialogStore';
import { DeleteStudentDialog } from './table-components/student-menu-options/delete-student-dialog';
import { ColumnWidthConfig } from './utils/constants/table-layout';
import { DashboardLoader } from '../core/dashboard-loader';
import { useState, useCallback } from 'react';
import { useCompactMode } from '@/hooks/use-compact-mode';
import { cn } from '@/lib/utils';

const headerTextCss = 'p-3 border-r border-neutral-300';
const cellCommonCss = 'p-3';

// Resize handle component
const ResizeHandle = ({ header, table }: { header: any; table: any }) => {
    const [isHovered, setIsHovered] = useState(false);

    // Safety checks
    if (!header || !table) {
        return null;
    }

    // Get resize state safely
    const isResizing = header?.column?.getIsResizing?.() || false;
    const deltaOffset = table?.getState?.()?.columnSizingInfo?.deltaOffset || 0;
    const resizeHandler = header?.getResizeHandler?.();

    // Don't render if resize handler is not available or column can't be resized
    if (!resizeHandler || !header?.column?.getCanResize?.()) {
        return null;
    }

    return (
        <div
            onMouseDown={resizeHandler}
            onTouchStart={resizeHandler}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`
                group absolute right-0 top-0 z-10 flex h-full w-2
                cursor-col-resize touch-none select-none items-center justify-center
                ${isResizing ? 'bg-primary-100/50' : ''}
            `}
            style={{
                transform: isResizing ? `translateX(${deltaOffset}px)` : '',
            }}
        >
            {/* Visual indicator */}
            <div
                className={`
                    h-4 w-0.5 rounded-full transition-all duration-200 ease-in-out
                    ${isHovered || isResizing
                        ? 'scale-y-150 bg-primary-500 shadow-md'
                        : 'bg-neutral-300 group-hover:bg-primary-400'
                    }
                `}
            />

            {/* Invisible wider hit area for easier dragging */}
            <div className="absolute inset-0 -left-2 w-4" />
        </div>
    );
};

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
    enableColumnResizing?: boolean;
    columnResizeMode?: ColumnResizeMode;
    onColumnSizingChange?: (sizing: any) => void;
    minColumnWidth?: number;
    maxColumnWidth?: number;
    enableColumnPinning?: boolean;
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
    enableColumnResizing = true,
    columnResizeMode = 'onChange',
    onColumnSizingChange,
    minColumnWidth = 50,
    maxColumnWidth = 1000,
    enableColumnPinning = true,
}: MyTableProps<T>) {
    const { isCompact } = useCompactMode();

    // State for column resizing
    const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

    // State for column pinning - determine which columns to pin based on available columns
    const getDefaultPinnedColumns = () => {
        if (!enableColumnPinning) return [];

        const columnIds = columns.map((col) => col.id || (col as any).accessorKey);
        const commonPinnedColumns = ['checkbox', 'details', 'full_name'];

        // Only pin columns that actually exist in the table
        const availablePinnedColumns = commonPinnedColumns.filter((colId) =>
            columnIds.includes(colId)
        );

        return availablePinnedColumns;
    };

    const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({
        left: getDefaultPinnedColumns(),
    });

    // Handle column sizing changes
    const handleColumnSizingChange = useCallback(
        (updaterOrValue: any) => {
            const newSizing =
                typeof updaterOrValue === 'function'
                    ? updaterOrValue(columnSizing)
                    : updaterOrValue;

            setColumnSizing(newSizing);
            onColumnSizingChange?.(newSizing);
        },
        [columnSizing, onColumnSizingChange]
    );

    const table = useReactTable({
        data: data?.content || [],
        columns,
        getCoreRowModel: getCoreRowModel(),
        meta: { onSort },
        state: {
            columnVisibility: tableState?.columnVisibility || {},
            rowSelection,
            columnSizing,
            columnPinning,
        },
        enableRowSelection: true,
        enableColumnResizing,
        enableColumnPinning,
        columnResizeMode,
        onColumnSizingChange: handleColumnSizingChange,
        defaultColumn: {
            minSize: minColumnWidth,
            maxSize: maxColumnWidth,
        },
        debugTable: false,
        debugHeaders: false,
        debugColumns: false,
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

    if (isLoading) {
        return (
            <div className={`h-auto w-full ${className}`}>
                <div className="relative w-full rounded-lg border border-neutral-200 bg-white">
                    <div className="overflow-hidden">
                        <table className="w-full caption-bottom text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
                            <thead className={cn(
                                "sticky top-0 z-30 border-b border-neutral-300 bg-primary-50 shadow-sm",
                                isCompact ? "text-xs" : "text-sm"
                            )}>
                                <tr>
                                    {columns.map((col, i) => (
                                        <th key={i} className={cn(
                                            "h-14 p-4 px-2 text-left align-middle font-semibold text-neutral-700 border-r border-primary-200",
                                            isCompact ? "h-8 p-1 px-2" : "h-14 p-4 px-2"
                                        )}>
                                            {typeof col.header === 'string' ? col.header : <Skeleton className="h-4 w-20 bg-neutral-200" />}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: 10 }).map((_, i) => (
                                    <tr key={i} className="border-b border-neutral-100">
                                        {columns.map((_, colIndex) => (
                                            <td key={colIndex} className={cn(
                                                "p-3",
                                                isCompact ? "p-1" : "p-3"
                                            )}>
                                                <Skeleton className="h-4 w-full bg-neutral-100" />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }
    if (error) return <div>Error loading data {JSON.stringify(error)}</div>;
    if (!data) return null;
    if (!table) return <DashboardLoader />;

    return (
        <div className={`h-auto w-full ${className}`}>
            {/* Resizing indicator */}
            {table?.getState?.()?.columnSizingInfo?.isResizingColumn && (
                <div className="absolute left-0 top-0 z-20 h-1 w-full bg-primary-200">
                    <div className="h-full bg-primary-500 transition-all duration-150 ease-out" />
                </div>
            )}

            <div className="relative w-full rounded-lg border">
                <div
                    className="max-h-[70vh] overflow-auto"
                    style={{
                        WebkitOverflowScrolling: 'touch',
                        transform: 'translate3d(0, 0, 0)',
                        WebkitTransform: 'translate3d(0, 0, 0)',
                        willChange: 'scroll-position',
                        isolation: 'isolate',
                    }}
                >
                    <table
                        className="w-full caption-bottom text-sm"
                        style={{
                            width: table?.getCenterTotalSize?.() || 'auto',
                            minWidth: table?.getCenterTotalSize?.() || '100%',
                            transform: 'translate3d(0, 0, 0)',
                            WebkitTransform: 'translate3d(0, 0, 0)',
                            borderCollapse: 'collapse',
                            tableLayout: 'fixed',
                        }}
                    >
                        <thead
                            className={cn(
                                "sticky top-0 z-30 border-b border-neutral-300 bg-primary-50 shadow-sm [&_tr]:border-b",
                                isCompact ? "text-xs" : "text-sm"
                            )}
                            style={{
                                transform: 'translate3d(0, 0, 0)',
                                WebkitTransform: 'translate3d(0, 0, 0)',
                                backfaceVisibility: 'hidden',
                                WebkitBackfaceVisibility: 'hidden',
                            }}
                        >
                            {table &&
                                table?.getHeaderGroups()?.length > 0 &&
                                table?.getHeaderGroups()?.map((headerGroup) => (
                                    <tr
                                        key={headerGroup.id}
                                        className="border-b transition-colors hover:bg-primary-200"
                                    >
                                        {/* Left pinned headers */}
                                        {headerGroup.headers
                                            .filter(
                                                (header) => header.column.getIsPinned() === 'left'
                                            )
                                            .map((header) => (
                                                <th
                                                    key={header.id}
                                                    className={cn(
                                                        "sticky left-0 z-40 overflow-visible border-r border-primary-200 bg-primary-50 text-left align-middle font-semibold text-neutral-700",
                                                        // Compact vs Default styles
                                                        isCompact
                                                            ? "h-8 p-1 px-2 text-xs"
                                                            : "h-14 p-4 text-subtitle",
                                                        columnWidths?.[header.column.id] || ''
                                                    )}
                                                    style={{
                                                        width: header?.getSize?.(),
                                                        minWidth:
                                                            header?.column?.columnDef?.minSize ||
                                                            minColumnWidth,
                                                        maxWidth:
                                                            header?.column?.columnDef?.maxSize ||
                                                            maxColumnWidth,
                                                        left: `${header.column.getStart('left')}px`,
                                                        position: 'sticky',
                                                        transform: 'translate3d(0, 0, 0)',
                                                        WebkitTransform: 'translate3d(0, 0, 0)',
                                                        backfaceVisibility: 'hidden',
                                                        WebkitBackfaceVisibility: 'hidden',
                                                    }}
                                                    onClick={(e) => {
                                                        // Prevent click when resizing
                                                        if (header?.column?.getIsResizing?.()) {
                                                            e.preventDefault();
                                                            return;
                                                        }
                                                        if (onHeaderClick) {
                                                            onHeaderClick();
                                                        }
                                                    }}
                                                >
                                                    <div className="flex h-full items-center justify-between">
                                                        <div className="flex-1">
                                                            {header.isPlaceholder
                                                                ? null
                                                                : flexRender(
                                                                    header.column.columnDef
                                                                        .header,
                                                                    header.getContext()
                                                                )}
                                                        </div>
                                                        {header?.column?.getCanResize?.() && (
                                                            <ResizeHandle
                                                                header={header}
                                                                table={table}
                                                            />
                                                        )}
                                                    </div>
                                                </th>
                                            ))}

                                        {/* Regular headers */}
                                        {headerGroup.headers
                                            .filter((header) => !header.column.getIsPinned())
                                            .map((header) => (
                                                <th
                                                    key={header.id}
                                                    className={cn(
                                                        "relative overflow-visible border-r border-primary-200 bg-primary-50 text-left align-middle font-semibold text-neutral-700",
                                                        // Compact vs Default styles
                                                        isCompact
                                                            ? "h-8 p-1 px-2 text-xs"
                                                            : "h-14 p-4 text-subtitle",
                                                        columnWidths?.[header.column.id] || ''
                                                    )}
                                                    style={{
                                                        width: header?.getSize?.(),
                                                        minWidth:
                                                            header?.column?.columnDef?.minSize ||
                                                            minColumnWidth,
                                                        maxWidth:
                                                            header?.column?.columnDef?.maxSize ||
                                                            maxColumnWidth,
                                                        position: 'relative',
                                                        transform: 'translate3d(0, 0, 0)',
                                                        WebkitTransform: 'translate3d(0, 0, 0)',
                                                        backfaceVisibility: 'hidden',
                                                        WebkitBackfaceVisibility: 'hidden',
                                                    }}
                                                    onClick={(e) => {
                                                        // Prevent click when resizing
                                                        if (header?.column?.getIsResizing?.()) {
                                                            e.preventDefault();
                                                            return;
                                                        }
                                                        if (onHeaderClick) {
                                                            onHeaderClick();
                                                        }
                                                    }}
                                                >
                                                    <div className="flex h-full items-center justify-between">
                                                        <div className="flex-1">
                                                            {header.isPlaceholder
                                                                ? null
                                                                : flexRender(
                                                                    header.column.columnDef
                                                                        .header,
                                                                    header.getContext()
                                                                )}
                                                        </div>
                                                        {header?.column?.getCanResize?.() && (
                                                            <ResizeHandle
                                                                header={header}
                                                                table={table}
                                                            />
                                                        )}
                                                    </div>
                                                </th>
                                            ))}
                                    </tr>
                                ))}
                        </thead>
                        <tbody
                            className="[&_tr:last-child]:border-0"
                            style={{
                                transform: 'translate3d(0, 0, 0)',
                                WebkitTransform: 'translate3d(0, 0, 0)',
                                backfaceVisibility: 'hidden',
                                WebkitBackfaceVisibility: 'hidden',
                            }}
                        >
                            {table.getRowModel().rows.map((row) => (
                                <tr
                                    key={row.id}
                                    className="cursor-pointer border-b transition-colors hover:bg-white data-[state=selected]:bg-muted"
                                    style={{
                                        transform: 'translate3d(0, 0, 0)',
                                        WebkitTransform: 'translate3d(0, 0, 0)',
                                        backfaceVisibility: 'hidden',
                                        WebkitBackfaceVisibility: 'hidden',
                                    }}
                                >
                                    {/* Left pinned cells */}
                                    {row.getLeftVisibleCells().map((cell) => (
                                        <td
                                            key={cell.id}
                                            className={cn(
                                                "sticky left-0 z-30 border-r-2 border-neutral-200 bg-white align-middle font-regular text-neutral-600",
                                                // Compact vs Default styles
                                                isCompact
                                                    ? "p-1 text-xs"
                                                    : "p-2 text-body", // Default was p-3 (from cellCommonCss) then p-2 override. Using p-2 for consistency with active.
                                                columnWidths?.[cell.column.id] || ''
                                            )}
                                            style={{
                                                width: cell?.column?.getSize?.(),
                                                minWidth:
                                                    cell?.column?.columnDef?.minSize ||
                                                    minColumnWidth,
                                                maxWidth:
                                                    cell?.column?.columnDef?.maxSize ||
                                                    maxColumnWidth,
                                                left: `${cell.column.getStart('left')}px`,
                                                position: 'sticky',
                                                transform: 'translate3d(0, 0, 0)',
                                                WebkitTransform: 'translate3d(0, 0, 0)',
                                                backfaceVisibility: 'hidden',
                                                WebkitBackfaceVisibility: 'hidden',
                                            }}
                                            onClick={() => {
                                                if (onCellClick) {
                                                    onCellClick(
                                                        row.original,
                                                        cell.column.columnDef
                                                    );
                                                }
                                            }}
                                        >
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </td>
                                    ))}

                                    {/* Regular cells */}
                                    {row.getCenterVisibleCells().map((cell) => (
                                        <td
                                            key={cell.id}
                                            className={cn(
                                                "z-10 bg-white align-middle font-regular text-neutral-600",
                                                // Compact vs Default styles
                                                isCompact
                                                    ? "p-1 text-xs"
                                                    : "p-2 text-body",
                                                columnWidths?.[cell.column.id] || ''
                                            )}
                                            style={{
                                                width: cell?.column?.getSize?.(),
                                                minWidth:
                                                    cell?.column?.columnDef?.minSize ||
                                                    minColumnWidth,
                                                maxWidth:
                                                    cell?.column?.columnDef?.maxSize ||
                                                    maxColumnWidth,
                                                transform: 'translate3d(0, 0, 0)',
                                                WebkitTransform: 'translate3d(0, 0, 0)',
                                                backfaceVisibility: 'hidden',
                                                WebkitBackfaceVisibility: 'hidden',
                                            }}
                                            onClick={() => {
                                                if (onCellClick) {
                                                    onCellClick(
                                                        row.original,
                                                        cell.column.columnDef
                                                    );
                                                }
                                            }}
                                        >
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
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
