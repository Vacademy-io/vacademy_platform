import { useQuery } from '@tanstack/react-query';
import { getSlideDownloadPermission } from '@/routes/settings/-services/slide-download-permission-service';
import { getRolesForCurrentInstitute } from '@/lib/auth/instituteUtils';
import {
    canRoleDownloadInAdmin,
    canRolePrintPdfInAdmin,
} from '@/constants/slide-download-permission';

/**
 * Enforce the per-role slide download/print permission in the ADMIN authoring
 * app. Reads the current user's roles (scoped to the current institute) and the
 * institute's setting, and exposes `canDownload(typeKey)`, `canPrintPdf()` and
 * `isResolved`.
 *
 * Uses the default-allow / deny-on-explicit-false resolver, so admins and
 * unconfigured roles keep their existing access — only a role an admin has
 * explicitly turned off (e.g. a teacher) is blocked. PDF print inherits the PDF
 * download permission when print is unconfigured.
 *
 * IMPORTANT: callers that build a fixed, third-party UI from this (e.g. the
 * react-pdf-viewer toolbar, which is created once at mount and does NOT rebuild
 * when the transform changes) MUST wait for `isResolved` before rendering.
 */
export function useSlideDownloadAccess() {
    const { data } = useQuery({
        queryKey: ['slide-download-permission'],
        queryFn: getSlideDownloadPermission,
        // Short stale time so an admin's change reaches other roles quickly.
        staleTime: 30 * 1000,
    });

    // Roles for the CURRENT institute only (so a teacher here who is an admin in
    // another institute is still treated as a teacher in this context).
    const roles = getRolesForCurrentInstitute();

    const canDownload = (typeKey: string) => canRoleDownloadInAdmin(data, typeKey, roles);
    const canPrintPdf = () => canRolePrintPdfInAdmin(data, roles);

    return { canDownload, canPrintPdf, isResolved: data !== undefined };
}
