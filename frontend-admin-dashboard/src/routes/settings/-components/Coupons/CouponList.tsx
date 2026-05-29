import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
    MagnifyingGlass,
    PencilSimple,
    Plus,
    Tag,
    TrashSimple,
    WarningCircle,
} from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { MyButton } from '@/components/design-system/button';
import { MyPagination } from '@/components/design-system/pagination';
import { StatusChip } from '@/components/design-system/status-chips';
import { cn } from '@/lib/utils';
import {
    CouponDetail,
    CouponStatus,
    CouponSummary,
    useCouponList,
    useDeleteCoupon,
} from '@/services/coupons';
import { getTerminologyPlural } from '@/components/common/layout-container/sidebar/utils';
import {
    RoleTerms,
    SystemTerms,
} from '@/routes/settings/-components/NamingSettings';

interface CouponListProps {
    onCreate: () => void;
    onEdit: (coupon: CouponSummary | CouponDetail) => void;
}

const PAGE_SIZE = 10;

const formatDiscount = (c: CouponSummary): string => {
    if (!c.discount_type) return '—';
    if (c.discount_type === 'PERCENTAGE') {
        const cap = c.max_discount_point ? `, max ₹${c.max_discount_point.toLocaleString()}` : '';
        return `${c.discount_point}%${cap}`;
    }
    return `₹${(c.discount_point ?? 0).toLocaleString()}`;
};

const formatValidity = (c: CouponSummary): string => {
    if (!c.redeem_end_date) return 'No expiry';
    const end = new Date(c.redeem_end_date).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
    return c.redeem_start_date
        ? `${new Date(c.redeem_start_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} → ${end}`
        : `until ${end}`;
};

const statusChipStatus = (status: CouponStatus): 'SUCCESS' | 'INFO' | 'DANGER' | 'WARNING' => {
    switch (status) {
        case 'ACTIVE':
            return 'SUCCESS';
        case 'INACTIVE':
            return 'WARNING';
        case 'DELETED':
            return 'DANGER';
        default:
            return 'INFO';
    }
};

const useDebounced = <T,>(value: T, delayMs = 300): T => {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(id);
    }, [value, delayMs]);
    return debounced;
};

