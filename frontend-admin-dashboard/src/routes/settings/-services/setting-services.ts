import { getInstituteId } from '@/constants/helper';
import {
    CERTIFICATE_NUMBERING_STATUS,
    CERTIFICATE_VERIFICATION_DOCUMENT_UPLOAD,
    CONFIGURE_CERTIFICATE_SETTINGS,
} from '@/constants/urls';
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
        /**
         * Where the series should begin — for an institute continuing from
         * paper records or another system. A floor, not a set: the backend
         * takes max(counter + 1, startFrom), so raising it moves the series
         * forward and lowering it below what is already issued does nothing.
         * The certificate number is the issued row's primary key, so reusing
         * one is not an option.
         */
        startFrom?: number;
        /**
         * Whether the counter restarts every 1 January. Omit or send true for
         * the historical behaviour; false keeps one unbroken series, which is
         * what a format with no {YYYY}/{YY} token needs in order to stay unique
         * across a year boundary.
         */
        resetAnnually?: boolean;
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
     * What a scanned code opens. Omit or send 'PAGE' for the hosted verification
     * page — the behaviour every institute had before documents existed.
     */
    verificationMode?: 'PAGE' | 'DOCUMENT';
    /** 'HTML' is designed here and carries dynamic fields; 'PDF' is served as-is. */
    verificationDocumentType?: 'HTML' | 'PDF';
    /**
     * The designed document. Omitted rather than blanked when empty: the backend
     * merge preserves on null, so sending '' would wipe a document the admin did
     * not touch on this visit.
     */
    verificationDocumentHtml?: string;
    verificationDocumentFileId?: string;
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

export interface CertificateNumberingStatus {
    /** Position the next certificate would take, with the start number applied. */
    nextSequence: number;
    /** Highest position already handed out; 0 when nothing has been issued. */
    highestIssuedSequence: number;
    /** Counter this reflects: the issuance year, or 0 for a series that never resets. */
    bucket: number;
    /** True when the start number sits at or below what is already issued, so it does nothing. */
    startFromIgnored: boolean;
}

/**
 * Read where the certificate counter stands.
 *
 * <p>The numbering screen needs this to show real sample numbers. Without it the
 * samples were hardcoded 1/2/3, which reads as "your series starts at 1" to an
 * institute already sitting at 1200 — and made it impossible to tell an admin
 * that the start number they just typed is below what has already been printed.
 */
export const getCertificateNumberingStatus = async (params?: {
    startFrom?: number;
    resetAnnually?: boolean;
}): Promise<CertificateNumberingStatus> => {
    const response = await authenticatedAxiosInstance.get(CERTIFICATE_NUMBERING_STATUS, {
        params: {
            instituteId: getInstituteId(),
            startFrom: params?.startFrom,
            resetAnnually: params?.resetAnnually,
        },
    });
    return response?.data;
};

export interface VerificationDocumentCanvas {
    background_file_id: string;
    background_url: string;
    width_px: number;
    height_px: number;
    page_width_mm: number;
    page_height_mm: number;
    page_count: number;
}

/**
 * Upload a verification PDF and get back a canvas to lay fields on.
 *
 * <p>The PDF's first page is rasterised server-side, because a PDF has no canvas
 * a browser can drop a field onto. What comes back is ordinary background
 * artwork, so the certificate editor works on it unchanged.
 *
 * <p>Nothing is persisted by this call — the admin still has to place fields and
 * save, so abandoning the screen leaves the current verification setup alone.
 */
export const uploadVerificationDocument = async (
    file: File
): Promise<VerificationDocumentCanvas> => {
    const body = new FormData();
    body.append('file', file);
    const response = await authenticatedAxiosInstance.post(
        CERTIFICATE_VERIFICATION_DOCUMENT_UPLOAD,
        body,
        { params: { instituteId: getInstituteId() } }
    );
    return response?.data;
};
