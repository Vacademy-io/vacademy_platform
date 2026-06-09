import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    COUNSELLOR_WORKBENCH_ACTIVITY,
    COUNSELLOR_WORKBENCH_CONFIG,
    COUNSELLOR_WORKBENCH_CONFIG_UPDATE,
    COUNSELLOR_WORKBENCH_COUNSELLOR_LEADS,
    COUNSELLOR_WORKBENCH_MY_LEADS,
    COUNSELLOR_WORKBENCH_MY_TEAM,
    COUNSELLOR_WORKBENCH_REASSIGN,
    COUNSELLOR_WORKBENCH_REASSIGN_PREVIEW,
    COUNSELLOR_WORKBENCH_SET_STATUS,
    COUNSELLOR_WORKBENCH_TEAM_COUNSELLORS,
} from '@/constants/urls';

export interface WorkbenchTeam {
    team_id: string;
    team_name: string;
    leads_root_team_id: string;
    ancestor_names: string[];
    descendant_team_ids: string[];
}

export interface WorkbenchCounsellor {
    user_id: string;
    full_name: string | null;
    email: string | null;
    team_id: string | null;
    team_name: string | null;
    role_label: string | null;
    is_active: boolean;
    open_leads_count: number;
    rating: number | null;
    rating_strategy_type: string | null;
}

export interface WorkbenchLead {
    lead_id: string;
    user_id: string;
    lead_name: string | null;
    lead_email: string | null;
    lead_phone: string | null;
    conversion_status: string;
    lead_status_label: string | null;
    lead_tier: string | null;
    best_score: number | null;
    assigned_counselor_id: string | null;
    assigned_counselor_name: string | null;
    assigned_at: string | null;
    last_activity_at: string | null;
    campaign_name: string | null;
    source_type: string | null;
}

export interface ActivityFeedItem {
    id: string;
    source_table: 'telephony_call_log' | 'lead_followup' | 'timeline_event';
    action_type: string;
    lead_id: string | null;
    lead_name: string | null;
    title: string | null;
    description: string | null;
    metadata_json: string | null;
    created_at: string;
}

export interface ReassignAssignment {
    lead_id: string;
    to_user_id: string;
}

export type ReassignMode = 'SINGLE' | 'ROUND_ROBIN' | 'MANUAL';

export interface ReassignPayload {
    institute_id: string;
    from_user_id: string;
    mode: ReassignMode;
    target_user_id?: string;
    assignments?: ReassignAssignment[];
    // When true the source counsellor's pool memberships are flipped
    // INACTIVE in the same backend transaction as the reassignment commit.
    // Powers the reassign-first UI: confirming the dialog atomically moves
    // the leads AND takes the counsellor offline.
    mark_inactive?: boolean;
}

export interface ReassignResult {
    dry_run: boolean;
    total_leads: number;
    assignments: Array<{
        lead_id: string;
        lead_name: string | null;
        from_user_id: string;
        to_user_id: string;
        to_user_name: string | null;
    }>;
    marked_inactive?: boolean;
}

export interface StatusChangeResponse {
    user_id: string;
    status: string;
    pools_affected: number;
    open_leads: WorkbenchLead[];
}

export interface WorkbenchConfig {
    institute_id: string;
    leads_team_id: string | null;
    // Rating strategy fields — flattened on the wire, persisted inside
    // LEAD_SETTING.workbench.rating in the institute_setting JSON.
    strategy_type?: 'STATIC' | 'STRATEGY_BASED';
    starting_rating?: number;
    window_days?: number;
    success_status_keys?: string[];
    w_conversion?: number;
    w_velocity?: number;
    ideal_velocity_hours?: number;
    worst_velocity_hours?: number;
    min_sample_size?: number;
}

export async function fetchWorkbenchConfig(instituteId: string) {
    const res = await authenticatedAxiosInstance.get<WorkbenchConfig>(
        COUNSELLOR_WORKBENCH_CONFIG(instituteId)
    );
    return res.data;
}

export async function updateWorkbenchConfig(payload: WorkbenchConfig) {
    const res = await authenticatedAxiosInstance.put<WorkbenchConfig>(
        COUNSELLOR_WORKBENCH_CONFIG_UPDATE,
        payload
    );
    return res.data;
}

export async function fetchMyTeam(instituteId: string) {
    const res = await authenticatedAxiosInstance.get<WorkbenchTeam>(
        COUNSELLOR_WORKBENCH_MY_TEAM(instituteId)
    );
    return res.data;
}

export async function fetchMyLeads(
    instituteId: string,
    status?: string,
    page: number = 0,
    size: number = 20
) {
    const res = await authenticatedAxiosInstance.get<WorkbenchLead[]>(
        COUNSELLOR_WORKBENCH_MY_LEADS(instituteId, status, page, size)
    );
    return res.data;
}

/**
 * Per-counsellor leads. Used by the CSO / manager detail drawer — the
 * /me/leads endpoint can't return someone else's leads since it's
 * auth-scoped to the caller.
 */
export async function fetchCounsellorLeads(
    instituteId: string,
    counsellorUserId: string,
    status?: string,
    page: number = 0,
    size: number = 50
) {
    const res = await authenticatedAxiosInstance.get<WorkbenchLead[]>(
        COUNSELLOR_WORKBENCH_COUNSELLOR_LEADS(instituteId, counsellorUserId, status, page, size)
    );
    return res.data;
}

export async function fetchTeamCounsellors(instituteId: string, teamId: string) {
    const res = await authenticatedAxiosInstance.get<WorkbenchCounsellor[]>(
        COUNSELLOR_WORKBENCH_TEAM_COUNSELLORS(instituteId, teamId)
    );
    return res.data;
}

export async function setCounsellorStatus(userId: string, instituteId: string, status: string) {
    const res = await authenticatedAxiosInstance.patch<StatusChangeResponse>(
        COUNSELLOR_WORKBENCH_SET_STATUS(userId),
        { institute_id: instituteId, status }
    );
    return res.data;
}

export async function previewReassign(payload: ReassignPayload) {
    const res = await authenticatedAxiosInstance.post<ReassignResult>(
        COUNSELLOR_WORKBENCH_REASSIGN_PREVIEW,
        payload
    );
    return res.data;
}

export async function commitReassign(payload: ReassignPayload) {
    const res = await authenticatedAxiosInstance.post<ReassignResult>(
        COUNSELLOR_WORKBENCH_REASSIGN,
        payload
    );
    return res.data;
}

export async function fetchActivityFeed(
    userId: string,
    instituteId: string,
    fromMillis?: number,
    toMillis?: number,
    limit: number = 50
) {
    const res = await authenticatedAxiosInstance.get<ActivityFeedItem[]>(
        COUNSELLOR_WORKBENCH_ACTIVITY(userId, instituteId, fromMillis, toMillis, limit)
    );
    return res.data;
}
