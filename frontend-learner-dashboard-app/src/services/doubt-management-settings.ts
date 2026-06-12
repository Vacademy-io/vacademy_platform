import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSTITUTE_SETTING_DATA } from '@/constants/urls';
import { getInstituteId } from '@/utils/study-library/get-list-from-stores/getPackageSessionId';

export interface LearnerQueryPrefs {
    enabled: boolean;
    show_topbar_icon: boolean;
    show_dashboard_card: boolean;
}

export interface LearnerQueryType {
    key: string;
    label: string;
    enabled?: boolean;
    learner_selectable?: boolean;
}

export interface DoubtManagementSetting {
    learner_query: LearnerQueryPrefs;
    query_types: LearnerQueryType[];
}

const SETTING_KEY = 'DOUBT_MANAGEMENT_SETTING';

const DISABLED_DEFAULT: DoubtManagementSetting = {
    learner_query: { enabled: false, show_topbar_icon: false, show_dashboard_card: false },
    query_types: [],
};

const fetchDoubtManagementSetting = async (): Promise<DoubtManagementSetting> => {
    const instituteId = await getInstituteId();
    if (!instituteId) return DISABLED_DEFAULT;
    try {
        const response = await authenticatedAxiosInstance({
            method: 'GET',
            url: GET_INSTITUTE_SETTING_DATA,
            params: { instituteId, settingKey: SETTING_KEY },
        });
        const data = response.data ?? {};
        return {
            learner_query: {
                enabled: data?.learner_query?.enabled ?? false,
                show_topbar_icon: data?.learner_query?.show_topbar_icon ?? false,
                show_dashboard_card: data?.learner_query?.show_dashboard_card ?? false,
            },
            query_types: Array.isArray(data?.query_types) ? data.query_types : [],
        };
    } catch {
        // Setting absent / unreachable → keep the entry points hidden (existing institutes).
        return DISABLED_DEFAULT;
    }
};

/**
 * Reads the institute's DOUBT_MANAGEMENT_SETTING to gate the learner query entry points and supply
 * the selectable type list. Defaults to "disabled" so institutes that haven't opted in are
 * unaffected. Returns convenience flags for the two entry points.
 */
export const useDoubtManagementSetting = () => {
    const query = useQuery({
        queryKey: ['LEARNER_DOUBT_MANAGEMENT_SETTING'],
        queryFn: fetchDoubtManagementSetting,
        staleTime: 5 * 60 * 1000,
    });

    const setting = query.data ?? DISABLED_DEFAULT;
    const selectableTypes = (setting.query_types ?? []).filter(
        (t) => t.enabled !== false && t.learner_selectable !== false
    );
    // Require at least one selectable type — otherwise the entry points would open a dialog with an
    // empty type dropdown and a permanently-disabled submit (a dead end).
    const learnerQueryEnabled = setting.learner_query.enabled === true && selectableTypes.length > 0;

    return {
        setting,
        learnerQueryEnabled,
        showTopbarIcon: learnerQueryEnabled && setting.learner_query.show_topbar_icon === true,
        showDashboardCard: learnerQueryEnabled && setting.learner_query.show_dashboard_card === true,
        selectableTypes,
        ...query,
    };
};
