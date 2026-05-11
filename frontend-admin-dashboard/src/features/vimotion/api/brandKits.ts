import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    VIMOTION_BRAND_KITS,
    VIMOTION_BRAND_KIT_BY_ID,
    VIMOTION_BRAND_KIT_DEFAULT,
    VIMOTION_BRAND_KIT_SET_DEFAULT,
    VIMOTION_BRAND_KIT_SCRAPE,
} from '@/constants/urls';
import type { BrandKit, BrandKitScrapeResult, BrandKitWritePayload } from './dashboardTypes';

export async function listBrandKits(instituteId: string): Promise<BrandKit[]> {
    const { data } = await authenticatedAxiosInstance.get<BrandKit[]>(VIMOTION_BRAND_KITS, {
        params: { instituteId },
    });
    return data;
}

export async function getBrandKit(id: string, instituteId: string): Promise<BrandKit> {
    const { data } = await authenticatedAxiosInstance.get<BrandKit>(VIMOTION_BRAND_KIT_BY_ID(id), {
        params: { instituteId },
    });
    return data;
}

export async function getDefaultBrandKit(instituteId: string): Promise<BrandKit | null> {
    try {
        const { data } = await authenticatedAxiosInstance.get<BrandKit>(
            VIMOTION_BRAND_KIT_DEFAULT,
            {
                params: { instituteId },
            }
        );
        return data;
    } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) return null;
        throw err;
    }
}

export async function createBrandKit(
    instituteId: string,
    payload: BrandKitWritePayload
): Promise<BrandKit> {
    const { data } = await authenticatedAxiosInstance.post<BrandKit>(VIMOTION_BRAND_KITS, payload, {
        params: { instituteId },
    });
    return data;
}

export async function updateBrandKit(
    id: string,
    instituteId: string,
    payload: BrandKitWritePayload
): Promise<BrandKit> {
    const { data } = await authenticatedAxiosInstance.put<BrandKit>(
        VIMOTION_BRAND_KIT_BY_ID(id),
        payload,
        { params: { instituteId } }
    );
    return data;
}

export async function setDefaultBrandKit(id: string, instituteId: string): Promise<BrandKit> {
    const { data } = await authenticatedAxiosInstance.post<BrandKit>(
        VIMOTION_BRAND_KIT_SET_DEFAULT(id),
        null,
        { params: { instituteId } }
    );
    return data;
}

export async function deleteBrandKit(id: string, instituteId: string): Promise<void> {
    await authenticatedAxiosInstance.delete(VIMOTION_BRAND_KIT_BY_ID(id), {
        params: { instituteId },
    });
}

export async function scrapeBrandKitFromUrl(
    url: string,
    instituteId: string
): Promise<BrandKitScrapeResult> {
    // Hits ai_service directly — JWT-auth via authenticatedAxiosInstance, no
    // persistence. instituteId scopes the S3 path. Long-running (15-40s
    // typical); the axios default timeout would cut us off, so extend for this
    // call only.
    const { data } = await authenticatedAxiosInstance.post<BrandKitScrapeResult>(
        VIMOTION_BRAND_KIT_SCRAPE,
        { url },
        { params: { instituteId }, timeout: 60_000 }
    );
    return data;
}
