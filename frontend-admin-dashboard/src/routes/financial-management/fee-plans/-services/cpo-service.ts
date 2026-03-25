import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { CREATE_CPO, GET_CPO_FULL_DETAILS, GET_CPO_LIST, GET_CPO_OPTIONS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import type {
    CPOListApiResponse,
    CPOListResponse,
    CPOPackage,
    CreateCPOPayload,
} from '../-types/cpo-types';

// ─── Fetch CPO options for a package session (legacy / select-picker) ───────────

export const fetchCPOOptions = async (packageSessionId: string): Promise<CPOPackage[]> => {
    const response = await authenticatedAxiosInstance.get(GET_CPO_OPTIONS(packageSessionId));
    return response.data;
};

export const useCPOOptions = (packageSessionId: string | null) => {
    return useQuery({
        queryKey: ['cpo-options', packageSessionId],
        queryFn: () => fetchCPOOptions(packageSessionId!),
        enabled: !!packageSessionId,
        staleTime: 30000,
    });
};

// ─── Fetch paginated CPO list for the current institute ─────────────────────────

export const fetchInstituteCPOList = async (
    instituteId: string,
    pageNo: number = 0,
    pageSize: number = 20
): Promise<CPOListApiResponse> => {
    const response = await authenticatedAxiosInstance.get<CPOListApiResponse>(
        GET_CPO_LIST(instituteId),
        { params: { pageNo, pageSize } }
    );

    const data = response.data;
    return {
        totalElements: data?.totalElements ?? 0,
        totalPages: data?.totalPages ?? 0,
        numberOfElements: data?.numberOfElements ?? data?.content?.length ?? 0,
        pageable: data?.pageable ?? {
            paged: true,
            unpaged: false,
            pageNumber: pageNo,
            pageSize,
            offset: pageNo * pageSize,
            sort: {
                unsorted: true,
                sorted: false,
                empty: true,
            },
        },
        size: data?.size ?? pageSize,
        content: data?.content ?? [],
        number: data?.number ?? pageNo,
        sort: data?.sort ?? {
            unsorted: true,
            sorted: false,
            empty: true,
        },
        first: data?.first ?? pageNo === 0,
        last: data?.last ?? true,
        empty: data?.empty ?? !(data?.content?.length > 0),
    };
};

export const useInstituteCPOList = (pageNo: number = 0, pageSize: number = 20) => {
    const instituteId = getCurrentInstituteId() ?? '';
    return useQuery({
        queryKey: ['institute-cpo-list', instituteId, pageNo, pageSize],
        queryFn: () => fetchInstituteCPOList(instituteId, pageNo, pageSize),
        enabled: !!instituteId,
        staleTime: 30000,
    });
};

export const fetchCPOFullDetails = async (cpoId: string): Promise<CPOPackage> => {
    const response = await authenticatedAxiosInstance.get<CPOPackage>(GET_CPO_FULL_DETAILS(cpoId));
    const data = response.data;
    return {
        ...data,
        fee_types: data?.fee_types ?? [],
        package_session_links: data?.package_session_links ?? [],
    };
};

export const useCPOFullDetails = (cpoId: string | null, enabled: boolean) => {
    return useQuery({
        queryKey: ['cpo-full-details', cpoId],
        queryFn: () => fetchCPOFullDetails(cpoId!),
        enabled: !!cpoId && enabled,
        staleTime: 30000,
    });
};

// ─── Legacy list hook kept for rollback; not used in execution ─────────────────

export const fetchCPOList = async (
    instituteId: string,
    pageNo: number = 0,
    pageSize: number = 20
): Promise<CPOListResponse> => {
    const response = await authenticatedAxiosInstance.get<CPOListResponse>(
        GET_CPO_LIST(instituteId),
        { params: { pageNo, pageSize } }
    );
    const data = response.data as unknown;

    // Backend may return paginated object or direct array; normalize to CPOListResponse
    if (Array.isArray(data)) {
        return {
            content: data as CPOPackage[],
            total_pages: 1,
            total_elements: data.length,
            page_no: 0,
            page_size: data.length,
        };
    }

    const typed = data as Partial<CPOListResponse> & { content?: CPOPackage[] };
    return {
        content: typed.content ?? [],
        total_pages: typed.total_pages ?? 1,
        total_elements: typed.total_elements ?? typed.content?.length ?? 0,
        page_no: typed.page_no ?? pageNo,
        page_size: typed.page_size ?? pageSize,
    };
};

export const useCPOList = (pageNo: number = 0, pageSize: number = 20) => {
    const instituteId = getCurrentInstituteId() ?? '';
    return useQuery({
        queryKey: ['cpo-list', instituteId, pageNo, pageSize],
        queryFn: () => fetchCPOList(instituteId, pageNo, pageSize),
        enabled: !!instituteId,
        staleTime: 30000,
    });
};

// ─── Create a new CPO ────────────────────────────────────────────────────────────

export const useCreateCPO = () => {
    const queryClient = useQueryClient();
    const instituteId = getCurrentInstituteId() ?? '';

    return useMutation({
        mutationFn: async (payload: CreateCPOPayload) => {
            const response = await authenticatedAxiosInstance.post<CPOPackage>(CREATE_CPO, {
                ...payload,
                institute_id: instituteId,
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cpo-list', instituteId] });
            queryClient.invalidateQueries({ queryKey: ['institute-cpo-list', instituteId] });
        },
    });
};
