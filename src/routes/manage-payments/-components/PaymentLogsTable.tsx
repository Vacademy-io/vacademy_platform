import { useMemo, useState, useCallback, createContext, useContext } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { MyTable, TableData } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import type { PaymentLogEntry, PaymentLogsResponse } from '@/types/payment-logs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { formatDistanceToNow } from 'date-fns';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { PencilSimple, FloppyDisk, X } from '@phosphor-icons/react';
import { updatePaymentLogTracking } from '@/services/payment-logs';
import { useToast } from '@/hooks/use-toast';

// ─── Order Status Constants ───────────────────────────────────────────────────

const ORDER_STATUS_OPTIONS = [
    { value: 'ORDERED', label: 'Ordered' },
    { value: 'PREPARING_TO_SHIP', label: 'Preparing to Ship' },
    { value: 'SHIPPED', label: 'Shipped' },
    { value: 'IN_TRANSIT', label: 'In Transit' },
    { value: 'DELIVERED', label: 'Delivered' },
] as const;

const ORDER_STATUS_LABEL_MAP: Record<string, string> = Object.fromEntries(
    ORDER_STATUS_OPTIONS.map((o) => [o.value, o.label])
);

const ORDER_STATUS_COLOR_MAP: Record<string, string> = {
    ORDERED: 'bg-gray-100 text-gray-700 border-gray-300',
    PREPARING_TO_SHIP: 'bg-amber-50 text-amber-700 border-amber-300',
    SHIPPED: 'bg-blue-50 text-blue-700 border-blue-300',
    IN_TRANSIT: 'bg-orange-50 text-orange-700 border-orange-300',
    DELIVERED: 'bg-green-50 text-green-700 border-green-300',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentLogsTableProps {
    data: PaymentLogsResponse | undefined;
    isLoading: boolean;
    error: unknown;
    currentPage: number;
    onPageChange: (page: number) => void;
    packageSessions?: Record<string, string>;
    hasOrgAssociatedBatches: boolean;
    hideUserColumn?: boolean;
    onRefresh?: () => void;
}

interface EditingState {
    rowId: string;
    trackingId: string;
    trackingSource: string;
    orderStatus: string;
    isSaving: boolean;
}

// ─── Editing Context ──────────────────────────────────────────────────────────
// Cell components consume this context to read/write editing state.
// Because the cells are separate React components, they re-render independently
// when context changes — WITHOUT the column definitions needing to change.

interface EditingContextType {
    editing: EditingState | null;
    setEditing: (state: EditingState | null) => void;
    onSave: (entry: PaymentLogEntry) => void;
    onStartEdit: (entry: PaymentLogEntry) => void;
    onCancel: () => void;
}

const EditingContext = createContext<EditingContextType>({
    editing: null,
    setEditing: () => {},
    onSave: () => {},
    onStartEdit: () => {},
    onCancel: () => {},
});

// ─── Editable Cell Components ─────────────────────────────────────────────────
// These are standalone React components rendered inside column cells.
// They use useContext(EditingContext) so they re-render when editing state
// changes, but the column definitions themselves stay stable.

function TrackingIdCell({ entry }: { entry: PaymentLogEntry }) {
    const { editing, setEditing } = useContext(EditingContext);
    const isEditing = editing?.rowId === entry.payment_log.id;

    if (isEditing && editing) {
        return (
            <Input
                value={editing.trackingId}
                onChange={(e) =>
                    setEditing({ ...editing, trackingId: e.target.value })
                }
                placeholder="Enter tracking ID"
                className="h-8 text-xs"
                disabled={editing.isSaving}
            />
        );
    }

    return (
        <div className="font-mono text-xs text-gray-600">
            {entry.payment_log.tracking_id || '—'}
        </div>
    );
}

function TrackingSourceCell({ entry }: { entry: PaymentLogEntry }) {
    const { editing, setEditing } = useContext(EditingContext);
    const isEditing = editing?.rowId === entry.payment_log.id;

    if (isEditing && editing) {
        return (
            <Input
                value={editing.trackingSource}
                onChange={(e) =>
                    setEditing({ ...editing, trackingSource: e.target.value })
                }
                placeholder="Enter source"
                className="h-8 text-xs"
                disabled={editing.isSaving}
            />
        );
    }

    return (
        <div className="text-xs text-gray-600">
            {entry.payment_log.tracking_source || '—'}
        </div>
    );
}

function OrderStatusCell({ entry }: { entry: PaymentLogEntry }) {
    const { editing, setEditing } = useContext(EditingContext);
    const isEditing = editing?.rowId === entry.payment_log.id;

    if (isEditing && editing) {
        return (
            <Select
                value={editing.orderStatus}
                onValueChange={(val) =>
                    setEditing({ ...editing, orderStatus: val })
                }
                disabled={editing.isSaving}
            >
                <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                    {ORDER_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        );
    }

    const status = entry.payment_log.order_status;
    if (!status) {
        return <span className="text-xs text-gray-400">—</span>;
    }

    const colorClasses =
        ORDER_STATUS_COLOR_MAP[status] || 'bg-gray-100 text-gray-700 border-gray-300';
    const label = ORDER_STATUS_LABEL_MAP[status] || status.replace(/_/g, ' ');

    return (
        <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colorClasses}`}
        >
            {label}
        </span>
    );
}

function ActionsCell({ entry }: { entry: PaymentLogEntry }) {
    const { editing, onSave, onStartEdit, onCancel } = useContext(EditingContext);
    const isPaid = entry.current_payment_status === 'PAID';
    const isEditing = editing?.rowId === entry.payment_log.id;

    if (!isPaid) {
        return <span className="text-xs text-gray-300">—</span>;
    }

    if (isEditing && editing) {
        return (
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-green-600 hover:bg-green-50 hover:text-green-700"
                    onClick={() => onSave(entry)}
                    disabled={editing.isSaving}
                    title="Save"
                >
                    <FloppyDisk size={16} weight="bold" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    onClick={onCancel}
                    disabled={editing.isSaving}
                    title="Cancel"
                >
                    <X size={16} weight="bold" />
                </Button>
            </div>
        );
    }

    return (
        <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            onClick={() => onStartEdit(entry)}
            title="Edit tracking info"
        >
            <PencilSimple size={16} />
        </Button>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getStatusBadgeVariant = (
    status: string
): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
        case 'PAID':
            return 'default';
        case 'FAILED':
            return 'destructive';
        case 'PAYMENT_PENDING':
            return 'secondary';
        case 'NOT_INITIATED':
            return 'outline';
        default:
            return 'secondary';
    }
};

const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD',
    }).format(amount);
};

const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const formatRelativeTime = (dateString: string) => {
    if (!dateString) return '-';
    try {
        return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
        return '-';
    }
};

// ─── Static Columns (defined outside component — never recreated) ─────────

const trackingIdColumn: ColumnDef<PaymentLogEntry> = {
    id: 'tracking_id',
    header: 'Tracking ID',
    accessorFn: (row) => row?.payment_log?.tracking_id || '',
    cell: ({ row }) => <TrackingIdCell entry={row.original} />,
    size: 150,
};

const trackingSourceColumn: ColumnDef<PaymentLogEntry> = {
    id: 'tracking_source',
    header: 'Tracking Source',
    accessorFn: (row) => row?.payment_log?.tracking_source || '',
    cell: ({ row }) => <TrackingSourceCell entry={row.original} />,
    size: 140,
};

const orderStatusColumn: ColumnDef<PaymentLogEntry> = {
    id: 'order_status',
    header: 'Order Status',
    accessorFn: (row) => row?.payment_log?.order_status || '',
    cell: ({ row }) => <OrderStatusCell entry={row.original} />,
    size: 160,
};

const actionsColumn: ColumnDef<PaymentLogEntry> = {
    id: 'tracking_actions',
    header: 'Actions',
    cell: ({ row }) => <ActionsCell entry={row.original} />,
    size: 80,
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function PaymentLogsTable({
    data,
    isLoading,
    error,
    currentPage,
    onPageChange,
    hasOrgAssociatedBatches,
    hideUserColumn = false,
    onRefresh,
}: PaymentLogsTableProps) {
    const { toast } = useToast();
    const [editing, setEditing] = useState<EditingState | null>(null);

    const onStartEdit = useCallback((entry: PaymentLogEntry) => {
        setEditing({
            rowId: entry.payment_log.id,
            trackingId: entry.payment_log.tracking_id || '',
            trackingSource: entry.payment_log.tracking_source || '',
            orderStatus: entry.payment_log.order_status || '',
            isSaving: false,
        });
    }, []);

    const onCancel = useCallback(() => {
        setEditing(null);
    }, []);

    const onSave = useCallback(
        async (entry: PaymentLogEntry) => {
            // Read latest editing state directly — no stale closures
            setEditing((currentEditing) => {
                if (!currentEditing) return null;

                const originalTrackingId = entry.payment_log.tracking_id || '';
                const originalTrackingSource = entry.payment_log.tracking_source || '';
                const originalOrderStatus = entry.payment_log.order_status || '';

                const hasChanges =
                    currentEditing.trackingId !== originalTrackingId ||
                    currentEditing.trackingSource !== originalTrackingSource ||
                    currentEditing.orderStatus !== originalOrderStatus;

                if (!hasChanges) {
                    return null; // exit edit mode
                }

                // Validate — only order status is required (tracking info can be added later)
                if (!currentEditing.orderStatus) {
                    toast({
                        title: 'Validation Error',
                        description: 'Order Status must be selected.',
                        variant: 'destructive',
                    });
                    return currentEditing;
                }

                // Fire the API call (async, outside the setState)
                const doSave = async () => {
                    try {
                        await updatePaymentLogTracking({
                            payment_log_id: entry.payment_log.id,
                            tracking_id: currentEditing.trackingId.trim(),
                            tracking_source: currentEditing.trackingSource.trim(),
                            order_status: currentEditing.orderStatus,
                        });

                        toast({
                            title: 'Success',
                            description: 'Tracking info updated successfully.',
                        });

                        setEditing(null);
                        onRefresh?.();
                    } catch (err: unknown) {
                        const message =
                            err instanceof Error
                                ? err.message
                                : 'Failed to update tracking info.';
                        toast({
                            title: 'Error',
                            description: message,
                            variant: 'destructive',
                        });
                        setEditing((prev) =>
                            prev ? { ...prev, isSaving: false } : null
                        );
                    }
                };

                doSave();

                // Set isSaving immediately
                return { ...currentEditing, isSaving: true };
            });
        },
        [toast, onRefresh]
    );

    // Context value — cell components consume this
    const editingContextValue = useMemo<EditingContextType>(
        () => ({ editing, setEditing, onSave, onStartEdit, onCancel }),
        [editing, onSave, onStartEdit, onCancel]
    );

    // Transform API response to TableData format
    const tableData: TableData<PaymentLogEntry> | undefined = useMemo(() => {
        if (!data) return undefined;
        return {
            content: data.content,
            total_pages: data.totalPages,
            page_no: data.number,
            page_size: data.size,
            total_elements: data.totalElements,
            last: data.last,
        };
    }, [data]);

    // Columns — only depends on layout flags, NOT editing state
    const columns = useMemo<ColumnDef<PaymentLogEntry>[]>(
        () => [
            {
                id: 'payment_date',
                header: 'Date & Time',
                accessorFn: (row) => row?.payment_log?.date || '',
                cell: ({ row }) => {
                    const date = row.original?.payment_log?.date;
                    return (
                        <div className="space-y-1">
                            <div className="font-medium text-gray-900">{formatDate(date)}</div>
                            <div className="text-xs text-gray-500">{formatRelativeTime(date)}</div>
                        </div>
                    );
                },
                size: 180,
            },
            ...(!hideUserColumn
                ? [
                      {
                          id: 'user_info',
                          header: 'User',
                          accessorFn: (row: PaymentLogEntry) =>
                              row?.user?.full_name || row?.user?.email || '',
                          cell: ({ row }: { row: { original: PaymentLogEntry } }) => {
                              const user = row.original?.user;
                              return (
                                  <div className="space-y-1">
                                      <div className="font-medium text-gray-900">
                                          {user?.full_name || '-'}
                                      </div>
                                      <div className="text-xs text-gray-500">{user?.email || '-'}</div>
                                  </div>
                              );
                          },
                          size: 200,
                      } as ColumnDef<PaymentLogEntry>,
                  ]
                : []),
            ...(hasOrgAssociatedBatches
                ? [
                      {
                          id: 'org_name',
                          header: 'Organization Name',
                          accessorFn: (row: PaymentLogEntry) =>
                              row?.user_plan?.sub_org_details?.name || '',
                          cell: ({ row }: { row: { original: PaymentLogEntry } }) => {
                              const userPlan = row.original?.user_plan;
                              const source = userPlan?.source;
                              const orgDetails = userPlan?.sub_org_details;

                              if (source === 'SUB_ORG') {
                                  if (orgDetails?.name) {
                                      return (
                                          <div className="space-y-1">
                                              <div className="font-medium text-gray-900">
                                                  {orgDetails.name}
                                              </div>
                                              {orgDetails.address && (
                                                  <div className="text-xs text-gray-500">
                                                      {orgDetails.address}
                                                  </div>
                                              )}
                                          </div>
                                      );
                                  }
                              }
                              return (
                                  <div className="text-xs text-gray-500 italic">N/A</div>
                              );
                          },
                          size: 200,
                      } as ColumnDef<PaymentLogEntry>,
                  ]
                : []),
            {
                id: 'amount',
                header: 'Amount',
                accessorFn: (row) => row?.payment_log?.payment_amount || 0,
                cell: ({ row }) => {
                    const amount = row.original?.payment_log?.payment_amount || 0;
                    const currency = row.original?.payment_log?.currency || 'USD';
                    return (
                        <div className="font-semibold text-gray-900">
                            {formatCurrency(amount, currency)}
                        </div>
                    );
                },
                size: 130,
            },
            {
                id: 'current_payment_status',
                header: 'Payment Status',
                accessorFn: (row) => row?.current_payment_status || '',
                cell: ({ row }) => {
                    const status = row.original?.current_payment_status;
                    return (
                        <Badge variant={getStatusBadgeVariant(status)} className="font-medium">
                            {status?.replace(/_/g, ' ') || '-'}
                        </Badge>
                    );
                },
                size: 140,
            },
            {
                id: 'vendor',
                header: 'Payment Method',
                accessorFn: (row) => row?.payment_log?.vendor || '',
                cell: ({ row }) => {
                    const vendor = row.original?.payment_log?.vendor;
                    return (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-700">{vendor || '-'}</span>
                        </div>
                    );
                },
                size: 140,
            },
            {
                id: 'user_plan_status',
                header: 'Plan Status',
                accessorFn: (row) => row?.user_plan?.status || '',
                cell: ({ row }) => {
                    const status = row.original?.user_plan?.status;
                    return (
                        <Badge variant="outline" className="font-normal">
                            {status?.replace(/_/g, ' ') || '-'}
                        </Badge>
                    );
                },
                size: 130,
            },
            {
                id: 'enroll_invite',
                header: 'Course/Membership',
                accessorFn: (row) => row?.user_plan?.enroll_invite?.name || '',
                cell: ({ row }) => {
                    const enrollInvite = row.original?.user_plan?.enroll_invite;
                    return (
                        <div className="space-y-1">
                            <div className="font-medium text-gray-900">
                                {enrollInvite?.name || '-'}
                            </div>
                            <div className="text-xs text-gray-500">
                                Code: {enrollInvite?.invite_code || '-'}
                            </div>
                        </div>
                    );
                },
                size: 200,
            },
            {
                id: 'transaction_id',
                header: 'Transaction ID',
                accessorFn: (row) => row?.payment_log?.transaction_id || '',
                cell: ({ row }) => {
                    const transactionId = row.original?.payment_log?.transaction_id;
                    return (
                        <div className="font-mono text-xs text-gray-500">
                            {transactionId || '-'}
                        </div>
                    );
                },
                size: 140,
            },

            // ─── Tracking columns (rendered by context-aware components) ────
            trackingIdColumn,
            trackingSourceColumn,
            orderStatusColumn,
            actionsColumn,

            {
                id: 'payment_plan',
                header: 'Payment Plan',
                accessorFn: (row) => row?.user_plan?.payment_plan_dto?.name || '',
                cell: ({ row }) => {
                    const paymentPlan = row.original?.user_plan?.payment_plan_dto;
                    return (
                        <div className="space-y-1">
                            <div className="text-sm text-gray-900">{paymentPlan?.name || '-'}</div>
                            <div className="text-xs text-gray-500">
                                {paymentPlan?.validity_in_days
                                    ? `${paymentPlan.validity_in_days} days`
                                    : ''}
                            </div>
                        </div>
                    );
                },
                size: 180,
            },
        ],
        [hasOrgAssociatedBatches, hideUserColumn]
    );

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <DashboardLoader />
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
                <p className="text-red-800">Error loading payment logs</p>
                <p className="mt-2 text-sm text-red-600">
                    {error instanceof Error ? error.message : 'Unknown error occurred'}
                </p>
            </div>
        );
    }

    if (!tableData) {
        return null;
    }

    if (tableData.content.length === 0) {
        return (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
                <p className="text-lg font-medium text-gray-600">No payment records found</p>
                <p className="mt-2 text-sm text-gray-500">
                    Try adjusting your filters to see more results
                </p>
            </div>
        );
    }

    return (
        <EditingContext.Provider value={editingContextValue}>
            <div className="space-y-4">
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                    <MyTable
                        data={tableData}
                        columns={columns}
                        isLoading={false}
                        error={null}
                        currentPage={currentPage}
                        scrollable={true}
                        enableColumnResizing={true}
                        enableColumnPinning={false}
                    />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                    <div className="text-sm text-gray-600">
                        Showing {tableData.page_no * tableData.page_size + 1} -{' '}
                        {Math.min(
                            (tableData.page_no + 1) * tableData.page_size,
                            tableData.total_elements
                        )}{' '}
                        of {tableData.total_elements} payments
                    </div>
                    <MyPagination
                        currentPage={currentPage}
                        totalPages={tableData.total_pages}
                        onPageChange={onPageChange}
                    />
                </div>
            </div>
        </EditingContext.Provider>
    );
}
