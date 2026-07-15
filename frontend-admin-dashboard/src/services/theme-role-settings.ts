import { GET_INSTITUTE_SETTING_DATA, SAVE_INSTITUTE_SETTING } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { THEME_ROLE_SETTINGS_KEY, type ThemeRoleSettings } from '@/types/theme-role-settings';

export const SETTING_KEY_THEME = 'THEME_SETTING';

const getInstituteId = (): string => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const instituteIds = Object.keys(tokenData?.authorities || {});
    if (instituteIds.length === 0) throw new Error('No institute ID found in token');
    return instituteIds[0]!;
};

export const getThemeRoleSettings = async (): Promise<ThemeRoleSettings | null> => {
    try {
        const instituteId = getInstituteId();
        const response = await authenticatedAxiosInstance.get(GET_INSTITUTE_SETTING_DATA, {
            params: { instituteId, settingKey: SETTING_KEY_THEME },
        });
        const raw = response.data;
        if (!raw || typeof raw !== 'object' || !raw.roles) return null;
        return raw as ThemeRoleSettings;
    } catch (err) {
        console.error('Failed to load theme role settings', err);
        return null;
    }
};

/**
 * Saves the role-based theme. Passing `nav: null` clears the nav override
 * (institute reverts to the default that mirrors today's sidebar look).
 */
export const saveThemeRoleSettings = async (settings: ThemeRoleSettings): Promise<void> => {
    const instituteId = getInstituteId();
    // Backend GenericSettingRequest uses @JsonNaming(SnakeCaseStrategy) so the
    // wire format must be snake_case — sending camelCase here means
    // setting_data arrives as null and the save silently no-ops.
    await authenticatedAxiosInstance.post(
        SAVE_INSTITUTE_SETTING,
        {
            setting_name: 'Theme Setting',
            setting_data: settings,
        },
        {
            params: { instituteId, settingKey: SETTING_KEY_THEME },
        }
    );
    // Keep the locally-cached copy theme-provider.tsx reads in sync so the
    // new nav role applies immediately without waiting for the next
    // institute-details fetch.
    if (settings.roles?.nav) {
        localStorage.setItem(THEME_ROLE_SETTINGS_KEY, JSON.stringify(settings));
    } else {
        localStorage.removeItem(THEME_ROLE_SETTINGS_KEY);
    }
};
