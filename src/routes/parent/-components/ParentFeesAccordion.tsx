import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion } from "framer-motion";
import type { ChildProfile, DuesFilterBody, StudentFeeDue, StudentFeeReceipt } from "@/types/parent-portal";
import { getStudentDues, getStudentReceipts } from "@/services/parent-portal/parent-api";
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
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { AlertTriangle, Download, Receipt } from "lucide-react";
import { toast } from "sonner";

interface ParentFeesAccordionProps {
  child: ChildProfile;
}

const formatINR = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

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

export function ParentFeesAccordion({ child }: ParentFeesAccordionProps) {
  const userId = child.id;
  const instituteId = child.institute_id;

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<DuesFilterBody>({});

  const hasActiveFilters = Object.keys(appliedFilters).length > 0;

  const {
    data: allDues = [],
    isLoading: loadingAllDues,
    isError: allDuesError,
    error: allDuesErrorObj,
  } = useQuery({
    queryKey: ["student-dues-summary", "accordion", userId, instituteId],
    queryFn: () => getStudentDues(userId, instituteId),
    enabled: !!userId && !!instituteId,
    staleTime: 2 * 60 * 1000,
  });

  const {
    data: filteredDuesData = [],
    isLoading: loadingFilteredDues,
    error: filteredDuesErrorObj,
  } = useQuery({
    queryKey: ["student-dues-filtered", "accordion", userId, instituteId, appliedFilters],
    queryFn: () => getStudentDues(userId, instituteId, appliedFilters),
    enabled: !!userId && !!instituteId && hasActiveFilters,
    staleTime: 2 * 60 * 1000,
  });

  const {
    data: receipts = [],
    isLoading: loadingReceipts,
  } = useQuery({
    queryKey: ["student-receipts", "accordion", userId, instituteId],
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

  // Overall totals across all installments
  const totalFees = useMemo(
    () => allDues.reduce((sum, d) => sum + d.amount_expected, 0),
    [allDues],
  );
  const totalDues = useMemo(
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

  const installmentsByType = useMemo(() => {
    const groups: Record<string, StudentFeeDue[]> = {};
    tableDues.forEach((d) => {
      const key = d.fee_type_name || "Other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    });
    return groups;
  }, [tableDues]);

  const distinctTypes = useMemo(
    () => Object.keys(installmentsByType).sort(),
    [installmentsByType],
  );

  const defaultType = distinctTypes[0];

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
              Total Fees
            </p>
            <p className="text-lg sm:text-xl font-bold text-blue-700 dark:text-blue-300">
              {formatINR(totalFees)}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] font-medium text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">
              Total Dues
            </p>
            <p className="text-lg sm:text-xl font-bold text-red-700 dark:text-red-300">
              {formatINR(totalDues)}
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

      {/* Global Filters */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-1"
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
                    <SelectItem value="PARTIAL_PAID">Partial Paid</SelectItem>
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

      {/* Fee Type Accordions */}
      <Accordion
        type="single"
        collapsible
        defaultValue={defaultType}
        className="w-full space-y-2"
      >
        {distinctTypes.map((feeType) => {
          const group = installmentsByType[feeType] || [];
          const overdues = group.filter((d) => d.is_overdue);
          const totalExpected = group.reduce(
            (sum, d) => sum + d.amount_expected,
            0,
          );
          const totalPaidType = group.reduce(
            (sum, d) => sum + d.amount_paid,
            0,
          );
          const pendingCount = group.filter(
            (d) => d.status === "PENDING" && !d.is_overdue,
          ).length;
          const paidCount = group.filter(
            (d) => d.status === "PAID" || d.status === "COMPLETED",
          ).length;

          return (
            <AccordionItem key={feeType} value={feeType} className="border rounded-lg">
              <AccordionTrigger className="px-4">
                <div className="flex w-full items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {feeType}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {group.length} installment{group.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm">
                    <div className="text-right">
                      <p className="uppercase text-[10px] text-muted-foreground tracking-wide">
                        Total Amount
                      </p>
                      <p className="font-bold text-foreground">
                        {formatINR(totalExpected)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="uppercase text-[10px] text-muted-foreground tracking-wide">
                        Paid
                      </p>
                      <p className="font-bold text-emerald-600 dark:text-emerald-400">
                        {formatINR(totalPaidType)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                      {overdues.length > 0 && (
                        <Badge
                          variant="destructive"
                          className="text-[11px] px-3 py-1 rounded-full whitespace-nowrap"
                        >
                          {overdues.length} Dues
                        </Badge>
                      )}
                      <Badge
                        className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[11px] px-3 py-1 rounded-full whitespace-nowrap"
                      >
                        {pendingCount} Pending
                      </Badge>
                      <Badge
                        className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[11px] px-3 py-1 rounded-full whitespace-nowrap"
                      >
                        {paidCount} Paid
                      </Badge>
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <Tabs defaultValue="installments">
                  <TabsList className="w-full sm:w-auto mb-3">
                    <TabsTrigger value="installments">Installments</TabsTrigger>
                    <TabsTrigger value="overdues">Dues</TabsTrigger>
                    <TabsTrigger value="history">Payment History</TabsTrigger>
                  </TabsList>

                  <TabsContent value="installments">
                    <DuesTable
                      items={group}
                      isLoading={hasActiveFilters ? loadingFilteredDues : false}
                      emptyMessage="No installments found"
                    />
                  </TabsContent>

                  <TabsContent value="overdues">
                    <DuesTable
                      items={overdues}
                      isLoading={hasActiveFilters ? loadingFilteredDues : false}
                      emptyMessage="No due installments"
                    />
                  </TabsContent>

                  <TabsContent value="history">
                    <ReceiptsTable
                      items={receipts}
                      isLoading={loadingReceipts}
                      emptyMessage="No payment history"
                    />
                  </TabsContent>
                </Tabs>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

// Reuse existing table helpers from PaymentsModule

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

  const handleDownloadInvoice = (installmentId: string) => {
    toast.message("Invoice download", {
      description: `Invoice download will be integrated later. (Installment: ${installmentId})`,
    });
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
            <TableHead className="w-10">#</TableHead>
            <TableHead>Fees</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Expected</TableHead>
            <TableHead className="text-right">Discount</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right font-semibold">Amt Due</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-right">Invoice</TableHead>
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
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 gap-1"
                  onClick={() => handleDownloadInvoice(item.id)}
                  title="Download invoice"
                >
                  <Download size={14} />
                  <span className="text-xs">Download</span>
                </Button>
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

const allocationTypeColors: Record<string, string> = {
  PAYMENT:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-100",
  REFUND:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-100",
  ADVANCE_ROLLOVER:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-100",
};

function ReceiptsTable({
  items,
  isLoading,
  emptyMessage,
}: {
  items: StudentFeeReceipt[];
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
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-center">Type</TableHead>
            <TableHead>Remarks</TableHead>
            <TableHead className="text-right">Receipt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="whitespace-nowrap">
                {formatReceiptDate(item.created_at)}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatINR(item.amount_allocated)}
              </TableCell>
              <TableCell className="text-center">
                <Badge
                  className={`text-[10px] ${
                    allocationTypeColors[item.allocation_type] ||
                    "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300"
                  }`}
                >
                  {item.allocation_type}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {item.remarks || "—"}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 gap-1"
                  onClick={() =>
                    toast.message("Receipt download", {
                      description: `Receipt download will be integrated later. (Receipt: ${item.id})`,
                    })
                  }
                  title="Download receipt"
                >
                  <Download size={14} />
                  <span className="text-xs">Download</span>
                </Button>
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

