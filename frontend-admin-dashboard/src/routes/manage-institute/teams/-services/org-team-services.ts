import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    ORG_TEAM_BASE,
    ORG_TEAM_BY_ID,
    ORG_TEAM_CHART,
    ORG_TEAM_CHART_WITH_MEMBERS,
    ORG_TEAM_MEMBERS,
    ORG_TEAM_MEMBER_BY_ID,
} from '@/constants/urls';

export interface OrgTeamNode {
    id: string;
    parent_id: string | null;
    name: string;
    code: string | null;
    team_type: string | null;
    description: string | null;
    head_user_id: string | null;
    sort_order: number;
    member_count: number;
    children: OrgTeamNode[];
    /** Populated only by fetchOrgChartWithMembers; null on the plain chart endpoint. */
    members?: TeamMember[] | null;
}

export interface TeamMember {
    mapping_id: string;
    team_id: string;
    user_id: string;
    role_name: string;
    role_label: string | null;
    is_team_head: boolean;
    status: string;
    added_at: string;
}

export interface CreateTeamPayload {
    institute_id: string;
    parent_id?: string | null;
    name: string;
    description?: string;
    sort_order?: number;
}

export interface UpdateTeamPayload {
    name?: string;
    description?: string;
    sort_order?: number;
    move_parent?: boolean;
    parent_id?: string | null;
}

export interface AddMemberPayload {
    user_id: string;
    role_name: string;
    role_label?: string;
    is_team_head?: boolean;
}

export interface UpdateMemberPayload {
    role_label?: string;
    is_team_head?: boolean;
}

export async function fetchOrgChart(instituteId: string): Promise<OrgTeamNode[]> {
    const res = await authenticatedAxiosInstance.get<OrgTeamNode[]>(ORG_TEAM_CHART(instituteId));
    return res.data;
}

/**
 * Same nested tree as fetchOrgChart, but each node also carries its
 * ACTIVE members. Single round-trip — backend joins teams + mappings.
 */
export async function fetchOrgChartWithMembers(instituteId: string): Promise<OrgTeamNode[]> {
    const res = await authenticatedAxiosInstance.get<OrgTeamNode[]>(
        ORG_TEAM_CHART_WITH_MEMBERS(instituteId)
    );
    return res.data;
}

export async function createTeam(payload: CreateTeamPayload) {
    const res = await authenticatedAxiosInstance.post(ORG_TEAM_BASE, payload);
    return res.data;
}

export async function updateTeam(teamId: string, payload: UpdateTeamPayload) {
    const res = await authenticatedAxiosInstance.put(ORG_TEAM_BY_ID(teamId), payload);
    return res.data;
}

export async function deleteTeam(teamId: string, cascade: boolean = false) {
    const res = await authenticatedAxiosInstance.delete(
        `${ORG_TEAM_BY_ID(teamId)}?cascade=${cascade}`
    );
    return res.data;
}

export async function listTeamMembers(teamId: string): Promise<TeamMember[]> {
    const res = await authenticatedAxiosInstance.get<TeamMember[]>(ORG_TEAM_MEMBERS(teamId));
    return res.data;
}

export async function addTeamMember(teamId: string, payload: AddMemberPayload) {
    const res = await authenticatedAxiosInstance.post(ORG_TEAM_MEMBERS(teamId), payload);
    return res.data;
}

export async function updateTeamMember(teamId: string, mappingId: string, payload: UpdateMemberPayload) {
    const res = await authenticatedAxiosInstance.patch(
        ORG_TEAM_MEMBER_BY_ID(teamId, mappingId),
        payload
    );
    return res.data;
}

export async function removeTeamMember(teamId: string, mappingId: string) {
    const res = await authenticatedAxiosInstance.delete(ORG_TEAM_MEMBER_BY_ID(teamId, mappingId));
    return res.data;
}
