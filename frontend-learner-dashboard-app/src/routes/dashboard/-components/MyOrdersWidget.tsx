import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getInstituteId } from "@/constants/helper";
import { getUserId } from "@/constants/getUserId";
import { PAYMENT_LOGS_URL } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { cn } from "@/lib/utils";
import { ShoppingBag, CaretLeft, CaretRight, Package } from "@phosphor-icons/react";

interface MyOrdersWidgetProps {
    className?: string;
}

interface PaymentLogEntry {
    payment_log: {
        id: string;
        status: string;
        payment_status: string | null;
        date: string;
        payment_amount: number;
        currency: string;
        transaction_id?: string;
        tracking_id?: string | null;
        tracking_source?: string | null;
        order_status?: string | null;
    };
    user_plan: {
        id: string;
        status: string;
        enroll_invite: {
            id: string;
            name: string;
        } | null;
        payment_plan_dto: {
            name: string;
            validity_in_days: number;
            actual_price: number;
            currency: string;
        } | null;
        source?: string;
        sub_org_details?: {
            id: string;
            name: string;
        } | null;
        /** Snapshot persisted at enrollment time so we can show the discount even
         *  if the coupon definition later expires/changes. Optional — null when
         *  no coupon was applied. */
        applied_coupon_discount_id?: string | null;
        applied_coupon_discount_json?: string | null;
        /** Structured projection of the snapshot, populated by the BE
         *  (CouponSnapshotDTO). Prefer this over JSON.parse. Null when no
         *  coupon was applied or the BE build is older than the structured
         *  field rollout. */
        applied_coupon?: {
            coupon_code?: string | null;
            discount_type?: string | null;
            discount_point?: number | null;
            max_discount_point?: number | null;
            discount_source?: string | null;
        } | null;
    };
    current_payment_status: string;
    user: {
        id: string;
        full_name: string;
    };
}

const ORDER_STATUS_STYLES: Record<string, string> = {
    ORDERED: "bg-gray-100 text-gray-700",
    PREPARING_TO_SHIP: "bg-amber-50 text-amber-700",
    SHIPPED: "bg-blue-50 text-blue-700",
    IN_TRANSIT: "bg-orange-50 text-orange-700",
    DELIVERED: "bg-green-50 text-green-700",
};

const PAYMENT_STATUS_STYLES: Record<string, string> = {
    PAID: "bg-green-50 text-green-700",
    FAILED: "bg-red-50 text-red-700",
    PAYMENT_PENDING: "bg-yellow-50 text-yellow-700",
    NOT_INITIATED: "bg-gray-100 text-gray-600",
    PENDING: "bg-yellow-50 text-yellow-700",
};

interface RawCouponSnapshot {
    couponCode?: { code?: string } | null;
    coupon_code?: { code?: string } | null;
    name?: string;
}

/** Returns the code to show next to the price. Prefers the BE's structured
 *  {@code applied_coupon.coupon_code} field; falls back to parsing the raw
 *  JSON blob for older BE builds. Fail-closed: returns null when the snapshot
 *  is malformed or no coupon was applied. */
const getCouponCode = (entry: PaymentLogEntry): string | null => {
    const structured = entry.user_plan?.applied_coupon?.coupon_code;
    if (structured) return structured;
    const json = entry.user_plan?.applied_coupon_discount_json;
    if (!json || !entry.user_plan?.applied_coupon_discount_id) return null;
    try {
        const raw = JSON.parse(json) as RawCouponSnapshot;
        return raw.couponCode?.code || raw.coupon_code?.code || raw.name || null;
    } catch {
        return null;
    }
};

const getCurrencySymbol = (currency: string | undefined): string => {
    switch ((currency || "").toUpperCase()) {
        case "USD":
            return "$";
        case "EUR":
            return "€";
        case "GBP":
            return "£";
        case "INR":
            return "₹";
        case "JPY":
            return "¥";
        default:
            return currency || "";
    }
};

/** Inline "Paid ₹X · saved ₹Y with CODE" line. Shown when a coupon was used
 *  AND the list price exceeded the paid amount. The widget is otherwise
 *  shipping-focused but this is the only learner-side surface that has both
 *  the list price (UserPlan.payment_plan_dto.actual_price) and the paid
 *  amount (PaymentLog.payment_amount) in the same response. */
