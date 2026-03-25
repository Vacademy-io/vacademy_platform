import { getInstituteId } from '@/constants/helper';
import { CONFIGURE_CERTIFICATE_SETTINGS } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { certificateHtml } from '../-utils/certificate-html';

export const handleConfigureCertificateSettings = async (
    isEnabled: boolean,
    isCertificateExists: boolean,
    placeHoldersMapping: Record<string, string>
) => {
    const instituteId = getInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: CONFIGURE_CERTIFICATE_SETTINGS,
        params: {
            instituteId,
        },
        data: !isCertificateExists
            ? { request: null }
            : {
                  request: {
                      COURSE_COMPLETION: {
                          key: 'COURSE_COMPLETION',
                          isDefaultCertificateSettingOn: isEnabled,
                          defaultHtmlCertificateTemplate: certificateHtml,
                          currentHtmlCertificateTemplate: certificateHtml,
                          customHtmlCertificateTemplate: null,
                          placeHoldersMapping: placeHoldersMapping,
                      },
                  },
              },
    });
    return response?.data;
};
