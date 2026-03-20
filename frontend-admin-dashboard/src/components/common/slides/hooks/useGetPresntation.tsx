/* eslint-disable */
// @ts-nocheck
import { TokenKey } from "@/constants/auth/tokens";
import { GET_BATCH_LIST, GET_PRESENTATION_LIST } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { getTokenDecodedData, getTokenFromCookie } from "@/lib/auth/sessionUtility";
import { useQuery } from "@tanstack/react-query";
import { Presentation } from "../types";


export const fetchPresntation = async () => {
    console.log('[fetchPresntation] Starting fetch...');
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = tokenData && Object.keys(tokenData.authorities)[0];

    console.log('[fetchPresntation] Institute ID:', INSTITUTE_ID);

    const response = await authenticatedAxiosInstance.get(GET_PRESENTATION_LIST, {
        params: {
            instituteId: INSTITUTE_ID,
        },
    });

    console.log('[fetchPresntation] API response:', response.data);
    return response.data;
};

export const useGetPresntation = () => {
    return useQuery<Presentation[] | null>({
        queryKey: ["GET_PRESENTATIONS"],
        queryFn: async () => {
            console.log('[useGetPresntation] Fetching presentations...');
            const response = await fetchPresntation();
            console.log('[useGetPresntation] Fetched presentations:', response);
            return response;
        },
        staleTime: 0,
        refetchOnWindowFocus: false,
    });
};

