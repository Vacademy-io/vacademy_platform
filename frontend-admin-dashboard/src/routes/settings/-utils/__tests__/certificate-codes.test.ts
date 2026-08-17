import { describe, expect, it } from 'vitest';
import {
    codeAspectRatio,
    codeScanWarning,
    codeSizeMm,
    isCodeFieldName,
    minBarcodeWidthMm,
} from '../certificate-auto-badge';
import {
    CUSTOM_FIELD_PREFIX,
    fieldNameToToken,
    normalizeCustomFieldKey,
} from '../serialize-image-template-to-html';
import { buildCertificateSampleTokens } from '../certificate-preview-samples';

/**
 * Certificate codes and admin-defined fields.
 *
 * The failure these guard against is silent: a code that looks right in the
 * editor and cannot be scanned off the printed certificate, or a field that
 * prints a raw `{{TOKEN}}` on a learner's PDF. Neither shows up until someone
 * is holding the paper.
 */

// A4 landscape, the default page size.
const PAGE_WIDTH_MM = 297;
const CANVAS_WIDTH_PX = 1123; // 297mm at 96dpi
const pxForMm = (mm: number) => (mm / PAGE_WIDTH_MM) * CANVAS_WIDTH_PX;

describe('barcode sizing', () => {
    /**
     * The reason a verifying barcode needs its own size: it carries the number
     * plus a 10-character code, roughly twice the payload of the number alone.
     */
    it('needs about twice the width when it carries a verification code', () => {
        const number = minBarcodeWidthMm('NUMBER');
        const verifying = minBarcodeWidthMm('VERIFICATION_CODE');
        expect(verifying).toBeGreaterThan(number * 1.7);
    });

    it('defaults a verifying barcode wide enough to actually scan', () => {
        const { widthMm } = codeSizeMm('BARCODE', 'VERIFICATION_CODE');
        expect(widthMm).toBeGreaterThanOrEqual(minBarcodeWidthMm('VERIFICATION_CODE'));
    });

    it('defaults a number-only barcode wide enough to actually scan', () => {
        const { widthMm } = codeSizeMm('BARCODE', 'NUMBER');
        expect(widthMm).toBeGreaterThanOrEqual(minBarcodeWidthMm('NUMBER'));
    });

    /** A verifying barcode still has to fit on the page it is printed on. */
    it('stays well inside an A4 landscape page', () => {
        expect(codeSizeMm('BARCODE', 'VERIFICATION_CODE').widthMm).toBeLessThan(
            PAGE_WIDTH_MM / 2
        );
    });
});

describe('code scan warnings', () => {
    const warn = (over: Partial<Parameters<typeof codeScanWarning>[0]>) =>
        codeScanWarning({
            fieldName: 'certificate_barcode',
            widthPx: pxForMm(60),
            heightPx: pxForMm(14),
            canvasWidthPx: CANVAS_WIDTH_PX,
            canvasWidthMm: PAGE_WIDTH_MM,
            barcodeContent: 'VERIFICATION_CODE',
            ...over,
        });

    it('says nothing about a correctly sized code', () => {
        expect(warn({})).toBeNull();
        expect(
            warn({
                fieldName: 'certificate_qr',
                widthPx: pxForMm(20),
                heightPx: pxForMm(20),
            })
        ).toBeNull();
    });

    /**
     * The specific trap: a barcode sized for the bare number, then switched to
     * carry a verification code. It looks unchanged and stops scanning.
     */
    it('flags a verifying barcode left at the number-only width', () => {
        const message = warn({ widthPx: pxForMm(34) });
        expect(message).toContain('too thin');
        expect(message).toContain('number only');
    });

    it('flags a barcode too short to be found by a scanner', () => {
        expect(warn({ heightPx: pxForMm(4) })).toContain('tall');
    });

    /** A stretched QR has non-square modules and scanners reject it. */
    it('flags a stretched QR', () => {
        expect(
            warn({
                fieldName: 'certificate_qr',
                widthPx: pxForMm(40),
                heightPx: pxForMm(14),
            })
        ).toContain('stretched');
    });

    it('flags a QR too small to read in print', () => {
        expect(
            warn({
                fieldName: 'certificate_qr',
                widthPx: pxForMm(8),
                heightPx: pxForMm(8),
            })
        ).toContain('across');
    });

    /** Only code fields have a scannability constraint. */
    it('never warns about a text field', () => {
        expect(warn({ fieldName: 'student_name', widthPx: 4, heightPx: 4 })).toBeNull();
    });
});

