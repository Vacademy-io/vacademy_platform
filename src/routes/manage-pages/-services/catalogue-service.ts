import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    GET_CATALOGUE_TAGS,
    CREATE_CATALOGUE,
    UPDATE_CATALOGUE,
    GET_CATALOGUE_BY_TAG,
} from '@/constants/urls';
import { CatalogueTag, CreateCatalogueTagRequest } from '../-types/catalogue-types';
import { CatalogueConfig } from '../-types/editor-types';

// Backend returns array of catalogue objects
interface CatalogueResponse {
    id: string;
    catalogue_json: string;
    tag_name: string;
    status: string;
    source: string;
    source_id?: string;
    institute_id: string;
    is_default: boolean;
    updated_at?: string;
    created_at?: string;
}

export const getCatalogueTags = async (instituteId: string): Promise<CatalogueTag[]> => {
    const response = await authenticatedAxiosInstance.get<CatalogueResponse[]>(
        GET_CATALOGUE_TAGS(instituteId)
    );
    // Transform backend response to match our CatalogueTag type
    return (response.data || []).map((item) => ({
        tagName: item.tag_name,
        status: item.status as 'ACTIVE' | 'DRAFT' | 'ARCHIVED',
        lastModified: item.updated_at || item.created_at || undefined,
        catalogueJson: item.catalogue_json,
        id: item.id,
    }));
};

export const createCatalogueConfig = async (
    instituteId: string,
    data: CreateCatalogueTagRequest
): Promise<void> => {
    // Backend expects array of catalogues
    await authenticatedAxiosInstance.post(CREATE_CATALOGUE(instituteId), {
        catalogues: [
            {
                catalogue_json: data.catalogue_json,
                tag_name: data.tagName,
                status: 'DRAFT',
                source: 'INTERNAL',
                is_default: false,
            },
        ],
    });
};

export const getCatalogueConfig = async (
    instituteId: string,
    tagName: string
): Promise<{ catalogue_json: string }> => {
    const response = await authenticatedAxiosInstance.get<CatalogueResponse>(
        GET_CATALOGUE_BY_TAG(instituteId, tagName)
    );
    return { catalogue_json: response.data.catalogue_json };
};

export const saveCatalogueConfig = async (
    instituteId: string,
    tagName: string,
    config: CatalogueConfig
): Promise<void> => {
    // First, get the catalogue to find its ID
    const catalogue = await authenticatedAxiosInstance.get<CatalogueResponse>(
        GET_CATALOGUE_BY_TAG(instituteId, tagName)
    );

    // Then update using the catalogue ID
    await authenticatedAxiosInstance.put(UPDATE_CATALOGUE(catalogue.data.id), {
        catalogue_json: JSON.stringify(config),
        tag_name: tagName,
        status: catalogue.data.status,
        source: catalogue.data.source,
        source_id: catalogue.data.source_id,
        is_default: catalogue.data.is_default,
    });
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const deleteCatalogueConfig = async (
    instituteId: string,
    tagName: string
): Promise<void> => {
    // Backend doesn't have a delete endpoint in the documentation provided
    // This might need to be implemented on backend or use a different approach
    console.warn('Delete catalogue endpoint not yet implemented in backend');
    throw new Error('Delete functionality not available - please archive the catalogue instead');
};
