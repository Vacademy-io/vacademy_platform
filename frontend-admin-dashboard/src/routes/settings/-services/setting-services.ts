import { getInstituteId } from '@/constants/helper';
import { CONFIGURE_CERTIFICATE_SETTINGS } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { certificateHtml } from '../-utils/certificate-html';

export type CertificateAspectRatio =
    | 'A4_LANDSCAPE'
    | 'A4_PORTRAIT'
    | 'A3_LANDSCAPE'
    | 'A3_PORTRAIT'
    | 'CUSTOM';

export interface CertificateSavePayload {
    isEnabled: boolean;
    isCertificateExists: boolean;
    placeHoldersMapping: Record<string, string>;
    currentHtmlTemplate?: string;
    autoIssuePercentage?: number;
    aspectRatio?: CertificateAspectRatio;
    customWidthMm?: number;
    customHeightMm?: number;
    /**
     * Raw visual-editor state (image data URL + field mappings) serialized as
     * JSON. Stored alongside the rendered HTML so the editor can round-trip
     * without forcing admins to re-upload their image.
     */
    imageTemplateJson?: string;
    /**
     * The admin's hand-authored HTML, persisted independently of
     * currentHtmlCertificateTemplate so a Visual-mode save doesn't wipe it.
     * Send `undefined` to preserve whatever the server already has.
     */
    htmlEditorTemplate?: string;
    /**
     * Which editor the admin last saved in. The frontend uses it to open the
     * page in the right mode on next load. Backend stores it verbatim.
     */
    preferredEditorMode?: 'visual' | 'html';
    /**
     * Certificate number format. Omit to keep the shipped default —
     * {PREFIX}{YYYY}{SEQ:3}, i.e. EDU2026001 — where PREFIX is the first three
     * letters of the institute name.
     */
    certificateNumbering?: {
        pattern?: string;
        prefix?: string;
        suffix?: string;
        sequencePadding?: number;
    };
    /**
     * What {{CERTIFICATE_QR}} encodes. Blank encodes the bare certificate
     * number; a URL containing {{CERTIFICATE_ID}} makes a scan open a
     * verification page instead.
     */
    qrVerificationUrlTemplate?: string;
    /** Which code is stamped beside the number on every certificate. */
    badgeCodeType?: 'QR' | 'BARCODE';
    /**
     * What the Barcode field encodes. `NUMBER` (the default) prints the bare
     * certificate number, which scans to a string but verifies nothing.
     * `VERIFICATION_CODE` prints `NUMBER*CODE`, which the public verify page
     * resolves — at the cost of a wider barcode.
     */
    barcodeContent?: BarcodeContent;
    /**
     * Whether the platform may stamp the code / the number bottom-right on a
     * design that does not place them itself. Both default to true server-side,
     * which is what the badge always did.
     */
    autoStampCode?: boolean;
    autoStampNumber?: boolean;
    /**
     * The public verification page's own settings. '' clears a text field;
     * undefined leaves whatever the server holds.
     */
    verificationNote?: string;
    verificationHeadline?: string;
    verificationShowCourse?: boolean;
    verificationShowIssueDate?: boolean;
    verificationShowCompletion?: boolean;
    /**
     * Admin-defined fields, for values the platform has no built-in token for.
     * Each becomes a draggable chip and a {{CF_<KEY>}} token on the template.
     * Send `[]` to clear them; `undefined` preserves what the server has.
     */
    customFields?: CertificateCustomField[];
}

export type BarcodeContent = 'NUMBER' | 'VERIFICATION_CODE';

export interface CertificateCustomField {
    /** Uppercase A–Z, 0–9 and underscores. Rendered as {{CF_<KEY>}}. */
    key: string;
    displayName: string;
    /** STATIC = the same text on every certificate; CUSTOM_FIELD = the learner's own answer. */
    valueType: 'STATIC' | 'CUSTOM_FIELD';
    /** The literal text for STATIC; the learner custom field's key for CUSTOM_FIELD. */
    value: string;
    /** Printed when a CUSTOM_FIELD lookup finds no answer. */
    fallbackValue?: string;
}

export const handleConfigureCertificateSettings = async (
    isEnabledOrPayload: boolean | CertificateSavePayload,
    isCertificateExists?: boolean,
    placeHoldersMapping?: Record<string, string>
) => {
    // Backwards-compatible: keep the old positional signature working while
    // letting new call sites pass a structured payload with the additional
    // fields added by the certificate redesign (threshold, aspect ratio,
    // custom HTML template).
    const payload: CertificateSavePayload =
        typeof isEnabledOrPayload === 'boolean'
            ? {
                  isEnabled: isEnabledOrPayload,
                  isCertificateExists: !!isCertificateExists,
                  placeHoldersMapping: placeHoldersMapping ?? {},
              }
            : isEnabledOrPayload;

    const instituteId = getInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: CONFIGURE_CERTIFICATE_SETTINGS,
        params: {
            instituteId,
        },
        data: !payload.isCertificateExists
            ? { request: null }
            : {
                  request: {
                      COURSE_COMPLETION: {
                          key: 'COURSE_COMPLETION',
                          isDefaultCertificateSettingOn: payload.isEnabled,
                          defaultHtmlCertificateTemplate: certificateHtml,
                          currentHtmlCertificateTemplate:
                              payload.currentHtmlTemplate ?? certificateHtml,
                          customHtmlCertificateTemplate: null,
                          placeHoldersMapping: payload.placeHoldersMapping,
                          autoIssuePercentage: payload.autoIssuePercentage,
                          aspectRatio: payload.aspectRatio,
                          customWidthMm: payload.customWidthMm,
                          customHeightMm: payload.customHeightMm,
                          imageTemplateJson: payload.imageTemplateJson,
                          htmlEditorTemplate: payload.htmlEditorTemplate,
                          preferredEditorMode: payload.preferredEditorMode,
                          certificateNumbering: payload.certificateNumbering,
                          qrVerificationUrlTemplate: payload.qrVerificationUrlTemplate,
                          badgeCodeType: payload.badgeCodeType,
                          // These two were declared on the payload type but
                          // never put in the request body, so the backend's
                          // preserve-on-null merge kept the old values while
                          // the settings page patched its local store with the
                          // new ones. The admin saw the change stick until the
                          // next hard reload, then watched it revert.
                          barcodeContent: payload.barcodeContent,
                          autoStampCode: payload.autoStampCode,
                          autoStampNumber: payload.autoStampNumber,
                          verificationNote: payload.verificationNote,
                          verificationHeadline: payload.verificationHeadline,
                          verificationShowCourse: payload.verificationShowCourse,
                          verificationShowIssueDate: payload.verificationShowIssueDate,
                          verificationShowCompletion: payload.verificationShowCompletion,
                          customFields: payload.customFields,
                      },
                  },
              },
    });
    return response?.data;
};
