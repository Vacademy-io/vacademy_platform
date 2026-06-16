// Bulk Content Uploading — per-institute feature gate.
//
// VISIBLE BY DEFAULT for every institute (including production). The
// VITE_BULK_CONTENT_UPLOAD_INSTITUTES env var is now an optional *allowlist*:
// set it (comma-separated institute ids) to RESTRICT the feature to only those
// institutes. Leave it unset → everyone sees it. Use "*" to be explicit.

import { getInstituteId } from '@/constants/helper';

const ENABLED_INSTITUTE_IDS: string[] = (
    (import.meta.env.VITE_BULK_CONTENT_UPLOAD_INSTITUTES as string | undefined) || ''
)
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

const ENABLED_FOR_ALL = ENABLED_INSTITUTE_IDS.includes('*');

export const isBulkContentUploadEnabled = (): boolean => {
    // No allowlist configured → on for everyone. "*" → on for everyone.
    if (ENABLED_INSTITUTE_IDS.length === 0 || ENABLED_FOR_ALL) return true;
    // Allowlist set → only those institutes.
    const instituteId = getInstituteId();
    return !!instituteId && ENABLED_INSTITUTE_IDS.includes(instituteId);
};