const PaidWithCouponInline = ({ entry }: { entry: PaymentLogEntry }) => {
    const code = getCouponCode(entry);
    const listPrice = entry.user_plan?.payment_plan_dto?.actual_price ?? 0;
    const paid = entry.payment_log?.payment_amount ?? 0;
    const currency = entry.user_plan?.payment_plan_dto?.currency || entry.payment_log?.currency;
    const symbol = getCurrencySymbol(currency);
    const saved = Math.max(0, listPrice - paid);
    if (paid <= 0 && !code) return null;
    return (
        <div className="text-caption text-muted-foreground mt-0.5 leading-tight">
            <span className="font-medium text-foreground">
                Paid {symbol}
                {paid.toLocaleString()}
            </span>
            {code && saved > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-green-700">
                    · saved {symbol}
                    {saved.toLocaleString()} with <span className="font-mono font-semibold">{code}</span>
                </span>
            )}
        </div>
    );
};

const StatusBadge = ({ label, styles }: { label: string; styles: Record<string, string> }) => {
    const normalized = label.replace(/_/g, " ");
    return (
        <Badge
            variant="outline"
            className={cn(
                "text-caption px-1.5 py-0 h-4 font-semibold border-0 whitespace-nowrap",
                styles[label] || "bg-gray-100 text-gray-600"
            )}
        >
            {normalized}
        </Badge>
    );
};

// ─── Desktop Table Row ────────────────────────────────────────────────────────

const OrderTableRow = ({
    entry,
    formatDate,
    getBookName,
    getStoreName,
}: {
    entry: PaymentLogEntry;
    formatDate: (d: string) => string;
    getBookName: (e: PaymentLogEntry) => string;
    getStoreName: (e: PaymentLogEntry) => string;
}) => {
    const log = entry.payment_log;
    const orderStatus = log.order_status || "";
    const paymentStatus = entry.current_payment_status || "";
    const storeName = getStoreName(entry);

    return (
        <tr className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
            <td className="py-2 px-3 max-w-44">
                <div className="text-xs font-medium text-foreground truncate">
                    {getBookName(entry)}
                </div>
                <PaidWithCouponInline entry={entry} />
            </td>
            <td className="py-2 px-3 text-caption text-muted-foreground whitespace-nowrap">
                {storeName || "—"}
            </td>
            <td className="py-2 px-3 text-caption text-muted-foreground whitespace-nowrap">
                {formatDate(log.date)}
            </td>
            <td className="py-2 px-3">
                {paymentStatus ? <StatusBadge label={paymentStatus} styles={PAYMENT_STATUS_STYLES} /> : "—"}
            </td>
            <td className="py-2 px-3">
                {orderStatus ? <StatusBadge label={orderStatus} styles={ORDER_STATUS_STYLES} /> : "—"}
            </td>
            <td className="py-2 px-3 text-caption text-muted-foreground font-mono truncate max-w-36">
                {log.tracking_id || <span className="italic text-muted-foreground/70 font-sans">Expected in 5-7 days</span>}
            </td>
            <td className="py-2 px-3 text-caption text-muted-foreground whitespace-nowrap">
                {log.tracking_source || "—"}
            </td>
            <td className="py-2 px-3 text-caption text-muted-foreground font-mono truncate max-w-40">
                {log.transaction_id || "—"}
            </td>
        </tr>
    );
};

// ─── Mobile Card ──────────────────────────────────────────────────────────────