export const CouponList = ({ onCreate, onEdit }: CouponListProps) => {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<'ALL' | CouponStatus>('ALL');
    const [page, setPage] = useState(0);

    const debouncedSearch = useDebounced(search, 300);

    const { data, isLoading, isError, error, refetch, isFetching } = useCouponList({
        search: debouncedSearch || undefined,
        status: status === 'ALL' ? undefined : [status],
        page,
        size: PAGE_SIZE,
    });

    const deleteMutation = useDeleteCoupon();

    const handleDelete = (coupon: CouponSummary) => {
        if (
            !window.confirm(
                `Delete coupon "${coupon.code}"? Existing redemptions are preserved; this only prevents new applications.`
            )
        ) {
            return;
        }
        deleteMutation.mutate(coupon.id, {
            onSuccess: () => toast.success(`Coupon "${coupon.code}" deleted`),
            onError: (e) => {
                const message =
                    (e as { response?: { data?: { message?: string } } })?.response?.data
                        ?.message ??
                    (e as Error).message ??
                    'Could not delete coupon';
                toast.error(message);
            },
        });
    };

    const rows = data?.content ?? [];
    const totalPages = data?.total_pages ?? 0;
    const hasFilters = !!debouncedSearch || status !== 'ALL';

    return (
        <div className="space-y-4">
            {/* Filter strip + create CTA */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative flex-1 sm:max-w-xs">
                        <MagnifyingGlass
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                        />
                        <Input
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(0);
                            }}
                            placeholder="Search by code"
                            className="pl-9"
                            aria-label="Search coupons by code"
                        />
                    </div>
                    <Select
                        value={status}
                        onValueChange={(v) => {
                            setStatus(v as 'ALL' | CouponStatus);
                            setPage(0);
                        }}
                    >
                        <SelectTrigger className="sm:w-48" aria-label="Filter by status">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All statuses</SelectItem>
                            <SelectItem value="ACTIVE">Active</SelectItem>
                            <SelectItem value="INACTIVE">Inactive</SelectItem>
                            <SelectItem value="DELETED">Deleted</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <MyButton buttonType="primary" scale="medium" onClick={onCreate}>
                    <Plus size={16} />
                    Create coupon
                </MyButton>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                {isLoading ? (
                    <SkeletonRows />
                ) : isError ? (
                    <ErrorState
                        message={(error as Error)?.message ?? 'Could not load coupons'}
                        onRetry={() => refetch()}
                    />
                ) : rows.length === 0 ? (
                    <EmptyState hasFilters={hasFilters} onCreate={onCreate} />
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Code</TableHead>
                                <TableHead>Discount</TableHead>
                                <TableHead>Validity</TableHead>
                                <TableHead>Usage</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((c) => (
                                <TableRow key={c.id} className={cn(isFetching && 'opacity-60')}>
                                    <TableCell>
                                        <span className="rounded bg-primary-50 px-2 py-0.5 font-mono text-caption font-semibold text-primary-700">
                                            {c.code}
                                        </span>
                                        {c.source_type === 'PRODUCT_PAGE' && (
                                            <span className="ml-2 text-caption text-neutral-400">
                                                product page
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-body text-neutral-700">
                                        {formatDiscount(c)}
                                    </TableCell>
                                    <TableCell className="text-caption text-neutral-600">
                                        {formatValidity(c)}
                                    </TableCell>
                                    <TableCell className="text-body text-neutral-700">
                                        {c.usage_count} / {c.usage_limit ?? '∞'}
                                    </TableCell>
                                    <TableCell>
                                        <StatusChip
                                            text={c.status}
                                            textSize="text-caption"
                                            status={statusChipStatus(c.status)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="inline-flex gap-1">
                                            <MyButton
                                                buttonType="secondary"
                                                scale="small"
                                                layoutVariant="icon"
                                                onClick={() => onEdit(c)}
                                                disable={c.status === 'DELETED'}
                                            >
                                                <PencilSimple size={14} />
                                            </MyButton>
                                            <MyButton
                                                buttonType="secondary"
                                                scale="small"
                                                layoutVariant="icon"
                                                onClick={() => handleDelete(c)}
                                                disable={
                                                    c.status === 'DELETED' ||
                                                    deleteMutation.isPending
                                                }
                                            >
                                                <TrashSimple
                                                    size={14}
                                                    className="text-danger-500"
                                                />
                                            </MyButton>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>

            {totalPages > 1 && (
                <MyPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            )}
        </div>
    );
};

const SkeletonRows = () => (
    <div className="space-y-2 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-neutral-100" />
        ))}
    </div>
);

const EmptyState = ({ hasFilters, onCreate }: { hasFilters: boolean; onCreate: () => void }) => {
    const learnerPlural = getTerminologyPlural(RoleTerms.Learner, SystemTerms.Learner);
    return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <Tag size={36} className="mb-3 text-neutral-300" />
        <h3 className="text-subtitle font-semibold text-neutral-700">
            {hasFilters ? 'No coupons match these filters' : 'No coupons yet'}
        </h3>
        <p className="mt-1 max-w-sm text-caption text-neutral-500">
            {hasFilters
                ? 'Try clearing the search or status filter.'
                : `Create a coupon to let ${learnerPlural.toLowerCase()} apply a discount at checkout.`}
        </p>
        {!hasFilters && (
            <MyButton buttonType="primary" scale="medium" onClick={onCreate} className="mt-4">
                <Plus size={16} />
                Create coupon
            </MyButton>
        )}
    </div>
    );
};

const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <WarningCircle size={36} className="mb-3 text-danger-500" />
        <h3 className="text-subtitle font-semibold text-neutral-700">Couldn&apos;t load coupons</h3>
        <p className="mt-1 max-w-md text-caption text-neutral-500">{message}</p>
        <MyButton buttonType="secondary" scale="medium" onClick={onRetry} className="mt-4">
            Try again
        </MyButton>
    </div>
);
