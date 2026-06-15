// Bulk Content Uploading — per-institute feature gate.
//
// HIDDEN BY DEFAULT for every institute. Enable by listing institute ids in
// the VITE_BULK_CONTENT_UPLOAD_INSTITUTES env var (comma-separated). Use "*"
// to enable for ALL institutes (handy for local dev / staging / demos).

import { getInstituteId } from '@/constants/helper';

const ENABLED_INSTITUTE_IDS: string[] = (
    (import.meta.env.VITE_BULK_CONTENT_UPLOAD_INSTITUTES as string | undefined) || ''
)
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

const ENABLED_FOR_ALL = ENABLED_INSTITUTE_IDS.includes('*');

export const isBulkContentUploadEnabled = (): boolean => {
    if (ENABLED_FOR_ALL) return true;
    const instituteId = getInstituteId();
    return !!instituteId && ENABLED_INSTITUTE_IDS.includes(instituteId);
};
