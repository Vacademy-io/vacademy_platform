import { useMutation } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { PARENT_LINK, PARENT_LINK_NEW_GUARDIAN } from '@/constants/urls';

export type ParentLinkDirection = 'PARENT_ADDS_STUDENT' | 'STUDENT_ADDS_PARENT';
export type ParentLinkMode = 'CREATE_NEW' | 'LINK_EXISTING';

export interface ParentLinkRequest {
    institute_id: string;
    direction: ParentLinkDirection;
    mode: ParentLinkMode;
    anchor_user_id: string;
    existing_user_id?: string;
    new_full_name?: string;
    new_email?: string;
    new_mobile_number?: string;
}

export interface ParentLinkResponse {
    student_user_id: string;
    parent_user_id: string;
}

const linkGuardian = async (request: ParentLinkRequest): Promise<ParentLinkResponse> => {
    const response = await authenticatedAxiosInstance.post<ParentLinkResponse>(PARENT_LINK, request);
    return response.data;
};

/**
 * Wraps POST /admin-core-service/parent-link/v1/link.
 * `anchor_user_id` must already be a real, persisted user id — the backend
 * has no path to create a floating unenrolled user, so callers must resolve
 * the anchor's real id first (see BulkAssignDialog for how the two chip
 * shapes — 'existing' vs 'new' — are handled differently).
 */
export const useParentLink = () => {
    return useMutation<ParentLinkResponse, Error, ParentLinkRequest>({
        mutationFn: linkGuardian,
    });
};

export interface LinkNewGuardianRequest {
    institute_id: string;
    guardian_full_name: string;
    guardian_email: string;
    guardian_mobile_number?: string;
    mode: ParentLinkMode;
    student_existing_user_id?: string;
    student_full_name?: string;
    student_email?: string;
    student_mobile_number?: string;
}

export interface LinkNewGuardianResponse {
    student_user_id: string;
    parent_user_id: string;
}

const linkNewGuardian = async (
    request: LinkNewGuardianRequest
): Promise<LinkNewGuardianResponse> => {
    const response = await authenticatedAxiosInstance.post<LinkNewGuardianResponse>(
        PARENT_LINK_NEW_GUARDIAN,
        request
    );
    return response.data;
};

/**
 * Wraps POST /admin-core-service/parent-link/v1/link-new-guardian.
 * Unlike useParentLink, this always creates the guardian FRESH — it's for
 * the case where a manual-entry ('new') learner chip is flagged as the
 * guardian: the chip has no real user id yet, so there is no anchor to pass
 * to /parent-link/v1/link. The chip's own name/email/mobile become the
 * guardian's info; the student side is either created fresh (CREATE_NEW) or
 * an already-existing user (LINK_EXISTING).
 */
export const useLinkNewGuardian = () => {
    return useMutation<LinkNewGuardianResponse, Error, LinkNewGuardianRequest>({
        mutationFn: linkNewGuardian,
    });
};