describe('code aspect ratios', () => {
    it('locks a QR to square', () => {
        expect(codeAspectRatio('certificate_qr')).toBe(1);
    });

    it('keeps a verifying barcode wider than a number-only one', () => {
        expect(codeAspectRatio('certificate_barcode', 'VERIFICATION_CODE')).toBeGreaterThan(
            codeAspectRatio('certificate_barcode', 'NUMBER')
        );
    });

    it('knows which fields are codes', () => {
        expect(isCodeFieldName('certificate_qr')).toBe(true);
        expect(isCodeFieldName('certificate_barcode')).toBe(true);
        expect(isCodeFieldName('student_name')).toBe(false);
        expect(isCodeFieldName('custom_image:abc')).toBe(false);
    });
});

describe('custom field tokens', () => {
    /**
     * The whole point of the CF_ namespace: admins choose these keys, and an
     * unprefixed one would shadow a built-in token and silently print a
     * constant where every learner's name should be.
     */
    it('namespaces admin keys so they cannot shadow built-in tokens', () => {
        expect(fieldNameToToken(`${CUSTOM_FIELD_PREFIX}STUDENT_NAME`)).toBe(
            '{{CF_STUDENT_NAME}}'
        );
        expect(fieldNameToToken('student_name')).toBe('{{STUDENT_NAME}}');
    });

    it('normalises keys the same way the backend does', () => {
        expect(normalizeCustomFieldKey('  final grade ')).toBe('FINAL_GRADE');
        expect(normalizeCustomFieldKey('Grade-2026')).toBe('GRADE_2026');
        expect(normalizeCustomFieldKey('__a...b__')).toBe('A_B');
        expect(normalizeCustomFieldKey('!!!')).toBe('');
    });

    /** A malformed key must not emit `{{CF_}}` onto a learner's certificate. */
    it('emits nothing for a key that normalises away', () => {
        expect(fieldNameToToken(`${CUSTOM_FIELD_PREFIX}!!!`)).toBe('');
    });

    it('still maps the built-in code fields to image tokens', () => {
        expect(fieldNameToToken('certificate_qr')).toBe('{{CERTIFICATE_QR}}');
        expect(fieldNameToToken('certificate_barcode')).toBe('{{CERTIFICATE_BARCODE}}');
        expect(fieldNameToToken('certificate_short_code')).toBe('{{CERTIFICATE_SHORT_CODE}}');
    });
});

describe('preview samples', () => {
    const samples = (customFields: Parameters<typeof buildCertificateSampleTokens>[0]['customFields']) =>
        buildCertificateSampleTokens({ sampleCertificateId: 'EDU2026001', customFields });

    it('previews a static field with the text it will print', () => {
        expect(
            samples([
                {
                    key: 'SIGNATORY',
                    displayName: 'Signatory',
                    valueType: 'STATIC',
                    value: 'Director of Studies',
                },
            ])['{{CF_SIGNATORY}}']
        ).toBe('Director of Studies');
    });

    /**
     * A learner-sourced field has no value until issuance. Previewing the
     * fallback rather than the field's key means the admin sizes the box
     * against text the length of what actually prints.
     */
    it('previews a learner field with its fallback', () => {
        expect(
            samples([
                {
                    key: 'GRADE',
                    displayName: 'Grade',
                    valueType: 'CUSTOM_FIELD',
                    value: 'final_grade',
                    fallbackValue: 'Pass',
                },
            ])['{{CF_GRADE}}']
        ).toBe('Pass');
    });

    /**
     * The two previews used to carry their own copies of this map and had
     * already drifted apart on {{USER_ID}}. Every token the palette offers has
     * to resolve, or it shows up raw in one preview and fine in the other.
     */
    it('covers every token the built-in palette can place', () => {
        const map = samples([]);
        for (const token of [
            '{{STUDENT_NAME}}',
            '{{INSTITUTE_NAME}}',
            '{{INSTITUTE_LOGO}}',
            '{{COURSE_NAME}}',
            '{{PACKAGE_NAME}}',
            '{{PACKAGE_LEVEL}}',
            '{{SESSION_NAME}}',
            '{{DATE_OF_COMPLETION}}',
            '{{COMPLETION_PERCENTAGE}}',
            '{{CERTIFICATE_ID}}',
            '{{CERTIFICATE_QR}}',
            '{{CERTIFICATE_BARCODE}}',
            '{{CERTIFICATE_SHORT_CODE}}',
            '{{ENROLLMENT_NUMBER}}',
            '{{EMAIL}}',
            '{{MOBILE_NUMBER}}',
            '{{USER_ID}}',
            '{{INSTITUTE_THEME_COLOR}}',
        ]) {
            expect(map, `missing preview sample for ${token}`).toHaveProperty(token);
        }
    });

    it('skips keyless custom fields rather than emitting a broken token', () => {
        const map = samples([
            { key: '  ', displayName: '', valueType: 'STATIC', value: 'x' },
        ]);
        expect(Object.keys(map).some((k) => k.startsWith('{{CF_'))).toBe(false);
    });
});
