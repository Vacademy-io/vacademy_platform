import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { InstituteDetailsType } from '@/schemas/student/student-list/institute-schema';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { INIT_INSTITUTE } from '@/constants/urls';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { useTheme } from '@/providers/theme/theme-provider';

const fetchInstituteDetails = async (): Promise<InstituteDetailsType> => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const data = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = data && Object.keys(data.authorities)[0];
    const response = await authenticatedAxiosInstance<InstituteDetailsType>({
        method: 'GET',
        url: `${INIT_INSTITUTE}/${INSTITUTE_ID}`,
    });
    return response.data;
};

export const useInstituteQuery = () => {
    const setInstituteDetails = useInstituteDetailsStore((state) => state.setInstituteDetails);
    const { setPrimaryColor } = useTheme();

    return {
        queryKey: ['GET_INIT_INSTITUTE'],
        queryFn: async () => {
            const data = await fetchInstituteDetails();
            setPrimaryColor(data?.institute_theme_code || '#ED7424');
            setInstituteDetails(data);
            return data;
        },
        staleTime: 3600000,
    };
};
