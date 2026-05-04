import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { INIT_INSTITUTE_WITHOUT_BATCHES } from '@/constants/urls';

interface InstituteDetailsLite {
    institute_name?: string;
    instituteName?: string;
    institute_logo_file_id?: string;
}

export function useStudioName(instituteId: string | undefined) {
    const enabled = !!instituteId;
    return useQuery({
        queryKey: ['vimotion-studio-name', instituteId],
        queryFn: async (): Promise<string | null> => {
            const res = await authenticatedAxiosInstance.get<InstituteDetailsLite>(
                `${INIT_INSTITUTE_WITHOUT_BATCHES}/${instituteId}`
            );
            return res.data.institute_name ?? res.data.instituteName ?? null;
        },
        enabled,
        staleTime: 10 * 60 * 1000,
        retry: false,
    });
}