const OrderCard = ({
    entry,
    formatDate,
    getBookName,
    getStoreName,
}: {
    entry: PaymentLogEntry;
    formatDate: (d: string) => string;
    getBookName: (e: PaymentLogEntry) => string;
    getStoreName: (e: PaymentLogEntry) => string;
}) => {
    const log = entry.payment_log;
    const orderStatus = log.order_status || "";
    const paymentStatus = entry.current_payment_status || "";
    const storeName = getStoreName(entry);

    return (
        <div className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-card hover:bg-secondary/20 transition-colors shadow-sm">
            {/* Header: Book name + date */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-md bg-primary/5 flex items-center justify-center flex-shrink-0">
                        <Package className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-foreground truncate leading-tight">
                            {getBookName(entry)}
                        </p>
                        {storeName && (
                            <p className="text-caption text-muted-foreground truncate leading-none mt-0.5">
                                {storeName}
                            </p>
                        )}
                        <PaidWithCouponInline entry={entry} />
                    </div>
                </div>
                <span className="text-caption text-muted-foreground whitespace-nowrap">
                    {formatDate(log.date)}
                </span>
            </div>

            {/* Status badges */}
            <div className="flex items-center gap-1.5 flex-wrap ml-9">
                {paymentStatus && <StatusBadge label={paymentStatus} styles={PAYMENT_STATUS_STYLES} />}
                {orderStatus && <StatusBadge label={orderStatus} styles={ORDER_STATUS_STYLES} />}
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 ml-9 text-caption">
                <span className="text-muted-foreground font-medium">Tracking ID</span>
                {log.tracking_id ? (
                    <span className="text-foreground font-mono truncate">{log.tracking_id}</span>
                ) : (
                    <span className="text-muted-foreground/70 italic">Expected in 5-7 days</span>
                )}
                {log.tracking_source && (
                    <>
                        <span className="text-muted-foreground font-medium">Tracking Source</span>
                        <span className="text-foreground">{log.tracking_source}</span>
                    </>
                )}
                {log.transaction_id && (
                    <>
                        <span className="text-muted-foreground font-medium">Transaction ID</span>
                        <span className="text-foreground font-mono truncate">{log.transaction_id}</span>
                    </>
                )}
            </div>
        </div>
    );
};

// ─── Main Widget ──────────────────────────────────────────────────────────────

export const MyOrdersWidget: React.FC<MyOrdersWidgetProps> = ({ className }) => {
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<PaymentLogEntry[]>([]);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const pageSize = 5;

    const fetchOrders = async (pageNo: number) => {
        try {
            setLoading(true);
            const instituteId = await getInstituteId();
            const userId = await getUserId();
            if (!instituteId || !userId) return;

            const response = await authenticatedAxiosInstance.post(
                PAYMENT_LOGS_URL,
                {
                    institute_id: instituteId,
                    user_id: userId,
                    sort_columns: { date: "DESC" },
                },
                {
                    params: { pageNo, pageSize },
                }
            );

            setOrders(response.data?.content || []);
            setTotalPages(response.data?.totalPages || 0);
            setTotalElements(response.data?.totalElements || 0);
        } catch {
            // Silently fail
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders(page);
    }, [page]);

    const getBookName = (entry: PaymentLogEntry): string => {
        return entry.user_plan?.enroll_invite?.name || "Unknown";
    };

    const getStoreName = (entry: PaymentLogEntry): string => {
        return entry.user_plan?.sub_org_details?.name || "";
    };

    const formatDate = (dateStr: string): string => {
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
            });
        } catch {
            return dateStr;
        }
    };

    if (loading && orders.length === 0) {
        return (
            <Card className={cn("border border-border shadow-sm bg-card", className)}>
                <CardHeader className="p-4 pb-2">
                    <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent className="p-4">
                    <div className="space-y-2">
                        <Skeleton className="h-16 w-full rounded-lg" />
                        <Skeleton className="h-16 w-full rounded-lg" />
                        <Skeleton className="h-16 w-full rounded-lg" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Settled and no orders: render nothing instead of an empty shell
    if (!loading && totalElements === 0) {
        return null;
    }

    return (
        <Card className={cn("border border-border shadow-sm bg-card", className)}>
            <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary uppercase">
                    <ShoppingBag className="w-5 h-5" />
                    My Orders
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                {orders.length > 0 ? (
                    <>
                        {/* Desktop: Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="py-2 px-3 text-caption font-bold text-muted-foreground uppercase tracking-wider">Book</th>
                                        <th className="py-2 px-3 text-caption font-bold text-muted-foreground uppercase tracking-wider">Store</th>
                                        <th className="py-2 px-3 text-caption font-bold text-muted-foreground uppercase tracking-wider">Date</th>
                                        <th className="py-2 px-3 text-caption font-bold text-muted-foreground uppercase tracking-wider">Payment</th>
                                        <th className="py-2 px-3 text-caption font-bold text-muted-foreground uppercase tracking-wider">Order Status</th>
                                        <th className="py-2 px-3 text-caption font-bold text-muted-foreground uppercase tracking-wider">Tracking ID</th>
                                        <th className="py-2 px-3 text-caption font-bold text-muted-foreground uppercase tracking-wider">Source</th>
                                        <th className="py-2 px-3 text-caption font-bold text-muted-foreground uppercase tracking-wider">Transaction ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map((entry, idx) => (
                                        <OrderTableRow
                                            key={entry.payment_log.id || idx}
                                            entry={entry}
                                            formatDate={formatDate}
                                            getBookName={getBookName}
                                            getStoreName={getStoreName}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile: Cards */}
                        <div className="md:hidden space-y-2">
                            {orders.map((entry, idx) => (
                                <OrderCard
                                    key={entry.payment_log.id || idx}
                                    entry={entry}
                                    formatDate={formatDate}
                                    getBookName={getBookName}
                                    getStoreName={getStoreName}
                                />
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="py-4 px-3 rounded-lg border border-dashed border-border flex flex-col items-center justify-center text-center bg-secondary/10">
                        <p className="text-caption text-muted-foreground italic font-medium">
                            No orders found.
                        </p>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                        <span className="text-caption text-muted-foreground font-black uppercase tracking-tighter">
                            {page + 1} / {totalPages}
                        </span>
                        <div className="flex gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 hover:bg-secondary"
                                disabled={page === 0 || loading}
                                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                            >
                                <CaretLeft className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 hover:bg-secondary"
                                disabled={page >= totalPages - 1 || loading}
                                onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
                            >
                                <CaretRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
