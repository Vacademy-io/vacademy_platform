import { getPublicUrl as getAuthPublicUrl } from '@/services/upload_file';
import {
    getPublicUrl as getPublicUrlPublic,
    getCachedInstituteBranding,
    resolveInstituteById,
} from '@/services/domain-routing';
import { fetchInstituteDetailsById } from '@/services/student-list-section/getInstituteDetails';
import { getEffectiveInstituteLogoFileId } from '@/lib/auth/facultyAccessUtils';
import { getInstituteId } from '@/constants/helper';

/**
 * Resolves a usable institute-logo image URL for the PDF export. Primary source
 * is the institute-details API (which carries `institute_logo_file_id`); a live
 * fetch is used because the cached store can be missing the field. Domain-routing
 * branding is kept only as a fallback for whitelabel institutes. Returns null
 * only if no source yields anything.
 */
export async function resolveInstituteLogoUrl(logoFileId?: string | null): Promise<string | null> {
    const instituteId = getInstituteId();

    // 1) Logo file id we may already have (institute-details store), with the
    //    faculty sub-org override.
    const effective = getEffectiveInstituteLogoFileId(logoFileId || undefined);
    if (effective) {
        const url = await getAuthPublicUrl(effective);
        if (url) return url;
    }

    // 2) Live institute-details API — authoritative logo file id (the store can
    //    be unpopulated/missing the field even when the institute has a logo).
    if (instituteId) {
        try {
            const details = await fetchInstituteDetailsById(instituteId);
            if (details?.institute_logo_file_id) {
                const url = await getAuthPublicUrl(details.institute_logo_file_id);
                if (url) return url;
            }
        } catch {
            /* ignore and try the fallbacks */
        }
    }

    // 3) Fallback: cached domain-routing branding (whitelabel logo).
    try {
        const branding = getCachedInstituteBranding(instituteId || undefined);
        if (branding?.instituteLogoUrl) return branding.instituteLogoUrl;
        if (branding?.instituteLogoFileId) {
            const url = await getPublicUrlPublic(branding.instituteLogoFileId);
            if (url) return url;
        }
    } catch {
        /* ignore malformed cache */
    }

    // 4) Fallback: live domain-routing resolve-by-institute.
    if (instituteId) {
        const resolved = await resolveInstituteById(instituteId);
        if (resolved?.instituteLogoFileId) {
            const url = await getPublicUrlPublic(resolved.instituteLogoFileId);
            if (url) return url;
        }
    }

    return null;
}
