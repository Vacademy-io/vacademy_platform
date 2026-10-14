import { describe, expect, it } from 'vitest';
import {
    initialOfflinePaymentDetails,
    offlinePaymentDetailsError,
    toOfflinePaymentDetailsPayload,
    type OfflinePaymentModes,
} from './offline-payment-modes';

// Mirrors OfflinePaymentDetailsService on the backend: the dialogs block what it would reject.
const modes: OfflinePaymentModes = {
    require_mode: false,
    default_mode: 'CASH',
    modes: [
        { code: 'CASH', label: 'Cash', active: true },
        { code: 'CHEQUE', label: 'Cheque', active: true, reference_required: true },
        { code: 'BANK_TRANSFER', label: 'Bank transfer', active: true, proof_required: true },
        { code: 'DD', label: 'Demand draft', active: false },
    ],
};

describe('offline payment details', () => {
    it('preselects the default mode', () => {
        expect(initialOfflinePaymentDetails(modes)).toEqual({ mode: 'CASH' });
    });

    it('needs a mode only when the institute requires one', () => {
        expect(offlinePaymentDetailsError({}, modes)).toBeNull();
        expect(offlinePaymentDetailsError({}, { ...modes, require_mode: true })).toBe('errors.modeRequired');
        expect(offlinePaymentDetailsError({ mode: 'DD' }, { ...modes, require_mode: true })).toBe('errors.modeRequired');
    });

    it('enforces a mode’s required reference and proof', () => {
        expect(offlinePaymentDetailsError({ mode: 'CHEQUE' }, modes)).toBe('errors.referenceRequired');
        expect(offlinePaymentDetailsError({ mode: 'CHEQUE', reference: ' 000123 ' }, modes)).toBeNull();
        expect(offlinePaymentDetailsError({ mode: 'BANK_TRANSFER' }, modes)).toBe('errors.proofRequired');
        expect(offlinePaymentDetailsError({ mode: 'BANK_TRANSFER', proof_file_id: 'f1' }, modes)).toBeNull();
    });

    it('drops empty fields and returns null when nothing was given', () => {
        expect(toOfflinePaymentDetailsPayload({})).toBeNull();
        expect(toOfflinePaymentDetailsPayload({ mode: null, reference: '  ', extra: { bank_name: '' } })).toBeNull();
        expect(
            toOfflinePaymentDetailsPayload({ mode: 'UPI', sub_mode: 'PHONEPE', reference: ' R1 ', extra: { bank_name: '', payer_name: 'A' } })
        ).toEqual({
            mode: 'UPI',
            sub_mode: 'PHONEPE',
            reference: 'R1',
            payment_date: null,
            notes: null,
            proof_file_id: null,
            extra: { payer_name: 'A' },
        });
        // An option without its mode is never sent.
        expect(toOfflinePaymentDetailsPayload({ sub_mode: 'PHONEPE', reference: 'R' })?.sub_mode).toBeNull();
    });
});
