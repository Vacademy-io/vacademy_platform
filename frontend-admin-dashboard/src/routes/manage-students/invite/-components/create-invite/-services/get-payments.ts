import { getInstituteId } from '@/constants/helper';
import { GET_PAYMENTS_URL } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

export const getPaymentDetail = async () => {
    const instituteId = getInstituteId();
    const data = {
        types: [],
        source: 'INSTITUTE',
        source_id: instituteId,
        require_approval: true,
        not_require_approval: true,
    };
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_PAYMENTS_URL,
        data,
    });
    return response?.data;
};

export const handleGetPaymentDetails = () => {
    return {
        queryKey: ['GET_PAYMENT_DETAILS'],
        queryFn: () => getPaymentDetail(),
        staleTime: 60 * 60 * 1000,
    };
};
