import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';

const BASE = `${BASE_URL}/admin-core-service/youtube`;

// ── Types ────────────────────────────────────────────────────────────────────

export interface YoutubeConnectionStatus {
    status: 'ACTIVE' | 'INVALID' | 'NOT_CONNECTED';
    channelId?: string;
    channelTitle?: string;
    channelThumbnailUrl?: string;
    connectedByUserId?: string;
    connectedAt?: string;
    lastValidatedAt?: string;
    lastError?: string;
}

export interface YoutubeUploadDefaults {
    /** Institute-level master switch — false until the admin opts in. */
    featureEnabled: boolean;
    autoUploadEnabled: boolean;
    privacyStatus: 'public' | 'unlisted' | 'private';
    embeddable: boolean;
    publicStatsViewable: boolean;
    madeForKids: boolean;
    categoryId: string;
    license: 'youtube' | 'creativeCommon';
    defaultLanguage?: string;
    tagsCsv?: string;
    titleTemplate: string;
    descriptionTemplate?: string;
    notifySubscribers: boolean;
    defaultPlaylistId?: string;
}

export interface YoutubeUploadJob {
    id: string;
    instituteId: string;
    sessionScheduleId: string;
    recordingId?: string;
    recordingFileId: string;
    status: 'QUEUED' | 'UPLOADING' | 'DONE' | 'FAILED' | 'CANCELLED';
    youtubeVideoId?: string;
    youtubeVideoUrl?: string;
    title?: string;
    privacyStatus?: string;
    attempts: number;
    maxAttempts: number;
    nextRetryAt?: string;
    lastError?: string;
    lastErrorCode?: string;
    triggeredVia: 'AUTO' | 'MANUAL';
    triggeredByUserId?: string;
    startedAt?: string;
    finishedAt?: string;
    createdAt: string;
}

// ── OAuth ────────────────────────────────────────────────────────────────────

export const initiateYoutubeOAuth = async (
    instituteId: string
): Promise<{ authorization_url: string }> => {
    const res = await authenticatedAxiosInstance.post(`${BASE}/oauth/initiate`, null, {
        params: { instituteId },
    });
    return res.data;
};

export const getYoutubeStatus = async (instituteId: string): Promise<YoutubeConnectionStatus> => {
    const res = await authenticatedAxiosInstance.get(`${BASE}/status`, {
        params: { instituteId },
    });
    return res.data;
};

export const disconnectYoutube = async (instituteId: string): Promise<void> => {
    await authenticatedAxiosInstance.post(`${BASE}/disconnect`, null, {
        params: { instituteId },
    });
};

// ── Defaults ─────────────────────────────────────────────────────────────────

export const getYoutubeDefaults = async (instituteId: string): Promise<YoutubeUploadDefaults> => {
    const res = await authenticatedAxiosInstance.get(`${BASE}/defaults`, {
        params: { instituteId },
    });
    return res.data;
};

export const updateYoutubeDefaults = async (
    instituteId: string,
    defaults: YoutubeUploadDefaults
): Promise<YoutubeUploadDefaults> => {
    const res = await authenticatedAxiosInstance.put(`${BASE}/defaults`, defaults, {
        params: { instituteId },
    });
    return res.data;
};

// ── Uploads ──────────────────────────────────────────────────────────────────

export interface ManualUploadRequest {
    scheduleId: string;
    recordingId?: string;
    fileId?: string;
    privacyStatus?: 'public' | 'unlisted' | 'private';
}

export const enqueueYoutubeUpload = async (req: ManualUploadRequest): Promise<YoutubeUploadJob> => {
    const res = await authenticatedAxiosInstance.post(`${BASE}/uploads`, req);
    return res.data;
};

export const retryYoutubeUpload = async (jobId: string): Promise<YoutubeUploadJob> => {
    const res = await authenticatedAxiosInstance.post(`${BASE}/uploads/${jobId}/retry`);
    return res.data;
};

export const listYoutubeJobs = async (
    instituteId: string,
    page = 0,
    size = 50
): Promise<YoutubeUploadJob[]> => {
    const res = await authenticatedAxiosInstance.get(`${BASE}/uploads`, {
        params: { instituteId, page, size },
    });
    return Array.isArray(res.data) ? res.data : [];
};

export const listYoutubeJobsForSchedule = async (
    scheduleId: string
): Promise<YoutubeUploadJob[]> => {
    const res = await authenticatedAxiosInstance.get(`${BASE}/uploads/by-schedule/${scheduleId}`);
    return Array.isArray(res.data) ? res.data : [];
};
