/**
 * useLeadStatuses — table-backed lead pipeline statuses (replaces the customStatuses
 * that used to live in the LEAD_SETTING JSON).
 *
 * Reads/writes the per-institute status catalog via the lead-status CRUD endpoints so
 * statuses are queryable/reportable, and exposes a reconcile helper for the settings UI.
 */
import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { BASE_URL } from '@/constants/urls';

// authenticatedAxiosInstance has no baseURL and there's no Vite dev proxy for
// /admin-core-service, so the endpoint must include the backend host or it hits
// the frontend origin and returns no statuses.
// authenticatedAxiosInstance has no baseURL, so endpoints must include the backend host.
const BASE = `${BASE_URL}/admin-core-service/v1/lead-status`;

export interface LeadStatus {
    id: string;
    institute_id?: string;
    status_key: string;
    label: string;
    color: string;
    display_order: number;
    is_default: boolean;
    is_active: boolean;
    /** System default (New/Converted/Lost) — editable but not deletable. */
    is_system: boolean;
}

/** Draft row used by the editor before it's persisted (no id yet for new rows). */
export interface LeadStatusDraft {
    id?: string;
    status_key?: string;
    label: string;
    color: string;
    display_order: number;
    is_default: boolean;
    is_system?: boolean;
}

export const LEAD_STATUSES_QUERY_KEY = ['lead-statuses'];

export async function fetchLeadStatuses(): Promise<LeadStatus[]> {
    const instituteId = getCurrentInstituteId();
    if (!instituteId) return [];
    try {
        const { data } = await authenticatedAxiosInstance.get(BASE, { params: { instituteId } });
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

export function useLeadStatuses(options?: { skip?: boolean }): {
    statuses: LeadStatus[];
    isLoading: boolean;
} {
    const { data, isLoading } = useQuery({
        queryKey: LEAD_STATUSES_QUERY_KEY,
        queryFn: fetchLeadStatuses,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        enabled: !options?.skip,
    });
    return { statuses: data ?? [], isLoading };
}

async function createLeadStatus(payload: LeadStatusDraft): Promise<void> {
    const instituteId = getCurrentInstituteId();
    await authenticatedAxiosInstance.post(BASE, payload, { params: { instituteId } });
}

async function updateLeadStatus(id: string, payload: LeadStatusDraft): Promise<void> {
    await authenticatedAxiosInstance.put(`${BASE}/${id}`, payload);
}

async function deleteLeadStatus(id: string): Promise<void> {
    await authenticatedAxiosInstance.delete(`${BASE}/${id}`);
}

/** Set a single lead's current status (manual change from the leads UI). */
export async function setLeadStatusForLead(
    audienceResponseId: string,
    statusId: string,
    source: 'MANUAL' | 'WORKFLOW' | 'AUTO' = 'MANUAL'
): Promise<void> {
    await authenticatedAxiosInstance.post(`${BASE}/lead/${audienceResponseId}`, null, {
        params: { statusId, source },
    });
}

/**
 * Reconcile an edited list against the server: create new rows, update changed ones,
 * deactivate removed ones. Lets the settings card keep a single "Save" action.
 */
export async function saveLeadStatuses(
    original: LeadStatus[],
    edited: LeadStatusDraft[]
): Promise<void> {
    const editedIds = new Set(edited.filter((s) => s.id).map((s) => s.id));

    // Deactivate removed — never the system defaults (New/Converted/Lost).
    const removed = original.filter((o) => !editedIds.has(o.id) && !o.is_system);
    await Promise.all(removed.map((r) => deleteLeadStatus(r.id)));

    // Create / update
    await Promise.all(
        edited
            .filter((s) => s.label.trim())
            .map((s, idx) => {
                const payload: LeadStatusDraft = { ...s, display_order: idx + 1 };
                return s.id ? updateLeadStatus(s.id, payload) : createLeadStatus(payload);
            })
    );
}
