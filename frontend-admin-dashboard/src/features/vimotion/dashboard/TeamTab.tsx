import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getInstituteId } from '@/constants/helper';
import { fetchInstituteDashboardUsers } from '@/routes/dashboard/-services/dashboard-services';
import InviteUsersComponent from '@/routes/dashboard/-components/InviteUsersComponent';
import InstituteUsersOptions from '@/routes/dashboard/-components/InstituteUsersOptions';
import InviteUsersOptions from '@/routes/dashboard/-components/InviteUsersOptions';
import { mapRoleToCustomName } from '@/utils/roleUtils';
import { UserRolesDataEntry } from '@/types/dashboard/user-roles';
import { SearchInput } from '@/routes/manage-students/students-list/-components/students-list/student-list-section/search-input';
import { Badge } from '@/components/ui/badge';

// Vimotion exposes only two roles for team management. IDs are arbitrary keys
// for the existing filter/dropdown components — the actual role-name strings
// ('ADMIN', 'CONTENT CREATOR') are what the invite/list APIs work with.
const VIM_ROLES: { id: string; name: string }[] = [
    { id: '1', name: 'ADMIN' },
    { id: '2', name: 'CONTENT CREATOR' },
];

type TeamSubTab = 'members' | 'invites';

interface TeamMemberRole {
    id: string;
    institute_id: string;
    role_name: string;
    status: string;
    role_id: string;
}

interface TeamMember {
    id: string;
    username: string;
    email: string;
    full_name: string;
    mobile_number: string | null;
    profile_pic_file_id: string | null;
    roles: TeamMemberRole[];
    status: string | null;
    root_user: boolean;
}

interface PaginatedTeamResponse {
    content: TeamMember[];
    page_number: number;
    page_size: number;
    total_elements: number;
    total_pages: number;
    last: boolean;
    first: boolean;
}

export function TeamTab() {
    const instituteId = getInstituteId();
    const [subTab, setSubTab] = useState<TeamSubTab>('members');
    const [searchInput, setSearchInput] = useState('');
    const [searchFilter, setSearchFilter] = useState('');
    const [members, setMembers] = useState<PaginatedTeamResponse | null>(null);
    const [invites, setInvites] = useState<PaginatedTeamResponse | null>(null);

    const statusForTab = useMemo(
        () =>
            subTab === 'members'
                ? [
                      { id: '1', name: 'ACTIVE' },
                      { id: '2', name: 'DISABLED' },
                  ]
                : [{ id: '1', name: 'INVITED' }],
        [subTab]
    );

    const fetchMutation = useMutation({
        mutationFn: ({ name }: { name: string }) =>
            fetchInstituteDashboardUsers(
                instituteId,
                { roles: VIM_ROLES, status: statusForTab },
                0,
                50,
                name
            ),
        onSuccess: (data: PaginatedTeamResponse) => {
            if (subTab === 'members') setMembers(data);
            else setInvites(data);
        },
    });

    const refetch = () => {
        fetchMutation.mutate({ name: searchFilter });
    };

    useEffect(() => {
        fetchMutation.mutate({ name: searchFilter });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subTab]);

    const handleSearch = () => {
        setSearchFilter(searchInput);
        fetchMutation.mutate({ name: searchInput });
    };

    const currentData = subTab === 'members' ? members : invites;
    const isLoading = fetchMutation.isPending;

    return (
        <div className="space-y-5" data-tour="vim-team-tab">
            <div className="flex items-center justify-between gap-4">
                <div className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white p-1">
                    <SubTabButton
                        active={subTab === 'members'}
                        onClick={() => setSubTab('members')}
                        label="Members"
                        count={members?.total_elements}
                    />
                    <SubTabButton
                        active={subTab === 'invites'}
                        onClick={() => setSubTab('invites')}
                        label="Invites"
                        count={invites?.total_elements}
                    />
                </div>
                <InviteUsersComponent refetchData={refetch} availableRoles={VIM_ROLES} />
            </div>

            <div className="flex items-center gap-2">
                <div
                    className="max-w-sm flex-1"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSearch();
                    }}
                >
                    <SearchInput
                        searchInput={searchInput}
                        onSearchChange={(e) => {
                            setSearchInput(e.target.value);
                            if (e.target.value === '') {
                                setSearchFilter('');
                                fetchMutation.mutate({ name: '' });
                            }
                        }}
                        placeholder="Search by name or email…"
                    />
                </div>
                {searchInput.length > 0 && (
                    <button
                        onClick={handleSearch}
                        className="flex size-7 items-center justify-center rounded-md bg-neutral-900 text-white transition-colors hover:bg-neutral-800"
                        aria-label="Search"
                    >
                        <CornerDownLeft size={14} strokeWidth={2.5} />
                    </button>
                )}
            </div>

            {currentData && currentData.content.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                    <table className="w-full text-sm">
                        <thead className="border-b border-neutral-200 bg-neutral-50/60 text-xs uppercase tracking-wide text-neutral-500">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium">Name</th>
                                <th className="px-4 py-3 text-left font-medium">Email</th>
                                <th className="px-4 py-3 text-left font-medium">Role</th>
                                {subTab === 'members' && (
                                    <th className="px-4 py-3 text-left font-medium">Status</th>
                                )}
                                <th className="w-12 px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {currentData.content.map((member) => (
                                <MemberRow
                                    key={member.id}
                                    member={member}
                                    instituteId={instituteId}
                                    subTab={subTab}
                                    refetch={refetch}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <EmptyState isLoading={isLoading} subTab={subTab} />
            )}
        </div>
    );
}

