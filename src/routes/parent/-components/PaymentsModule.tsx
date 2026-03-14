import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion } from "framer-motion";
import type { ChildProfile } from "@/types/parent-portal";
import type {
  StudentFeeDue,
  InvoiceReceipt,
  DuesFilterBody,
} from "@/types/parent-portal";
import {
  getStudentDues,
  getStudentReceipts,
  getReceiptDownloadUrl,
} from "@/services/parent-portal/parent-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { AlertTriangle, Receipt, Download, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface PaymentsModuleProps {
  child: ChildProfile;
}

const formatINR = (amount: number | null | undefined) =>
  `₹${(amount ?? 0).toLocaleString("en-IN")}`;

const formatDueDate = (dateStr: string) => {
  try {
    return format(new Date(dateStr), "dd MMM yyyy");
  } catch {
    return dateStr;
  }
};

const formatReceiptDate = (dateStr: string) => {
  try {
    return format(new Date(dateStr), "dd MMM yyyy, hh:mm a");
  } catch {
    return dateStr;
  }
};

export function PaymentsModule({ child }: PaymentsModuleProps) {
  const userId = child.id;
  const instituteId = child.institute_id;

  const [activeTab, setActiveTab] = useState("installments");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<DuesFilterBody>({});

  const hasActiveFilters = Object.keys(appliedFilters).length > 0;

  // Unfiltered dues — powers summary cards and default table
  const {
    data: allDues = [],
    isLoading: loadingAllDues,
    isError: allDuesError,
    error: allDuesErrorObj,
  } = useQuery({
    queryKey: ["student-dues-summary", userId, instituteId],
    queryFn: () => getStudentDues(userId, instituteId),
    enabled: !!userId && !!instituteId,
    staleTime: 2 * 60 * 1000,
  });

  // Filtered dues — runs only when user applies filters
  const {
    data: filteredDuesData = [],
    isLoading: loadingFilteredDues,
    error: filteredDuesErrorObj,
  } = useQuery({
    queryKey: ["student-dues-filtered", userId, instituteId, appliedFilters],
    queryFn: () => getStudentDues(userId, instituteId, appliedFilters),
    enabled: !!userId && !!instituteId && hasActiveFilters,
    staleTime: 2 * 60 * 1000,
  });

  // Receipts for payment history tab
  const {
    data: receipts = [],
    isLoading: loadingReceipts,
  } = useQuery({
    queryKey: ["student-receipts", userId, instituteId],
    queryFn: () => getStudentReceipts(userId, instituteId),
    enabled: !!userId && !!instituteId,
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    if (allDuesErrorObj) {
      toast.error("Failed to load fee data. Please try again.");
    }
  }, [allDuesErrorObj]);

  useEffect(() => {
    if (filteredDuesErrorObj) {
      toast.error("Failed to load fee data. Please try again.");
    }
  }, [filteredDuesErrorObj]);

  const tableDues = hasActiveFilters ? filteredDuesData : allDues;

  // Summary computations (always from unfiltered data)
  const totalDues = useMemo(
    () => allDues.reduce((sum, d) => sum + d.amount_due, 0),
    [allDues],
  );
  const overdueAmount = useMemo(
    () =>
      allDues
        .filter((d) => d.is_overdue)
        .reduce((sum, d) => sum + d.amount_due, 0),
    [allDues],
  );
  const totalPaid = useMemo(
    () => allDues.reduce((sum, d) => sum + d.amount_paid, 0),
    [allDues],
  );

  // Tab data derived from potentially-filtered dues
  const installmentItems = useMemo(
    () => tableDues.filter((d) => d.status !== "PAID"),
    [tableDues],
  );
  const overdueItems = useMemo(
    () => tableDues.filter((d) => d.is_overdue),
    [tableDues],
  );
  const overdueCount = useMemo(
    () => allDues.filter((d) => d.is_overdue).length,
    [allDues],
  );

  const handleApplyFilters = () => {
    const body: DuesFilterBody = {};
    if (statusFilter !== "ALL") body.status = statusFilter;
    if (startDate) body.startDueDate = startDate;
    if (endDate) body.endDueDate = endDate;
    setAppliedFilters(body);
  };

  if (!instituteId) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Please select an institute</p>
        </div>
      </div>
    );
  }

  if (loadingAllDues) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (allDuesError) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <AlertTriangle
            size={32}
            className="mx-auto text-destructive/60 mb-2"
          />
          <p className="text-sm text-muted-foreground">
            Failed to load fee data. Please try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[calc(100vh-8rem)] space-y-5 pb-20 lg:pb-8">
      {/* Header */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-foreground">
          Parent Payment
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Fee details and payment history for {child.full_name}
        </p>
      </div>

      {/* Summary Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        <Card className="shadow-sm bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
              Total Dues
            </p>
            <p className="text-lg sm:text-xl font-bold text-blue-700 dark:text-blue-300">
              {formatINR(totalDues)}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] font-medium text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">
              Overdue Amount
            </p>
            <p className="text-lg sm:text-xl font-bold text-red-700 dark:text-red-300">
              {formatINR(overdueAmount)}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
              Total Paid
            </p>
            <p className="text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-300">
              {formatINR(totalPaid)}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="installments">Installments</TabsTrigger>
          <TabsTrigger value="overdues" className="gap-1.5">
            Overdues
            {overdueCount > 0 && (
              <Badge
                variant="destructive"
                className="ml-1 text-[10px] px-1.5 py-0 h-4 leading-4"
              >
                {overdueCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
        </TabsList>

        {/* Filters — visible in Installments & Overdues tabs */}
        {(activeTab === "installments" || activeTab === "overdues") && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4"
          >
            <Card className="shadow-sm">
              <CardContent className="p-3">
                <div className="flex flex-col sm:flex-row items-end gap-3">
                  <div className="w-full sm:w-40">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Status
                    </label>
                    <Select
                      value={statusFilter}
                      onValueChange={setStatusFilter}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="PARTIAL_PAID">
                          Partial Paid
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-full sm:w-40">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Start Date
                    </label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-9"
                    />
                  </div>

                  <div className="w-full sm:w-40">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      End Date
                    </label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-9"
                    />
                  </div>

                  <Button onClick={handleApplyFilters} className="h-9 px-6">
                    Apply
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Tab: Installments */}
        <TabsContent value="installments" className="mt-4">
          <DuesTable
            items={installmentItems}
            isLoading={hasActiveFilters ? loadingFilteredDues : false}
            emptyMessage="No installments found"
          />
        </TabsContent>

        {/* Tab: Overdues */}
        <TabsContent value="overdues" className="mt-4 space-y-3">
          {overdueItems.length > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
              <AlertTriangle
                size={16}
                className="text-red-600 dark:text-red-400 shrink-0"
              />
              <p className="text-sm text-red-700 dark:text-red-300">
                You have{" "}
                <strong>{overdueItems.length}</strong> overdue
                {" installment"}
                {overdueItems.length !== 1 ? "s" : ""} totaling{" "}
                <strong>
                  {formatINR(
                    overdueItems.reduce((s, d) => s + d.amount_due, 0),
                  )}
                </strong>
              </p>
            </div>
          )}
          <DuesTable
            items={overdueItems}
            isLoading={hasActiveFilters ? loadingFilteredDues : false}
            emptyMessage="No overdue installments"
          />
        </TabsContent>

        {/* Tab: Payment History */}
        <TabsContent value="history" className="mt-4">
          <ReceiptsTable
            items={receipts}
            isLoading={loadingReceipts}
            emptyMessage="No payment history"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Dues Table ──────────────────────────────────────────────────

