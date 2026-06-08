import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    ORG_TEAM_BASE,
    ORG_TEAM_BY_ID,
    ORG_TEAM_CHART,
    ORG_TEAM_LIST,
    ORG_TEAM_MEMBERS,
    ORG_TEAM_MEMBER_BY_ID,
    ORG_TEAM_USER_MEMBERSHIPS,
} from '@/constants/urls';

// ── Wire types ────────────────────────────────────────────────────

export interface OrgTeam {
    id: string;
    institute_id: string;
    name: string;
    description: string | null;
    status: string;
    member_count: number;
    created_at: string | null;
    updated_at: string | null;
}

export interface TeamMember {
    mapping_id: string;
    team_id: string;
    user_id: string;
    parent_user_id: string | null;
    role_label: string | null;
    status: string;
    added_at: string | null;
}

/**
 * One node in a team's reporting tree. Children are nested. UI resolves
 * the display name, email and system role fresh from auth-service so role
 * changes propagate automatically — never stored on the chart.
 */
export interface OrgChartNode {
    mapping_id: string;
    team_id: string;
    user_id: string;
    parent_user_id: string | null;
    role_label: string | null;
    children: OrgChartNode[];
}

export interface CreateTeamPayload {
    institute_id: string;
    name: string;
    description?: string;
}

export interface UpdateTeamPayload {
    name?: string;
    description?: string;
}

export interface AddMemberPayload {
    user_id: string;
    /** Null = top of team. */
    parent_user_id?: string | null;
    role_label?: string;
}

/**
 * Drag-drop sends change_parent=true with the new parent_user_id (null =
 * top of team). Inline label edit sends change_role_label=true with the
 * new value (empty string = clear).
 */
export interface UpdateMemberPayload {
    change_parent?: boolean;
    parent_user_id?: string | null;
    change_role_label?: boolean;
    role_label?: string;
}

// ── Teams ─────────────────────────────────────────────────────────

export async function listTeams(instituteId: string): Promise<OrgTeam[]> {
    const res = await authenticatedAxiosInstance.get<OrgTeam[]>(ORG_TEAM_LIST(instituteId));
    return res.data;
}

export async function createTeam(payload: CreateTeamPayload): Promise<OrgTeam> {
    const res = await authenticatedAxiosInstance.post<OrgTeam>(ORG_TEAM_BASE, payload);
    return res.data;
}

export async function updateTeam(teamId: string, payload: UpdateTeamPayload): Promise<OrgTeam> {
    const res = await authenticatedAxiosInstance.put<OrgTeam>(ORG_TEAM_BY_ID(teamId), payload);
    return res.data;
}

export async function deleteTeam(teamId: string): Promise<void> {
    await authenticatedAxiosInstance.delete(ORG_TEAM_BY_ID(teamId));
}

// ── Members + chart ──────────────────────────────────────────────

export async function fetchTeamChart(teamId: string): Promise<OrgChartNode[]> {
    const res = await authenticatedAxiosInstance.get<OrgChartNode[]>(ORG_TEAM_CHART(teamId));
    return res.data;
}

export async function listTeamMembers(teamId: string): Promise<TeamMember[]> {
    const res = await authenticatedAxiosInstance.get<TeamMember[]>(ORG_TEAM_MEMBERS(teamId));
    return res.data;
}

export async function addTeamMember(
    teamId: string,
    payload: AddMemberPayload
): Promise<TeamMember> {
    const res = await authenticatedAxiosInstance.post<TeamMember>(
        ORG_TEAM_MEMBERS(teamId),
        payload
    );
    return res.data;
}

export async function updateTeamMember(
    teamId: string,
    mappingId: string,
    payload: UpdateMemberPayload
): Promise<TeamMember> {
    const res = await authenticatedAxiosInstance.patch<TeamMember>(
        ORG_TEAM_MEMBER_BY_ID(teamId, mappingId),
        payload
    );
    return res.data;
}

export async function removeTeamMember(teamId: string, mappingId: string): Promise<void> {
    await authenticatedAxiosInstance.delete(ORG_TEAM_MEMBER_BY_ID(teamId, mappingId));
}

/** All teams a user is in — used by the multi-team badge on cards. */
export async function fetchUserMemberships(userId: string): Promise<TeamMember[]> {
    const res = await authenticatedAxiosInstance.get<TeamMember[]>(
        ORG_TEAM_USER_MEMBERSHIPS(userId)
    );
    return res.data;
}
