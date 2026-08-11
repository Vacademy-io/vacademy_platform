import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    COURSE_CERTIFICATE_DASHBOARD,
    COURSE_CERTIFICATE_ISSUE,
    COURSE_CERTIFICATE_LEARNERS,
    COURSE_CERTIFICATE_RESEND,
    COURSE_CERTIFICATE_SETTINGS,
} from '@/constants/urls';

/**
 * Per-course override. Every field is nullable — null means inherit the
 * institute default. Certificate numbering is deliberately absent: the format is
 * an institute-wide setting so numbers stay consistent across courses.
 */
export interface CourseCertificateOverride {
    enabled?: boolean | null;
    thresholdPercent?: number | null;
    templateHtml?: string | null;
}

export interface CourseCertificateSettings {
    effective_enabled: boolean;
    effective_threshold_percent: number;
    institute_enabled: boolean;
    institute_threshold_percent: number;
    course_override: {
        enabled?: boolean | null;
        thresholdPercent?: number | null;
        templateHtml?: string | null;
    } | null;
    enabled_overridden_by_course: boolean;
    threshold_overridden_by_course: boolean;
    has_course_template: boolean;
}

export interface CourseCertificateDashboard {
    total_enrolled: number;
    certificates_generated: number;
    certificates_pending: number;
    completed_awaiting_certificate: number;
    near_threshold: number;
    threshold_percent: number;
}

export interface CourseCertificateLearner {
    user_id: string;
    full_name: string | null;
    email: string | null;
    completion_percentage: number | null;
    status: 'GENERATED' | 'AWAITING' | 'PENDING';
    certificate_number: string | null;
    /** Already resolved to a public URL by the backend. */
    file_id: string | null;
    issued_at: string | null;
}

export interface CourseCertificateLearnerPage {
    content: CourseCertificateLearner[];
    pageNo: number;
    pageSize: number;
    totalElements: number;
    totalPages: number;
    last: boolean;
}

export const getCourseCertificateSettings = async (
    instituteId: string,
    packageId: string
): Promise<CourseCertificateSettings> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: COURSE_CERTIFICATE_SETTINGS,
        params: { instituteId, packageId },
    });
    return response.data;
};

export const saveCourseCertificateSettings = async (
    instituteId: string,
    packageId: string,
    payload: CourseCertificateOverride
): Promise<void> => {
    await authenticatedAxiosInstance({
        method: 'POST',
        url: COURSE_CERTIFICATE_SETTINGS,
        params: { instituteId, packageId },
        data: payload,
    });
};

export const getCourseCertificateDashboard = async (
    instituteId: string,
    packageSessionId: string,
    packageId?: string
): Promise<CourseCertificateDashboard> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: COURSE_CERTIFICATE_DASHBOARD,
        params: { instituteId, packageSessionId, packageId },
    });
    return response.data;
};

export const getCourseCertificateLearners = async (params: {
    instituteId: string;
    packageSessionId: string;
    packageId?: string;
    search?: string;
    status?: string;
    page: number;
    size: number;
}): Promise<CourseCertificateLearnerPage> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: COURSE_CERTIFICATE_LEARNERS,
        params,
    });
    return response.data;
};

/**
 * Issue for a learner who has none, or re-render an existing certificate.
 * A re-render keeps the learner's existing certificate number.
 */
export const issueCourseCertificate = async (params: {
    instituteId: string;
    packageSessionId: string;
    userId: string;
    regenerate?: boolean;
    courseName?: string;
}): Promise<string> => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: COURSE_CERTIFICATE_ISSUE,
        params,
    });
    return response.data;
};

export const resendCourseCertificate = async (
    instituteId: string,
    certificateId: string
): Promise<void> => {
    await authenticatedAxiosInstance({
        method: 'POST',
        url: COURSE_CERTIFICATE_RESEND,
        params: { instituteId, certificateId },
    });
};
