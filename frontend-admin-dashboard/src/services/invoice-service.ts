import { BASE_URL } from '@/constants/urls';
import { getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

const getAccessToken = (): string | null => getTokenFromCookie(TokenKey.accessToken);

const INVOICES_BASE_URL = `${BASE_URL}/admin-core-service/v1/invoices`;

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
    const token = getAccessToken();
    const response = await fetch(`${INVOICES_BASE_URL}/user/${userId}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) throw new Error(`Failed to fetch invoices: ${response.status}`);
    return response.json();
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
    const params = new URLSearchParams({
        page: String(page),
        size: String(size),
    });
    if (filters?.userId) params.set('userId', filters.userId);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.startDate) params.set('startDate', filters.startDate);
    if (filters?.endDate) params.set('endDate', filters.endDate);

    const token = getAccessToken();
    const response = await fetch(`${INVOICES_BASE_URL}/institute/${instituteId}?${params}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) throw new Error(`Failed to fetch invoices: ${response.status}`);
    return response.json();
}

export function getInvoiceDownloadUrl(invoiceId: string): string {
    return `${INVOICES_BASE_URL}/${invoiceId}/download`;
}
