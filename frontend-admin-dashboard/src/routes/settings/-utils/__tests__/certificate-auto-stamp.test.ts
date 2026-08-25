import { describe, expect, it } from 'vitest';
import { planFromFieldNames, planFromHtml } from '../certificate-auto-badge';

/**
 * Whether the platform stamps a code and the certificate number onto a design.
 *
 * <p>It used to be unconditional: a design that did not place them got them
 * bottom-right, always. So deleting the QR from a design did nothing — it came
 * back on the issued PDF, and there was no setting anywhere to stop it. These
 * pin the switch that closes that loop, and the default that keeps every
 * existing institute exactly as it was.
 */

describe('what gets stamped automatically', () => {
    it('stamps both on a design that places neither', () => {
        expect(planFromFieldNames(['student_name'])).toEqual({
            code: true,
            id: true,
            any: true,
        });
    });

    /** A field placed on the design always wins over the stamp. */
    it('stops stamping the part the design places itself', () => {
        expect(planFromFieldNames(['certificate_qr'])).toMatchObject({ code: false, id: true });
        expect(planFromFieldNames(['certificate_barcode'])).toMatchObject({ code: false });
        expect(planFromFieldNames(['certificate_id'])).toMatchObject({ code: true, id: false });
        expect(planFromFieldNames(['certificate_qr', 'certificate_id'])).toEqual({
            code: false,
            id: false,
            any: false,
        });
    });

    /** The reported bug, as a setting: turning the code off keeps it off. */
    it('stamps nothing the institute has switched off', () => {
        expect(planFromFieldNames(['student_name'], { code: false })).toMatchObject({
            code: false,
            id: true,
        });
        expect(planFromFieldNames(['student_name'], { number: false })).toMatchObject({
            code: true,
            id: false,
        });
        expect(planFromFieldNames(['student_name'], { code: false, number: false })).toEqual({
            code: false,
            id: false,
            any: false,
        });
    });

    /** Absent means on — every institute that saved before the switch existed. */
    it('treats an unset switch as on', () => {
        expect(planFromFieldNames(['student_name'], {})).toMatchObject({ code: true, id: true });
        expect(
            planFromFieldNames(['student_name'], { code: undefined, number: undefined })
        ).toMatchObject({ code: true, id: true });
    });
});

describe('reading a design written as HTML', () => {
    it('sees the tokens a hand-authored template places', () => {
        expect(planFromHtml('<p>{{CERTIFICATE_QR}}</p>')).toMatchObject({ code: false, id: true });
        expect(planFromHtml('<p>{{CERTIFICATE_ID}}</p>')).toMatchObject({ code: true, id: false });
    });

    /** Templates pasted out of Word arrive spaced; a strict match would double-stamp. */
    it('tolerates spacing inside the token', () => {
        expect(planFromHtml('<p>{{ certificate_id }}</p>')).toMatchObject({ id: false });
    });

    it('honours the switch for HTML templates too', () => {
        expect(planFromHtml('<p>nothing placed</p>', { code: false, number: false })).toEqual({
            code: false,
            id: false,
            any: false,
        });
    });
});
