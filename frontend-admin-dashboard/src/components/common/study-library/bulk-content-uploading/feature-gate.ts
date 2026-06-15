// Bulk Content Uploading — per-institute feature gate.
//
// HIDDEN BY DEFAULT for every institute. Enable by listing institute ids in
// the VITE_BULK_CONTENT_UPLOAD_INSTITUTES env var (comma-separated), or by
// adding ids to the fallback list below (same pattern as SSDC_INSTITUTE_ID /
// HOLISTIC_INSTITUTE_ID in constants/urls.ts).

import { getInstituteId } from '@/constants/helper';

const ENABLED_INSTITUTE_IDS: string[] = (
    (import.meta.env.VITE_BULK_CONTENT_UPLOAD_INSTITUTES as string | undefined) || ''
)
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

export const isBulkContentUploadEnabled = (): boolean => {
    const instituteId = getInstituteId();
    return !!instituteId && ENABLED_INSTITUTE_IDS.includes(instituteId);
};
