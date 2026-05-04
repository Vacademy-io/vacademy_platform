import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { VIMOTION_AVATARS, VIMOTION_AVATAR_BY_ID } from '@/constants/urls';
import type { StudioAvatar, StudioAvatarWritePayload } from './dashboardTypes';

export async function listAvatars(instituteId: string): Promise<StudioAvatar[]> {
    const { data } = await authenticatedAxiosInstance.get<StudioAvatar[]>(VIMOTION_AVATARS, {
        params: { instituteId },
    });
    return data;
}

export async function getAvatar(id: string, instituteId: string): Promise<StudioAvatar> {
    const { data } = await authenticatedAxiosInstance.get<StudioAvatar>(VIMOTION_AVATAR_BY_ID(id), {
        params: { instituteId },
    });
    return data;
}

export async function createAvatar(
    instituteId: string,
    payload: StudioAvatarWritePayload
): Promise<StudioAvatar> {
    const { data } = await authenticatedAxiosInstance.post<StudioAvatar>(
        VIMOTION_AVATARS,
        payload,
        { params: { instituteId } }
    );
    return data;
}

export async function updateAvatar(
    id: string,
    instituteId: string,
    payload: StudioAvatarWritePayload
): Promise<StudioAvatar> {
    const { data } = await authenticatedAxiosInstance.put<StudioAvatar>(
        VIMOTION_AVATAR_BY_ID(id),
        payload,
        { params: { instituteId } }
    );
    return data;
}

export async function deleteAvatar(id: string, instituteId: string): Promise<void> {
    await authenticatedAxiosInstance.delete(VIMOTION_AVATAR_BY_ID(id), {
        params: { instituteId },
    });
}
