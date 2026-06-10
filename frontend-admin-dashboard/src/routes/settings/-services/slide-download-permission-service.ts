import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getInstituteId } from '@/constants/helper';
import { GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import {
    SLIDE_DOWNLOAD_PERMISSION_SETTING_KEY,
    EMPTY_SLIDE_DOWNLOAD_DATA,
    type SlideDownloadPermissionData,
} from '@/constants/slide-download-permission';

// The generic setting endpoints: `/get` reads a SettingDto ({ key, name, data }),
// `/save-setting` upserts via GenericSettingStrategy. Same pattern as the other
// generic settings (Doubt/Lead/Tnc/Gtm).
const SAVE_URL = GET_INSITITUTE_SETTINGS.replace('/get', '/save-setting');

/**
 * Fetch the stored slide-download-permission blob. Returns an empty (allow-all
 * by default) shape when the setting has never been saved or the read fails, so
 * the grid renders defaults rather than erroring.
 */
export const getSlideDownloadPermission = async (): Promise<SlideDownloadPermissionData> => {
    const instituteId = getInstituteId();
    try {
        const response = await authenticatedAxiosInstance({
            method: 'GET',
            url: GET_INSITITUTE_SETTINGS,
            params: { instituteId, settingKey: SLIDE_DOWNLOAD_PERMISSION_SETTING_KEY },
            // The shared axios instance has no timeout. PDFViewer now blocks
            // rendering until this resolves (isResolved gate), so a hung request
            // (server accepts the socket but never replies) would leave the PDF
            // stuck on "Loading…" forever. Bound it: on timeout axios rejects,
            // the catch below returns the default-allow shape, and the PDF renders.
            timeout: 8000,
        });
        const stored = response.data?.data ?? null;
        if (!stored || typeof stored !== 'object') {
            return { ...EMPTY_SLIDE_DOWNLOAD_DATA };
        }
        return {
            version: typeof stored.version === 'number' ? stored.version : 1,
            slideTypes: stored.slideTypes ?? {},
        };
    } catch {
        return { ...EMPTY_SLIDE_DOWNLOAD_DATA };
    }
};

/** Upsert the full slide-download-permission blob. */
export const saveSlideDownloadPermission = async (
    data: SlideDownloadPermissionData
): Promise<void> => {
    const instituteId = getInstituteId();
    await authenticatedAxiosInstance.post(
        SAVE_URL,
        { setting_name: 'Slide Download Permissions', setting_data: data },
        { params: { instituteId, settingKey: SLIDE_DOWNLOAD_PERMISSION_SETTING_KEY } }
    );
};
