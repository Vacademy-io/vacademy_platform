import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    GET_ALL_PRODUCT_PAGES,
    CREATE_PRODUCT_PAGE,
    UPDATE_PRODUCT_PAGE,
    GET_PRODUCT_PAGE,
    DELETE_PRODUCT_PAGE,
    CREATE_PRODUCT_PAGE_COUPON,
    DELETE_PRODUCT_PAGE_COUPON,
    ADD_PRODUCT_PAGE_CUSTOM_FIELD,
    REMOVE_PRODUCT_PAGE_CUSTOM_FIELD,
    CREATE_PRODUCT_PAGE_CUSTOM_FIELD,
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

export const addCustomFieldToProductPage = async (
    productPageId: string,
    customFieldId: string,
    instituteId: string
): Promise<ProductPageResponse> => {
    const response = await authenticatedAxiosInstance.post<ProductPageResponse>(
        ADD_PRODUCT_PAGE_CUSTOM_FIELD(productPageId),
        null,
        { params: { customFieldId, instituteId } }
    );
    return response.data;
};

export const removeCustomFieldFromProductPage = async (
    productPageId: string,
    customFieldId: string,
    instituteId: string
): Promise<ProductPageResponse> => {
    const response = await authenticatedAxiosInstance.delete<ProductPageResponse>(
        REMOVE_PRODUCT_PAGE_CUSTOM_FIELD(productPageId, customFieldId),
        { params: { instituteId } }
    );
    return response.data;
};

export const createAndLinkCustomField = async (
    productPageId: string,
    instituteId: string,
    data: { field_name: string; field_type: string; is_mandatory: boolean; config?: string }
): Promise<ProductPageResponse> => {
    const response = await authenticatedAxiosInstance.post<ProductPageResponse>(
        CREATE_PRODUCT_PAGE_CUSTOM_FIELD(productPageId),
        data,
        { params: { instituteId } }
    );
    return response.data;
};
