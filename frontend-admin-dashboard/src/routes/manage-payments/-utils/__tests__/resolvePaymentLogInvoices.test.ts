import { describe, expect, it } from 'vitest';
import { expandUserInvoices, indexByPaymentLog, preferInvoice } from '../resolvePaymentLogInvoices';
import type { InvoiceDTO, PaymentLogInvoiceDTO } from '@/services/invoice-service';

const invoice = (over: Partial<InvoiceDTO>): InvoiceDTO =>
    ({
        id: 'inv-1',
        invoice_number: 'INV-001',
        user_id: 'u1',
        institute_id: 'i1',
        invoice_date: '2026-08-01T00:00:00',
        due_date: '2026-08-10T00:00:00',
        subtotal: 100,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: 100,
        currency: 'INR',
        status: 'PAID',
        pdf_file_id: 'file-1',
        pdf_url: null,
        tax_included: false,
        created_at: '2026-08-01T00:00:00',
        updated_at: '2026-08-01T00:00:00',
        line_items: [],
        ...over,
    }) as InvoiceDTO;

const row = (over: Partial<PaymentLogInvoiceDTO>): PaymentLogInvoiceDTO => ({
    payment_log_id: 'pl-1',
    invoice_id: 'inv-1',
    invoice_number: 'INV-001',
    invoice_date: '2026-08-01T00:00:00',
    status: 'PAID',
    total_amount: 100,
    currency: 'INR',
    has_pdf: true,
    ...over,
});

describe('expandUserInvoices', () => {
    it('emits one row per payment log an invoice covers', () => {
        // Real shape from HCCA: one installment invoice covering four payment attempts.
        const rows = expandUserInvoices([
            invoice({
                id: 'inv-9',
                invoice_number: 'INV-2026-27/009',
                payment_log_ids: ['pl-a', 'pl-b', 'pl-c', 'pl-d'],
            }),
        ]);
        expect(rows.map((r) => r.payment_log_id)).toEqual(['pl-a', 'pl-b', 'pl-c', 'pl-d']);
        expect(new Set(rows.map((r) => r.invoice_number))).toEqual(new Set(['INV-2026-27/009']));
    });

    it('falls back to the singular payment_log_id when the list is absent', () => {
        const rows = expandUserInvoices([
            invoice({ payment_log_ids: null, payment_log_id: 'pl-solo' }),
        ]);
        expect(rows).toHaveLength(1);
        expect(rows[0]!.payment_log_id).toBe('pl-solo');
    });

    it('drops invoices that cover no payment — an unpaid invoice has no row to sit on', () => {
        expect(
            expandUserInvoices([
                invoice({ status: 'PENDING_PAYMENT', payment_log_ids: [], payment_log_id: null }),
            ])
        ).toEqual([]);
    });

    it('reports has_pdf from either the file id or a resolved url', () => {
        const [withUrl] = expandUserInvoices([
            invoice({ pdf_file_id: null, pdf_url: 'https://x/y.pdf', payment_log_ids: ['pl-1'] }),
        ]);
        const [withNeither] = expandUserInvoices([
            invoice({ pdf_file_id: null, pdf_url: null, payment_log_ids: ['pl-2'] }),
        ]);
        expect(withUrl!.has_pdf).toBe(true);
        expect(withNeither!.has_pdf).toBe(false);
    });
});

describe('preferInvoice', () => {
    it('prefers a live invoice over a voided one regardless of date', () => {
        const voided = row({ invoice_id: 'a', status: 'REJECTED', invoice_date: '2026-09-01' });
        const live = row({ invoice_id: 'b', status: 'PAID', invoice_date: '2026-01-01' });
        expect(preferInvoice(voided, live).invoice_id).toBe('b');
        expect(preferInvoice(live, voided).invoice_id).toBe('b');
    });

    it('prefers the most recently issued when both are live', () => {
        const older = row({ invoice_id: 'a', invoice_date: '2026-01-01' });
        const newer = row({ invoice_id: 'b', invoice_date: '2026-06-01' });
        expect(preferInvoice(older, newer).invoice_id).toBe('b');
        expect(preferInvoice(newer, older).invoice_id).toBe('b');
    });

    it('is stable when neither carries a date', () => {
        const first = row({ invoice_id: 'a', invoice_date: null });
        const second = row({ invoice_id: 'b', invoice_date: null });
        expect(preferInvoice(first, second).invoice_id).toBe('a');
    });
});

describe('indexByPaymentLog', () => {
    it('collapses duplicates to one invoice per payment log', () => {
        const map = indexByPaymentLog([
            row({ payment_log_id: 'pl-1', invoice_id: 'old', invoice_date: '2026-01-01' }),
            row({ payment_log_id: 'pl-1', invoice_id: 'new', invoice_date: '2026-05-01' }),
            row({ payment_log_id: 'pl-2', invoice_id: 'other' }),
        ]);
        expect(Object.keys(map).sort()).toEqual(['pl-1', 'pl-2']);
        expect(map['pl-1']!.invoice_id).toBe('new');
    });

    it('ignores rows with no payment log', () => {
        expect(indexByPaymentLog([row({ payment_log_id: '' })])).toEqual({});
    });
});
