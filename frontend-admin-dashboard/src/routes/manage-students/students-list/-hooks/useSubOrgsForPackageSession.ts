import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_SUB_ORGS_BY_PACKAGE_SESSION } from '@/constants/urls';
import { PackageSessionSubOrg } from '../-types/bulk-assign-types';

const fetchSubOrgsForPackageSession = async (
    packageSessionId: string
): Promise<PackageSessionSubOrg[]> => {
    const response = await authenticatedAxiosInstance.get<PackageSessionSubOrg[]>(
        GET_SUB_ORGS_BY_PACKAGE_SESSION,
        { params: { packageSessionId } }
    );
    return response.data ?? [];
};

/**
 * Sub-organizations that already have members in one package session, each with its admins
 * (name + email). Only meaningful for batches flagged `is_org_associated`.
 */
export const useSubOrgsForPackageSession = ({
    packageSessionId,
    enabled = true,
}: {
    packageSessionId: string;
    enabled?: boolean;
}) => {
    return useQuery({
        queryKey: ['sub-orgs-for-ps', packageSessionId],
        queryFn: () => fetchSubOrgsForPackageSession(packageSessionId),
        enabled: enabled && !!packageSessionId,
        staleTime: 60 * 1000,
    });
};
