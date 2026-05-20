import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    GET_ALL_PRODUCT_PAGES,
    CREATE_PRODUCT_PAGE,
    UPDATE_PRODUCT_PAGE,
    GET_PRODUCT_PAGE,
    DELETE_PRODUCT_PAGE,
    CREATE_PRODUCT_PAGE_COUPON,
    DELETE_PRODUCT_PAGE_COUPON,
} from '@/constants/urls';
import type {
    ProductPageResponse,
    ProductPageRequest,
    ProductPageCouponRequest,
} from '../-types/product-page-types';

export const getAllProductPages = async (
    instituteId: string
): Promise<ProductPageResponse[]> => {
    const response = await authenticatedAxiosInstance.get<ProductPageResponse[]>(
        GET_ALL_PRODUCT_PAGES(instituteId)
    );
    return response.data || [];
};

export const createProductPage = async (
    instituteId: string,
    data: ProductPageRequest
): Promise<ProductPageResponse> => {
    const response = await authenticatedAxiosInstance.post<ProductPageResponse>(
        CREATE_PRODUCT_PAGE(instituteId),
        data
    );
    return response.data;
};

export const updateProductPage = async (
    coursePageId: string,
    data: ProductPageRequest
): Promise<ProductPageResponse> => {
    const response = await authenticatedAxiosInstance.put<ProductPageResponse>(
        UPDATE_PRODUCT_PAGE(coursePageId),
        data
    );
    return response.data;
};

export const getProductPage = async (coursePageId: string): Promise<ProductPageResponse> => {
    const response = await authenticatedAxiosInstance.get<ProductPageResponse>(
        GET_PRODUCT_PAGE(coursePageId)
    );
    return response.data;
};

export const deleteProductPage = async (coursePageId: string): Promise<string> => {
    const response = await authenticatedAxiosInstance.delete<string>(
        DELETE_PRODUCT_PAGE(coursePageId)
    );
    return response.data;
};

export const createProductPageCoupon = async (
    coursePageId: string,
    data: ProductPageCouponRequest
): Promise<string> => {
    const response = await authenticatedAxiosInstance.post<string>(
        CREATE_PRODUCT_PAGE_COUPON(coursePageId),
        data
    );
    return response.data;
};

export const deleteProductPageCoupon = async (couponCodeId: string): Promise<string> => {
    const response = await authenticatedAxiosInstance.delete<string>(
        DELETE_PRODUCT_PAGE_COUPON(couponCodeId)
    );
    return response.data;
};
