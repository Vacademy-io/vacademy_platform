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
                      },
                  },
              },
    });
    return response?.data;
};