function DuesTable({
  items,
  isLoading,
  emptyMessage,
}: {
  items: StudentFeeDue[];
  isLoading: boolean;
  emptyMessage: string;
}) {
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [items]);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, totalItems);
  const pageItems = items.slice(startIdx, endIdx);

  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-12 text-center">
          <Receipt
            size={24}
            className="mx-auto text-muted-foreground/40 mb-2"
          />
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-10">#</TableHead>
            <TableHead>Fees</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Expected</TableHead>
            <TableHead className="text-right">Discount</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right font-semibold">Amt Due</TableHead>
            <TableHead className="text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((item, idx) => (
            <TableRow
              key={item.id}
              className={
                item.is_overdue ? "bg-red-50/50 dark:bg-red-950/10" : ""
              }
            >
              <TableCell className="text-muted-foreground">
                {startIdx + idx + 1}
              </TableCell>
              <TableCell
                className="max-w-[180px] truncate"
                title={item.fee_type_name || undefined}
              >
                {item.fee_type_name || "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {formatDueDate(item.due_date)}
              </TableCell>
              <TableCell className="text-right">
                {formatINR(item.amount_expected)}
              </TableCell>
              <TableCell
                className="text-right"
                title={item.discount_reason || undefined}
              >
                {formatINR(item.discount_amount)}
              </TableCell>
              <TableCell className="text-right">
                {formatINR(item.amount_paid)}
              </TableCell>
              <TableCell className="text-right font-bold">
                {formatINR(item.amount_due)}
              </TableCell>
              <TableCell className="text-center">
                <StatusBadge
                  status={item.status}
                  isOverdue={item.is_overdue}
                  daysOverdue={item.days_overdue}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CardContent className="py-2 px-3 border-t flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-medium text-foreground">{startIdx + 1}</span>
          –<span className="font-medium text-foreground">{endIdx}</span> of{" "}
          <span className="font-medium text-foreground">{totalItems}</span>
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            Page <span className="font-medium text-foreground">{safePage}</span> of{" "}
            <span className="font-medium text-foreground">{totalPages}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Status Badge ────────────────────────────────────────────────

function StatusBadge({
  status,
  isOverdue,
  daysOverdue,
}: {
  status: string;
  isOverdue: boolean;
  daysOverdue: number | null;
}) {
  if (isOverdue) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-[10px] hover:bg-red-100">
          {status === "PARTIAL_PAID" ? "PARTIAL PAID" : status}
        </Badge>
        {daysOverdue != null && (
          <span className="text-[10px] text-red-600 dark:text-red-400">
            {daysOverdue} days overdue
          </span>
        )}
      </div>
    );
  }

  if (status === "PARTIAL_PAID") {
    return (
      <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 text-[10px] hover:bg-yellow-100">
        PARTIAL PAID
      </Badge>
    );
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px] hover:bg-emerald-100">
        {status}
      </Badge>
      <span className="text-[10px] text-muted-foreground">upcoming</span>
    </div>
  );
}