function SubTabButton({
    active,
    onClick,
    label,
    count,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    count?: number;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                active ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'
            )}
        >
            {label}
            {typeof count === 'number' && (
                <Badge
                    variant="outline"
                    className={cn(
                        'rounded-full border-0 px-1.5 py-0 text-[10px]',
                        active ? 'bg-white/15 text-white' : 'bg-neutral-100 text-neutral-600'
                    )}
                >
                    {count}
                </Badge>
            )}
        </button>
    );
}

function MemberRow({
    member,
    instituteId,
    subTab,
    refetch,
}: {
    member: TeamMember;
    instituteId: string | undefined;
    subTab: TeamSubTab;
    refetch: () => void;
}) {
    const userEntry = toUserRolesDataEntry(member);
    const instituteRoles = member.roles.filter((r) => r.institute_id === instituteId);
    const isActive = instituteRoles.some((r) => r.status === 'ACTIVE');

    return (
        <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60">
            <td className="px-4 py-3 font-medium text-neutral-800">{member.full_name || '—'}</td>
            <td className="px-4 py-3 text-neutral-600">{member.email || '—'}</td>
            <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                    {instituteRoles.map((role) => (
                        <span
                            key={role.id}
                            className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700"
                        >
                            {mapRoleToCustomName(role.role_name)}
                        </span>
                    ))}
                </div>
            </td>
            {subTab === 'members' && (
                <td className="px-4 py-3">
                    <span
                        className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                            isActive
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-neutral-100 text-neutral-500'
                        )}
                    >
                        <span
                            className={cn(
                                'size-1.5 rounded-full',
                                isActive ? 'bg-emerald-500' : 'bg-neutral-400'
                            )}
                        />
                        {isActive ? 'Active' : 'Disabled'}
                    </span>
                </td>
            )}
            <td className="px-4 py-3 text-right">
                {subTab === 'members' ? (
                    <InstituteUsersOptions
                        user={userEntry}
                        refetchData={refetch}
                        availableRoles={VIM_ROLES}
                    />
                ) : (
                    <InviteUsersOptions
                        user={userEntry}
                        refetchData={refetch}
                        availableRoles={VIM_ROLES}
                    />
                )}
            </td>
        </tr>
    );
}

function EmptyState({ isLoading, subTab }: { isLoading: boolean; subTab: TeamSubTab }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-white py-16 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-neutral-100">
                <Users className="size-5 text-neutral-500" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-900">
                {isLoading
                    ? 'Loading…'
                    : subTab === 'members'
                      ? 'No team members yet'
                      : 'No pending invites'}
            </h3>
            {!isLoading && (
                <p className="mt-1 max-w-xs text-xs text-neutral-500">
                    {subTab === 'members'
                        ? 'Invite admins and content creators to collaborate in your studio.'
                        : 'Invites you send will appear here until they are accepted.'}
                </p>
            )}
        </div>
    );
}

function toUserRolesDataEntry(member: TeamMember): UserRolesDataEntry {
    return {
        id: member.id,
        username: member.username,
        email: member.email,
        full_name: member.full_name,
        address_line: null,
        city: null,
        region: null,
        pin_code: null,
        mobile_number: member.mobile_number,
        date_of_birth: null,
        gender: null,
        password: null,
        profile_pic_file_id: member.profile_pic_file_id,
        roles: member.roles.map((r) => ({
            role_name: r.role_name,
            status: r.status,
            role_id: r.role_id,
        })),
        root_user: member.root_user,
        status: member.status || '',
    };
}
