// Bulk Content Uploading — per-course edit permission gate for multi-course mode.
//
// Mirrors the canEditStructure logic in course-structure-details.tsx: admins
// always; owners of DRAFT courses; otherwise the role needs one of the
// coursePage structure-edit display-settings toggles.

import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { getActiveRoleDisplaySettingsKey } from '@/lib/auth/instituteUtils';
import { getDisplaySettings, getDisplaySettingsFromCache } from '@/services/display-settings';
import type { DisplaySettingsData } from '@/types/display-settings';
import type { CourseType } from '@/stores/study-library/use-study-library-store';

export const loadRoleDisplayForBulk = async (): Promise<DisplaySettingsData | null> => {
    try {
        const roleKey = getActiveRoleDisplaySettingsKey();
        const cached = getDisplaySettingsFromCache(roleKey);
        if (cached) return cached;
        return await getDisplaySettings(roleKey);
    } catch {
        return null;
    }
};

export const canBulkUploadToCourse = (
    course: CourseType,
    roleDisplay: DisplaySettingsData | null,
    courseTerm: string
): { allowed: boolean; reason?: string } => {
    const tokenData = getTokenDecodedData(getTokenFromCookie(TokenKey.accessToken));
    const isAdmin =
        !!tokenData?.authorities &&
        Object.values(tokenData.authorities).some(
            (auth) => Array.isArray(auth?.roles) && auth.roles.includes('ADMIN')
        );
    if (isAdmin) return { allowed: true };

    const isOwnCourse = course.createdByUserId === tokenData?.user;
    if (course.status === 'DRAFT' && (isOwnCourse || !course.createdByUserId)) {
        return { allowed: true };
    }

    const coursePage = roleDisplay?.coursePage;
    if (
        coursePage?.canEditCourseStructure === true ||
        coursePage?.canDeleteCourseStructure === true ||
        coursePage?.directEditPublishedCourse === true
    ) {
        return { allowed: true };
    }

    return {
        allowed: false,
        reason: `This published ${courseTerm.toLowerCase()} can only be updated by an admin or a role with direct-edit permission.`,
    };
};
