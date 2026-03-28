import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getInstituteId } from "@/constants/helper";
import { getUserId } from "@/constants/getUserId";
import { BASE_URL } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { cn } from "@/lib/utils";
import { ShoppingBag, ChevronLeft, ChevronRight, Package } from "lucide-react";

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
    };
    current_payment_status: string;
    user: {
        id: string;
        full_name: string;
    };
}

const PAYMENT_LOGS_URL = `${BASE_URL}/admin-core-service/v1/user-plan/payment-logs`;

const ORDER_STATUS_STYLES: Record<string, string> = {
    ORDERED: "bg-gray-100 text-gray-700",
    PREPARING_TO_SHIP: "bg-amber-50 text-amber-700",
    SHIPPED: "bg-blue-50 text-blue-700",
    IN_TRANSIT: "bg-orange-50 text-orange-700",
    DELIVERED: "bg-green-50 text-green-700",
};

const ORDER_STATUS_LABELS: Record<string, string> = {
    ORDERED: "Ordered",
    PREPARING_TO_SHIP: "Preparing to Ship",
    SHIPPED: "Shipped",
    IN_TRANSIT: "In Transit",
    DELIVERED: "Delivered",
};

const PAYMENT_STATUS_STYLES: Record<string, string> = {
    PAID: "bg-green-50 text-green-700",
    FAILED: "bg-red-50 text-red-700",
    PAYMENT_PENDING: "bg-yellow-50 text-yellow-700",
    NOT_INITIATED: "bg-gray-100 text-gray-600",
    PENDING: "bg-yellow-50 text-yellow-700",
};

const StatusBadge = ({ label, styles }: { label: string; styles: Record<string, string> }) => {
    const normalized = label.replace(/_/g, " ");
    return (
        <Badge
            variant="outline"
            className={cn(
                "text-[9px] px-1.5 py-0 h-4 font-semibold border-0 whitespace-nowrap",
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
            <td className="py-2 px-3 text-xs font-medium text-foreground max-w-[180px] truncate">
                {getBookName(entry)}
            </td>
            <td className="py-2 px-3 text-[10px] text-muted-foreground whitespace-nowrap">
                {storeName || "—"}
            </td>
            <td className="py-2 px-3 text-[10px] text-muted-foreground whitespace-nowrap">
                {formatDate(log.date)}
            </td>
            <td className="py-2 px-3">
                {paymentStatus ? <StatusBadge label={paymentStatus} styles={PAYMENT_STATUS_STYLES} /> : "—"}
            </td>
            <td className="py-2 px-3">
                {orderStatus ? <StatusBadge label={orderStatus} styles={ORDER_STATUS_STYLES} /> : "—"}
            </td>
            <td className="py-2 px-3 text-[10px] text-muted-foreground font-mono truncate max-w-[140px]">
                {log.tracking_id || <span className="italic text-muted-foreground/70 font-sans">Expected in 5-7 days</span>}
            </td>
            <td className="py-2 px-3 text-[10px] text-muted-foreground whitespace-nowrap">
                {log.tracking_source || "—"}
            </td>
            <td className="py-2 px-3 text-[10px] text-muted-foreground font-mono truncate max-w-[160px]">
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
                            <p className="text-[9px] text-muted-foreground truncate leading-none mt-0.5">
                                {storeName}
                            </p>
                        )}
                    </div>
                </div>
                <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                    {formatDate(log.date)}
                </span>
            </div>

            {/* Status badges */}
            <div className="flex items-center gap-1.5 flex-wrap ml-9">
                {paymentStatus && <StatusBadge label={paymentStatus} styles={PAYMENT_STATUS_STYLES} />}
                {orderStatus && <StatusBadge label={orderStatus} styles={ORDER_STATUS_STYLES} />}
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 ml-9 text-[9px]">
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
                                        <th className="py-2 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Book</th>
                                        <th className="py-2 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Store</th>
                                        <th className="py-2 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Date</th>
                                        <th className="py-2 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Payment</th>
                                        <th className="py-2 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Order Status</th>
                                        <th className="py-2 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tracking ID</th>
                                        <th className="py-2 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Source</th>
                                        <th className="py-2 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Transaction ID</th>
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
                        <p className="text-[11px] text-muted-foreground italic font-medium">
                            No orders found.
                        </p>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                        <span className="text-[9px] text-muted-foreground font-black uppercase tracking-tighter">
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
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 hover:bg-secondary"
                                disabled={page >= totalPages - 1 || loading}
                                onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
