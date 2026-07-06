import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    GET_INVOICES_BY_USER,
    GET_INVOICES_BY_INSTITUTE,
    GET_INVOICE_DOWNLOAD_URL,
    POST_ADMIN_CREATE_INVOICE,
    POST_ADMIN_PREVIEW_INVOICE,
} from '@/constants/urls';

export interface InvoiceLineItemDTO {
    id: string;
    itemType: string;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
}

export interface InvoiceDTO {
    id: string;
    invoice_number: string;
    user_id: string;
    institute_id: string;
    invoice_date: string;
    due_date: string;
    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    total_amount: number;
    currency: string;
    status: string;
    pdf_file_id: string | null;
    pdf_url: string | null;
    tax_included: boolean;
    created_at: string;
    updated_at: string;
    line_items: InvoiceLineItemDTO[];
}

export interface InvoicePaginatedResponse {
    content: InvoiceDTO[];
    totalElements: number;
    totalPages: number;
    size: number;
    number: number;
    first: boolean;
    last: boolean;
}

export async function fetchUserInvoices(userId: string): Promise<InvoiceDTO[]> {
    const response = await authenticatedAxiosInstance.get<InvoiceDTO[]>(
        GET_INVOICES_BY_USER(userId)
    );
    return response.data;
}

export async function fetchInstituteInvoices(
    instituteId: string,
    page = 0,
    size = 20,
    filters?: {
        userId?: string;
        status?: string;
        startDate?: string;
        endDate?: string;
    }
): Promise<InvoicePaginatedResponse> {
    const params: Record<string, string> = {
        page: String(page),
        size: String(size),
    };
    if (filters?.userId) params['userId'] = filters.userId;
    if (filters?.status) params['status'] = filters.status;
    if (filters?.startDate) params['startDate'] = filters.startDate;
    if (filters?.endDate) params['endDate'] = filters.endDate;

    const response = await authenticatedAxiosInstance.get<InvoicePaginatedResponse>(
        GET_INVOICES_BY_INSTITUTE(instituteId),
        { params }
    );
    return response.data;
}

export function getInvoiceDownloadUrl(invoiceId: string): string {
    return GET_INVOICE_DOWNLOAD_URL(invoiceId);
}

// ─── Admin Invoice Creation ───────────────────────────────────────────────────

export interface AdminInvoiceLineItemRequest {
    description: string;
    quantity: number;
    unit_price: number;
    item_type?: string;
}

export interface AdminCreateInvoiceRequest {
    user_ids: string[];
    institute_id: string;
    line_items: AdminInvoiceLineItemRequest[];
    currency: string;
    due_date: string;
    /** Admin-chosen invoice date (ISO). Defaults to now on the server when omitted. */
    invoice_date?: string;
    notes?: string;
    /** Per-invoice edits to dynamic template values, keyed by placeholder name. */
    overrides?: Record<string, string>;
}

/** One editable/derived dynamic value discovered in the institute's invoice template. */
export interface InvoicePlaceholderValue {
    key: string;
    label: string;
    /** Grouping heading: INVOICE / BILL TO / INSTITUTE / TAX / AMOUNTS / NOTES. */
    group: string;
    /** Current value: override when set, else the auto-derived value. */
    value: string;
    editable: boolean;
    /** Preferred input control: 'text' | 'textarea' | 'date'. */
    input_type: string;
}

export interface AdminInvoicePreviewResponse {
    /** Rendered invoice HTML (all placeholders substituted) for the live preview pane. */
    html: string;
    /** Editable/derived placeholder values to seed the review panel. */
    resolved_values: InvoicePlaceholderValue[];
}

export interface AdminInvoicePaymentLinkResponse {
    invoice_id: string;
    invoice_number: string;
    user_id: string;
    total_amount: number;
    currency: string;
    status: string;
    due_date: string;
    payment_link: string;
    pdf_url: string | null;
}

export async function createAdminInvoice(
    request: AdminCreateInvoiceRequest
): Promise<AdminInvoicePaymentLinkResponse[]> {
    const response = await authenticatedAxiosInstance.post<AdminInvoicePaymentLinkResponse[]>(
        POST_ADMIN_CREATE_INVOICE,
        request
    );
    return response.data;
}

/**
 * Non-persisting preview: renders the institute's invoice template with the given line
 * items + overrides and returns the rendered HTML plus the resolved dynamic values. Used
 * by the "Review & Preview" step before the invoice is actually created.
 */
export async function previewAdminInvoice(
    request: AdminCreateInvoiceRequest
): Promise<AdminInvoicePreviewResponse> {
    const response = await authenticatedAxiosInstance.post<AdminInvoicePreviewResponse>(
        POST_ADMIN_PREVIEW_INVOICE,
        request
    );
    return response.data;
}
