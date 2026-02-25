// ─────────────────────────────────────────────────────────────
// Payments Module — Fee breakdown, payment, receipts
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  ChildProfile,
  PaymentFeeItem,
  PaymentTransaction,
} from "@/types/parent-portal";
import {
  usePaymentSummary,
  usePaymentHistory,
  useInitiatePayment,
} from "@/hooks/use-parent-portal";
import { downloadReceipt } from "@/services/parent-portal/parent-api";
import { AdmissionPaymentSection } from "./AdmissionPaymentSection";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Receipt,
  CheckCircle,
  Clock,
  AlertTriangle,
  Download,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Loader2,
} from "lucide-react";

interface PaymentsModuleProps {
  child: ChildProfile;
}

export function PaymentsModule({ child }: PaymentsModuleProps) {
  const { data: summary, isLoading: loadingSummary } = usePaymentSummary(
    child.id,
  );
  const { data: history, isLoading: loadingHistory } = usePaymentHistory(
    child.id,
  );
  const paymentMutation = useInitiatePayment();
  const [selectedFees, setSelectedFees] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const isLoading = loadingSummary || loadingHistory;

  // Calculate selected total
  const selectedTotal =
    summary?.fee_items
      .filter((f) => selectedFees.includes(f.id))
      .reduce((sum, f) => sum + f.total, 0) ?? 0;

  const handleToggleFee = (feeId: string) => {
    setSelectedFees((prev) =>
      prev.includes(feeId)
        ? prev.filter((id) => id !== feeId)
        : [...prev, feeId],
    );
  };

  const handlePay = () => {
    if (selectedFees.length === 0) {
      toast.error("Please select at least one fee item to pay");
      return;
    }

    paymentMutation.mutate(
      {
        child_id: child.id,
        fee_item_ids: selectedFees,
        payment_method: "ONLINE",
        amount: selectedTotal,
      },
      {
        onSuccess: (response) => {
          if (response.gateway_url) {
            window.open(response.gateway_url, "_self");
          } else {
            toast.success("Payment initiated. Redirecting...");
          }
        },
      },
    );
  };

  const handleDownloadReceipt = async (transactionId: string) => {
    try {
      setDownloadingId(transactionId);
      const blob = await downloadReceipt(transactionId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${transactionId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Receipt downloaded");
    } catch {
      toast.error("Failed to download receipt");
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full space-y-5 pb-20 lg:pb-8">
      {/* Header */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-foreground">
          Fees & Payments
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Fee details and payment history for {child.full_name}
        </p>
      </div>

      {/* ── Admission Payment Flow ─────────────────────────────── */}
      <AdmissionPaymentSection child={child} />

      {/* ── Summary Cards ─────────────────────────────────────── */}
      {summary && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-3"
        >
          <SummaryCard
            label="Total Amount"
            amount={summary.total_fees}
            currency={summary.currency}
            color="text-foreground"
            bg="bg-card"
          />
          <SummaryCard
            label="Total Paid"
            amount={summary.total_paid}
            currency={summary.currency}
            color="text-emerald-600 dark:text-emerald-400"
            bg="bg-emerald-50 dark:bg-emerald-950/20"
          />
          <SummaryCard
            label="Balance Due"
            amount={summary.total_pending}
            currency={summary.currency}
            color="text-amber-600 dark:text-amber-400"
            bg="bg-amber-50 dark:bg-amber-950/20"
            highlight={summary.total_overdue > 0}
          />
        </motion.div>
      )}

      {/* ── Fee Breakdown ─────────────────────────────────────── */}
      {summary && summary.fee_items.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Outstanding Payment Items
              </CardTitle>
              <CardDescription className="text-xs">
                Select items to proceed with payment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {summary.fee_items.map((item) => (
                <FeeItemRow
                  key={item.id}
                  item={item}
                  isSelected={selectedFees.includes(item.id)}
                  onToggle={() => handleToggleFee(item.id)}
                  currency={summary.currency}
                />
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Pay Now Bar ───────────────────────────────────────── */}
      {selectedFees.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky bottom-20 lg:bottom-4 z-30"
        >
          <Card className="shadow-lg border-primary/20 bg-card/95 backdrop-blur-sm">
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  {selectedFees.length} item(s) selected
                </p>
                <p className="text-lg font-bold text-foreground">
                  {summary?.currency || "₹"}
                  {selectedTotal.toLocaleString()}
                </p>
              </div>
              <Button
                onClick={handlePay}
                disabled={paymentMutation.isPending}
                className="gap-1.5 h-10 px-6 shadow-sm"
              >
                {paymentMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CreditCard size={16} />
                )}
                Proceed to Payment
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Payment History ───────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-muted-foreground" />
                <CardTitle className="text-base">Payment History</CardTitle>
              </div>
              {showHistory ? (
                <ChevronUp size={16} className="text-muted-foreground" />
              ) : (
                <ChevronDown size={16} className="text-muted-foreground" />
              )}
            </button>
          </CardHeader>
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <CardContent className="pt-0 space-y-2">
                  {history?.transactions && history.transactions.length > 0 ? (
                    history.transactions.map((txn) => (
                      <TransactionRow
                        key={txn.id}
                        transaction={txn}
                        onDownload={() => handleDownloadReceipt(txn.id)}
                        isDownloading={downloadingId === txn.id}
                      />
                    ))
                  ) : (
                    <div className="py-6 text-center">
                      <Receipt
                        size={24}
                        className="mx-auto text-muted-foreground/40 mb-2"
                      />
                      <p className="text-sm text-muted-foreground">
                        No payment transactions yet
                      </p>
                    </div>
                  )}
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
    </div>
  );
}

// ── Summary Card ─────────────────────────────────────────────

function SummaryCard({
  label,
  amount,
  currency,
  color,
  bg,
  highlight,
}: {
  label: string;
  amount: number;
  currency: string;
  color: string;
  bg: string;
  highlight?: boolean;
}) {
  return (
    <Card
      className={`shadow-sm ${bg} ${highlight ? "border-amber-300 dark:border-amber-700" : ""}`}
    >
      <CardContent className="p-3 text-center">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
          {label}
        </p>
        <p className={`text-base sm:text-lg font-bold ${color}`}>
          {currency}
          {amount.toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}

// ── Fee Item Row ─────────────────────────────────────────────

function FeeItemRow({
  item,
  isSelected,
  onToggle,
  currency,
}: {
  item: PaymentFeeItem;
  isSelected: boolean;
  onToggle: () => void;
  currency: string;
}) {
  const isPaid = item.status === "COMPLETED" || item.status === "WAIVED";
  const isOverdue = item.status === "OVERDUE";

  const categoryColors: Record<string, string> = {
    REGISTRATION:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    ADMISSION:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    TUITION:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    HOSTEL:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    MESS: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    LIBRARY: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
    TRANSPORT:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
    ADDITIONAL:
      "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  };

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
        isSelected
          ? "border-primary/40 bg-primary/5"
          : isPaid
            ? "border-border/50 bg-muted/20 opacity-70"
            : isOverdue
              ? "border-destructive/30 bg-destructive/5"
              : "border-border hover:border-border/80"
      }`}
    >
      {/* Checkbox */}
      {!isPaid && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="rounded border-input h-4 w-4 shrink-0"
        />
      )}
      {isPaid && (
        <CheckCircle size={16} className="text-emerald-500 shrink-0" />
      )}

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-medium text-foreground truncate">
            {item.description}
          </p>
          <Badge
            className={`text-[9px] px-1.5 ${categoryColors[item.category] || categoryColors["ADDITIONAL"]}`}
          >
            {item.category}
          </Badge>
        </div>
        {item.due_date && !isPaid && (
          <p
            className={`text-[11px] ${
              isOverdue
                ? "text-destructive font-medium"
                : "text-muted-foreground"
            }`}
          >
            {isOverdue ? "⚠ Overdue — " : "Due "}
            {new Date(item.due_date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </p>
        )}
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <p
          className={`text-sm font-bold ${isPaid ? "text-muted-foreground line-through" : "text-foreground"}`}
        >
          {currency}
          {item.total.toLocaleString()}
        </p>
        {item.discount !== undefined && item.discount > 0 && (
          <p className="text-[10px] text-emerald-600">
            -{currency}
            {item.discount.toLocaleString()} off
          </p>
        )}
      </div>
    </div>
  );
}

// ── Transaction Row ──────────────────────────────────────────

function TransactionRow({
  transaction,
  onDownload,
  isDownloading,
}: {
  transaction: PaymentTransaction;
  onDownload: () => void;
  isDownloading: boolean;
}) {
  const statusColors: Record<string, { bg: string; text: string }> = {
    SUCCESS: {
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      text: "text-emerald-700 dark:text-emerald-300",
    },
    FAILED: {
      bg: "bg-red-100 dark:bg-red-900/30",
      text: "text-red-700 dark:text-red-300",
    },
    PENDING: {
      bg: "bg-amber-100 dark:bg-amber-900/30",
      text: "text-amber-700 dark:text-amber-300",
    },
    REFUNDED: {
      bg: "bg-blue-100 dark:bg-blue-900/30",
      text: "text-blue-700 dark:text-blue-300",
    },
  };

  const style = statusColors[transaction.status] || statusColors["PENDING"]!;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/20 transition-colors">
      <div className={`p-1.5 rounded-lg ${style.bg} shrink-0`}>
        {transaction.status === "SUCCESS" ? (
          <CheckCircle size={16} className={style.text} />
        ) : transaction.status === "FAILED" ? (
          <AlertTriangle size={16} className={style.text} />
        ) : (
          <Clock size={16} className={style.text} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {transaction.currency}
          {transaction.amount.toLocaleString()}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {new Date(transaction.paid_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}{" "}
          &bull; {transaction.payment_method}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Badge className={`${style.bg} ${style.text} text-[9px]`}>
          {transaction.status}
        </Badge>
        {transaction.status === "SUCCESS" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onDownload}
            disabled={isDownloading}
            title="Download receipt"
          >
            {isDownloading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
