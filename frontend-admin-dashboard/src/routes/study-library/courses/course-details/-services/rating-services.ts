import { TokenKey } from '@/constants/auth/tokens';
import { GET_ALL_RATING_SUMMARY, GET_ALL_USER_RATINGS, SUBMIT_RATING_URL } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';

export const handleSubmitRating = async (rating: number, desc: string, source_id: string) => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: SUBMIT_RATING_URL,
        data: {
            points: rating,
            user_id: tokenData?.user,
            likes: 0,
            dislikes: 0,
            source_id,
            source_type: 'PACKAGE_SESSION',
            text: desc,
            status: 'ACTIVE',
        },
    });
    return response?.data;
};

export const handleUpdateRating = async (
    id: string,
    rating: number,
    source_id: string,
    status: string,
    likes: number,
    dislikes: number,
    text?: string
) => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const response = await authenticatedAxiosInstance({
        method: 'PUT',
        url: SUBMIT_RATING_URL,
        data: {
            id,
            user_id: tokenData?.user,
            points: rating,
            likes,
            dislikes,
            source_id,
            source_type: 'PACKAGE_SESSION',
            status,
            text,
        },
    });
    return response?.data;
};

export const getRatingDetails = async ({
    pageNo,
    pageSize,
    data,
}: {
    pageNo: number;
    pageSize: number;
    data: {
        source_id: string;
        source_type: string;
    };
}) => {
    if (data.source_id == '') return null;
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_ALL_USER_RATINGS,
        params: {
            pageNo,
            pageSize,
        },
        data,
    });
    return response?.data;
};

export const handleGetRatingDetails = ({
    pageNo,
    pageSize,
    data,
}: {
    pageNo: number;
    pageSize: number;
    data: {
        source_id: string;
        source_type: string;
    };
}) => {
    return {
        queryKey: ['GET_ALL_USER_COURSE_RATINGS', pageNo, pageSize, data],
        queryFn: () => getRatingDetails({ pageNo, pageSize, data }),
        staleTime: 60 * 60 * 1000,
    };
};

export const handleGetOverallRating = async (source_id: string) => {
    if (source_id === '') return null;
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_ALL_RATING_SUMMARY,
        params: {
            sourceId: source_id,
            sourceType: 'PACKAGE_SESSION',
        },
    });
    return response?.data;
};

export const handleGetOverAllRatingDetails = ({ source_id }: { source_id: string }) => {
    return {
        queryKey: ['GET_ALL_USER_COURSE_RATINGS_OVERALL', source_id],
        queryFn: () => handleGetOverallRating(source_id),
        staleTime: 60 * 60 * 1000,
    };
};
