import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { OPEN_DOUBT_CONFIG } from '@/constants/urls';

export interface GuestQueryTypeOption {
    key: string;
    label: string;
}

export interface PublicDoubtConfig {
    learner_query: { enabled: boolean; allow_guest: boolean };
    query_types: GuestQueryTypeOption[];
}

const DISABLED: PublicDoubtConfig = {
    learner_query: { enabled: false, allow_guest: false },
    query_types: [],
};

/**
 * Public (unauthenticated) query-intake config for an institute, used to gate the login page's
 * guest "Need help?" button. Same axios instance as domain-routing — works pre-auth since the
 * endpoint is under /open/**. Any failure reads as "disabled" so the login page is never affected.
 */
const fetchPublicDoubtConfig = async (instituteId: string): Promise<PublicDoubtConfig> => {
    try {
        const response = await authenticatedAxiosInstance.get(OPEN_DOUBT_CONFIG, {
            params: { instituteId },
        });
        const data = response.data ?? {};
        return {
            learner_query: {
                enabled: data?.learner_query?.enabled === true,
                allow_guest: data?.learner_query?.allow_guest === true,
            },
            query_types: Array.isArray(data?.query_types) ? data.query_types : [],
        };
    } catch {
        return DISABLED;
    }
};

export const usePublicDoubtConfig = (instituteId: string | null | undefined) => {
    const query = useQuery({
        queryKey: ['PUBLIC_DOUBT_CONFIG', instituteId],
        queryFn: () => fetchPublicDoubtConfig(instituteId!),
        enabled: !!instituteId,
        staleTime: 5 * 60 * 1000,
        retry: 1,
    });

    const config = query.data ?? DISABLED;
    return {
        guestQueriesEnabled: config.learner_query.enabled && config.learner_query.allow_guest,
        guestQueryTypes: config.query_types,
        ...query,
    };
};
