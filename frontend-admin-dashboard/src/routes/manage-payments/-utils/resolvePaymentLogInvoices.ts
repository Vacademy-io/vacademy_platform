import {
    fetchInvoicesForPaymentLogs,
    fetchUserInvoices,
    type InvoiceDTO,
    type PaymentLogInvoiceDTO,
} from '@/services/invoice-service';

/**
 * Resolving "which invoice covers this payment?" for a page of the payments table.
 *
 * The fast path is the bulk `/invoices/by-payment-logs` lookup — one request, resolved
 * server-side from the invoice ↔ payment-log mapping.
 *
 * The fallback exists because the admin dashboard and admin_core_service deploy separately:
 * a frontend build routinely runs against a backend that predates it (and every local dev
 * server points at stage by default). Rather than render an empty column until the backend
 * catches up, we fall back to the long-standing per-user invoice endpoint and do the join
 * on the client — using the SAME `payment_log_ids` link, so the number shown is identical,
 * just fetched less efficiently.
 */

/** Ranking timestamp for an invoice; missing dates sort oldest. */
const recencyOf = (invoiceDate?: string | null, createdAt?: string | null): number => {
    const raw = invoiceDate || createdAt;
    if (!raw) return 0;
    const t = new Date(raw).getTime();
    return Number.isNaN(t) ? 0 : t;
};

const isVoided = (status?: string | null) => (status || '').toUpperCase() === 'REJECTED';

/**
 * Which of two invoices on the same payment log to show. Mirrors the server's rule exactly:
 * a live invoice beats a voided one, and the most recently issued wins after that.
 */
export function preferInvoice(
    existing: PaymentLogInvoiceDTO,
    candidate: PaymentLogInvoiceDTO
): PaymentLogInvoiceDTO {
    const existingVoided = isVoided(existing.status);
    const candidateVoided = isVoided(candidate.status);
    if (existingVoided !== candidateVoided) return existingVoided ? candidate : existing;
    return recencyOf(candidate.invoice_date) > recencyOf(existing.invoice_date)
        ? candidate
        : existing;
}

/** Collapse rows into one invoice per payment log, applying the tie-break above. */
export function indexByPaymentLog(
    rows: PaymentLogInvoiceDTO[]
): Record<string, PaymentLogInvoiceDTO> {
    const map: Record<string, PaymentLogInvoiceDTO> = {};
    rows.forEach((row) => {
        if (!row?.payment_log_id) return;
        const existing = map[row.payment_log_id];
        map[row.payment_log_id] = existing ? preferInvoice(existing, row) : row;
    });
    return map;
}

/**
 * Flatten a per-user invoice list into one row per (invoice, payment log) pair, dropping
 * invoices that cover no payment at all — an unpaid invoice has no payment row to sit on,
 * so it correctly never appears in this table.
 */
export function expandUserInvoices(invoices: InvoiceDTO[]): PaymentLogInvoiceDTO[] {
    const rows: PaymentLogInvoiceDTO[] = [];
    invoices.forEach((invoice) => {
        const logIds = invoice.payment_log_ids?.length
            ? invoice.payment_log_ids
            : invoice.payment_log_id
              ? [invoice.payment_log_id]
              : [];
        logIds.forEach((paymentLogId) => {
            if (!paymentLogId) return;
            rows.push({
                payment_log_id: paymentLogId,
                invoice_id: invoice.id,
                invoice_number: invoice.invoice_number,
                invoice_date: invoice.invoice_date ?? null,
                status: invoice.status,
                total_amount: invoice.total_amount ?? null,
                currency: invoice.currency ?? null,
                has_pdf: !!(invoice.pdf_file_id || invoice.pdf_url),
            });
        });
    });
    return rows;
}

/**
 * Whether the backend serves the bulk endpoint. Remembered for the page's lifetime so a
 * backend that predates it costs ONE failed request, not one per page the admin visits.
 * `null` = not yet known.
 */
let bulkLookupSupported: boolean | null = null;

/** A 404/405 means the route isn't there; anything else is transient and must not be cached. */
function isRouteMissing(error: unknown): boolean {
    const status = (error as { response?: { status?: number } })?.response?.status;
    return status === 404 || status === 405;
}

/** Most distinct learners the fallback will fetch for, and how many at a time. */
const FALLBACK_MAX_USERS = 20;
const FALLBACK_CONCURRENCY = 5;

/** Run `task` over `items` a few at a time, so the fallback never opens 20 sockets at once. */
async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    task: (item: T) => Promise<R>
): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += limit) {
        // eslint-disable-next-line no-await-in-loop
        results.push(...(await Promise.all(items.slice(i, i + limit).map(task))));
    }
    return results;
}

/**
 * The minimum a row contributes to the lookup. Deliberately not the full PaymentLogEntry:
 * this doubles as the react-query cache key, so it has to stay small and serialisable.
 */
export interface PaymentLogInvoiceLookupInput {
    paymentLogId: string;
    /** Owner of the payment — only needed by the per-user fallback. */
    userId?: string | null;
}

/**
 * Invoice per payment log for the given rows. Tries the bulk endpoint, then falls back to
 * per-user fetches (one request per distinct learner on the page) if it is unavailable.
 *
 * Returns an empty map rather than throwing when both routes fail — the column degrades to
 * dashes instead of taking the payments table down.
 */
export async function resolvePaymentLogInvoices(
    instituteId: string,
    inputs: PaymentLogInvoiceLookupInput[]
): Promise<Record<string, PaymentLogInvoiceDTO>> {
    const paymentLogIds = inputs.map((i) => i.paymentLogId).filter(Boolean);
    if (!instituteId || paymentLogIds.length === 0) return {};

    if (bulkLookupSupported !== false) {
        try {
            const rows = await fetchInvoicesForPaymentLogs(instituteId, paymentLogIds);
            bulkLookupSupported = true;
            return indexByPaymentLog(rows);
        } catch (error) {
            // Only a missing route is remembered. A transient 5xx must not condemn the
            // session to the slow path.
            if (isRouteMissing(error)) bulkLookupSupported = false;
        }
    }

    const userIds = [
        ...new Set(inputs.map((i) => i.userId).filter((id): id is string => !!id)),
    ].slice(0, FALLBACK_MAX_USERS);
    if (userIds.length === 0) return {};

    const wanted = new Set(paymentLogIds);
    const perUser = await mapWithConcurrency(userIds, FALLBACK_CONCURRENCY, (userId) =>
        fetchUserInvoices(userId, instituteId).catch(() => [])
    );

    // Keep only the payment logs actually on this page: a learner's invoice list covers
    // their whole history, most of which belongs to other pages.
    return indexByPaymentLog(
        expandUserInvoices(perUser.flat()).filter((row) => wanted.has(row.payment_log_id))
    );
}

/** Test seam: clears the remembered bulk-endpoint verdict. */
export function __resetBulkLookupSupport(): void {
    bulkLookupSupported = null;
}