// ── Receipts Table (Invoice-wise) ──────────────────────────────────────────────

const invoiceTypeColors: Record<string, string> = {
  SCHOOL_FEE_RECEIPT:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-100",
  REFUND:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-100",
};

function ReceiptsTable({
  items,
  isLoading,
  emptyMessage,
}: {
  items: InvoiceReceipt[];
  isLoading: boolean;
  emptyMessage: string;
}) {
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [items]);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, totalItems);
  const pageItems = items.slice(startIdx, endIdx);

  const toggleExpand = (invoiceId: string) => {
    setExpandedId((prev) => (prev === invoiceId ? null : invoiceId));
  };

  const handleDownloadReceipt = async (invoice: InvoiceReceipt) => {
    if (!invoice.pdf_file_id) {
      toast.error("Receipt PDF not available yet", {
        description: `Receipt: ${invoice.invoice_number}`,
      });
      return;
    }

    setDownloadingId(invoice.invoice_id);
    try {
      const { download_url, file_name } = await getReceiptDownloadUrl(invoice.invoice_id);

      const link = document.createElement("a");
      link.href = download_url;
      link.download = file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Download started", {
        description: `Receipt: ${invoice.invoice_number}`,
      });
    } catch (error) {
      console.error("Failed to download receipt:", error);
      toast.error("Failed to download receipt", {
        description: "Please try again later.",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-12 text-center">
          <Receipt
            size={24}
            className="mx-auto text-muted-foreground/40 mb-2"
          />
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-8"></TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-center">Type</TableHead>
            <TableHead>Receipt No.</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((invoice) => {
            const isExpanded = expandedId === invoice.invoice_id;
            return (
              <>
                <TableRow
                  key={invoice.invoice_id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleExpand(invoice.invoice_id)}
                >
                  <TableCell className="w-8 pr-0">
                    {isExpanded ? (
                      <ChevronUp size={16} className="text-muted-foreground" />
                    ) : (
                      <ChevronDown size={16} className="text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatReceiptDate(invoice.invoice_date)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatINR(invoice.amount_paid_now)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      className={`text-[10px] ${
                        invoiceTypeColors[invoice.type] ||
                        "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300"
                      }`}
                    >
                      PAYMENT
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {invoice.invoice_number}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 gap-1"
                      disabled={!invoice.pdf_file_id || downloadingId === invoice.invoice_id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadReceipt(invoice);
                      }}
                      title={invoice.pdf_file_id ? "Download receipt" : "PDF not available"}
                    >
                      {downloadingId === invoice.invoice_id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Download size={14} />
                      )}
                      <span className="text-xs">
                        {!invoice.pdf_file_id
                          ? "Generating..."
                          : downloadingId === invoice.invoice_id
                            ? "Downloading..."
                            : "Download"}
                      </span>
                    </Button>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow key={`${invoice.invoice_id}-details`}>
                    <TableCell colSpan={6} className="bg-muted/30 p-0">
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">
                              Amount Paid Now
                            </p>
                            <p className="font-semibold text-foreground">
                              {formatINR(invoice.amount_paid_now)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">
                              Total Paid
                            </p>
                            <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {formatINR(invoice.total_paid)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">
                              Balance Due
                            </p>
                            <p className="font-semibold text-red-600 dark:text-red-400">
                              {formatINR(invoice.balance_due)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">
                              Total Expected
                            </p>
                            <p className="font-semibold text-foreground">
                              {formatINR(invoice.total_expected)}
                            </p>
                          </div>
                        </div>

                        {invoice.line_items.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                              Installments Covered:
                            </p>
                            <div className="border rounded-md overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/50">
                                    <TableHead className="text-xs">Description</TableHead>
                                    <TableHead className="text-xs">Fee Type</TableHead>
                                    <TableHead className="text-xs text-right">Amount</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {invoice.line_items.map((item) => (
                                    <TableRow key={item.line_item_id}>
                                      <TableCell className="text-sm">
                                        {item.description}
                                      </TableCell>
                                      <TableCell className="text-sm text-muted-foreground">
                                        {item.fee_type_name || "—"}
                                      </TableCell>
                                      <TableCell className="text-sm text-right font-medium">
                                        {formatINR(item.amount)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>

      <CardContent className="py-2 px-3 border-t flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-medium text-foreground">{startIdx + 1}</span>
          –<span className="font-medium text-foreground">{endIdx}</span> of{" "}
          <span className="font-medium text-foreground">{totalItems}</span>
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            Page <span className="font-medium text-foreground">{safePage}</span> of{" "}
            <span className="font-medium text-foreground">{totalPages}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
