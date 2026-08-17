/**
 * Sample values the certificate previews substitute for template tokens.
 *
 * <p>Both previews — the HTML editor's and the visual editor's — need the same
 * map, and until this existed they each carried their own copy. They had
 * already drifted: only one of them substituted {{USER_ID}}, so the same
 * template previewed differently depending on which editor you opened it in,
 * and a token that rendered fine in one showed up raw in the other.
 *
 * A preview whose values differ from the issued certificate is worse than no
 * preview, because an admin signs off on it.
 */
import {
    CERTIFICATE_BARCODE_PLACEHOLDER,
    CERTIFICATE_QR_PLACEHOLDER,
} from './certificate-code-placeholders';
import type { CertificateCustomField } from '../-services/setting-services';
import { normalizeCustomFieldKey } from './serialize-image-template-to-html';

/** Shown when a logo is missing, so the preview has no broken-image icon. */
const TRANSPARENT_GIF =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export interface CertificateSampleOptions {
    sampleCertificateId: string;
    instituteName?: string;
    logoUrl?: string;
    /** The institute's own fields, so they preview with the value they'll print. */
    customFields?: CertificateCustomField[];
}

export function buildCertificateSampleTokens({
    sampleCertificateId,
    instituteName,
    logoUrl,
    customFields = [],
}: CertificateSampleOptions): Record<string, string> {
    const today = new Date().toLocaleDateString();

    const samples: Record<string, string> = {
        '{{STUDENT_NAME}}': 'Alex Sample',
        '{{INSTITUTE_NAME}}': instituteName || 'Vacademy Institute',
        '{{COURSE_NAME}}': 'Intro to Sample Course',
        '{{PACKAGE_NAME}}': 'Foundation Package',
        '{{PACKAGE_LEVEL}}': 'Beginner',
        '{{SESSION_NAME}}': '2025-26',
        '{{COMPLETION_PERCENTAGE}}': '92',
        '{{DATE_OF_COMPLETION}}': today,
        // Legacy alias kept so previews of pre-rename templates still
        // substitute correctly.
        '{{ISSUE_DATE}}': today,
        '{{CERTIFICATE_ID}}': sampleCertificateId,
        // Schematic stand-ins: the real codes only exist once a number is
        // allocated at issuance, but leaving the token unsubstituted would
        // render a broken image in the preview.
        '{{CERTIFICATE_QR}}': CERTIFICATE_QR_PLACEHOLDER,
        '{{CERTIFICATE_BARCODE}}': CERTIFICATE_BARCODE_PLACEHOLDER,
        // Same shape as a real short code (10 Crockford base32 characters), so
        // an admin sizing a text box for it sees the width it will really take.
        '{{CERTIFICATE_SHORT_CODE}}': 'A1B2C3D4E5',
        '{{ENROLLMENT_NUMBER}}': 'ENR2024001',
        '{{EMAIL}}': 'student@example.com',
        '{{MOBILE_NUMBER}}': '+1 555 0100',
        '{{USER_ID}}': 'PREVIEW_USER',
        // Legacy tokens used by the bundled default template and older saved
        // templates. The backend fills these via its numeric placeholder pass
        // (LEVEL->2, TODAY_DATE->9, DESIGNATION->6, SIGNATURE->7); mirror them
        // here so the preview matches the issued certificate instead of showing
        // raw {{TOKEN}} text.
        '{{LEVEL}}': 'Beginner',
        '{{TODAY_DATE}}': today,
        '{{DESIGNATION}}': 'Official Signatory',
        '{{SIGNATURE}}': '',
        // Sample data substituted into the generated certificate document, not
        // app UI. Mirrors the backend's fallback so the preview matches the PDF.
        '{{INSTITUTE_THEME_COLOR}}': '#1e4fa1', // design-lint-ignore
        '{{INSTITUTE_LOGO}}': logoUrl || TRANSPARENT_GIF,
    };

    for (const field of customFields) {
        const key = normalizeCustomFieldKey(field.key || '');
        if (!key) continue;
        // A learner-sourced field has no value until issuance, so the preview
        // shows what an unanswered one would print — the fallback. Showing the
        // field's *key* instead would let an admin size a box for text that is
        // nothing like what prints.
        samples[`{{CF_${key}}}`] =
            field.valueType === 'CUSTOM_FIELD'
                ? field.fallbackValue || 'Sample value'
                : field.value ?? '';
    }

    return samples;
}

/** Apply the sample map to a template. Plain string replacement, as the backend does. */
export function applyCertificateSamples(html: string, samples: Record<string, string>): string {
    let out = html || '';
    for (const [token, value] of Object.entries(samples)) {
        out = out.split(token).join(value);
    }
    return out;
}
