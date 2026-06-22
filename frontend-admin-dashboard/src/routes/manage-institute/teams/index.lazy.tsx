import { createLazyFileRoute } from '@tanstack/react-router';
import { SearchInput } from '@/routes/manage-students/students-list/-components/students-list/student-list-section/search-input';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect, useState, useMemo } from 'react';
import { fetchInstituteDashboardUsers } from '@/routes/dashboard/-services/dashboard-services';
import { useRefetchUsersStore } from '@/routes/dashboard/-global-states/refetch-store-users';
import { getInstituteId } from '@/constants/helper';
import { UserRolesDataEntry } from '@/types/dashboard/user-roles';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import InviteUsersComponent from '@/routes/dashboard/-components/InviteUsersComponent';
import InstituteUsersOptions from '@/routes/dashboard/-components/InstituteUsersOptions';
import InviteUsersOptions from '@/routes/dashboard/-components/InviteUsersOptions';
import { RoleType, RoleTypeUserStatus } from '@/constants/dummy-data';
import { mapRoleToCustomName } from '@/utils/roleUtils';
import { MyTable } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { ColumnDef } from '@tanstack/react-table';
import { FilterChips } from '@/components/design-system/chips';
import { MyButton } from '@/components/design-system/button';
import { Funnel, X, Users } from '@phosphor-icons/react';
import { CornerDownLeft } from 'lucide-react';
import {
  getAllRoles,
  listUserSubOrgLinks,
  listAccessibleSubOrgs,
  type CustomRole,
  type AccessibleSubOrg,
} from '@/routes/manage-custom-teams/-services/custom-team-services';
import { getDisplaySettingsFromCache } from '@/services/display-settings';
import { ADMIN_DISPLAY_SETTINGS_KEY, TEACHER_DISPLAY_SETTINGS_KEY } from '@/types/display-settings';
import { getTokenFromCookie, getUserRoles } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { OrgChartTab } from './-components/OrgChartTab';

export interface RoleTypeSelectedFilter {
  roles: { id: string; name: string }[];
  status: { id: string; name: string }[];
  // Sub-org filter (Teams page only). Optional so the shared fetch/RoleType types stay compatible.
  subOrgs?: { id: string; name: string }[];
}

export interface TeamMemberRole {
  id: string;
  institute_id: string;
  role_name: string;
  status: string;
  role_id: string;
}

export interface TeamMember {
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

export interface PaginatedTeamResponse {
  content: TeamMember[];
  page_number: number;
  page_size: number;
  total_elements: number;
  total_pages: number;
  last: boolean;
  first: boolean;
}

// Type for tabs
type TabKey = 'instituteUsers' | 'invites' | 'orgChart';

export const Route = createLazyFileRoute('/manage-institute/teams/')({
  component: RouteComponent,
});

function RouteComponent() {
  const { setNavHeading } = useNavHeadingStore();
  const setHandleRefetchUsersData = useRefetchUsersStore(
    (state) => state.setHandleRefetchUsersData
  );
  const [isLoading, setIsLoading] = useState(false);
  const instituteId = getInstituteId();
  const [selectedTab, setSelectedTab] = useState<TabKey>('instituteUsers');
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [searchInput, setSearchInput] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);

  const [selectedFilter, setSelectedFilter] = useState<RoleTypeSelectedFilter>({
    roles: [],
    status: [],
    subOrgs: [],
  });

  const [dashboardUsers, setDashboardUsers] = useState<{
    instituteUsers: PaginatedTeamResponse | null;
    invites: PaginatedTeamResponse | null;
  }>({
    instituteUsers: null,
    invites: null,
  });

  // Sub-org linkages (via FSPSSM) for the "Sub-Orgs" column + filter. One institute-wide
  // fetch, cached — powers both the per-row chips and the client-side userId derivation that
  // drives the sub-org filter. Scoped server-side to the caller's accessible sub-orgs.
  const { data: userSubOrgLinks } = useQuery({
    queryKey: ['SUB_ORG_USER_LINKS', instituteId],
    queryFn: () => listUserSubOrgLinks(instituteId!),
    enabled: !!instituteId,
    staleTime: 5 * 60 * 1000,
  });
  const { data: accessibleSubOrgs } = useQuery({
    queryKey: ['ACCESSIBLE_SUB_ORGS', instituteId],
    queryFn: () => listAccessibleSubOrgs(instituteId!),
    enabled: !!instituteId,
    staleTime: 5 * 60 * 1000,
  });

  // userId -> the sub-orgs that user is linked to (for the column).
  const linksMap = useMemo(() => {
    const m = new Map<string, AccessibleSubOrg[]>();
    (userSubOrgLinks ?? []).forEach((link) => m.set(link.user_id, link.sub_orgs));
    return m;
  }, [userSubOrgLinks]);

  // Filter dropdown options.
  const subOrgFilterList = useMemo(
    () => (accessibleSubOrgs ?? []).map((so) => ({ id: so.id, label: so.name })),
    [accessibleSubOrgs]
  );

  // Resolve the viewer's effective display settings (admin or teacher cache,
  // matching the layout-container pattern). Custom-role users fall through to
  // teacher settings, which is the same baseline used elsewhere.
  const viewerTeamManagement = useMemo(() => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const viewerRoles = getUserRoles(accessToken);
    const isAdmin = viewerRoles.includes('ADMIN');
    const roleKey = isAdmin ? ADMIN_DISPLAY_SETTINGS_KEY : TEACHER_DISPLAY_SETTINGS_KEY;
    const ds = getDisplaySettingsFromCache(roleKey);
    return ds?.teamManagement;
  }, []);

  const viewerVisibleRoles = viewerTeamManagement?.visibleRoles ?? {};

  // Org Chart tab is opt-in per institute. Default false so it stays hidden
  // until an admin explicitly flips it on under Settings → Admin Display Settings.
  const orgChartTabVisible = viewerTeamManagement?.orgChartTabVisible === true;

  // All roles from the API for filters and dropdowns. Exclude STUDENT and any
  // roles the viewer's display settings have hidden — self-role is never
  // hidden to prevent lockout from admin/teacher self-management.
  const allRoles = useMemo(() => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const viewerRoles = (getUserRoles(accessToken) || []).map((r) => r.toUpperCase());
    return customRoles
      .filter((cr) => cr.name !== 'STUDENT')
      .filter((cr) => {
        const key = cr.name.toUpperCase();
        if (viewerRoles.includes(key)) return true;
        return viewerVisibleRoles[key] !== false;
      })
      .map((cr) => ({
        id: cr.id,
        name: cr.name,
      }));
  }, [customRoles, viewerVisibleRoles]);

  // Default filter with all roles (used in API calls when no filter selected)
  const allRolesFilter = useMemo(() => {
    return allRoles.map((r) => ({ id: r.id, name: r.name }));
  }, [allRoles]);

  // The tab's default status set (Institute Users = ACTIVE/DISABLED, Invites = INVITED).
  const statusDefaultForTab = (tab: TabKey) =>
    tab === 'instituteUsers'
      ? [
        { id: '1', name: 'ACTIVE' },
        { id: '2', name: 'DISABLED' },
      ]
      : [{ id: '1', name: 'INVITED' }];

  // Resolve the filter we actually send: mirrors the existing role/status defaulting (no
  // explicit roles/status → fall back to all-roles + tab-default status) and carries the
  // sub-org selection through so the sub-org filter survives pagination / refetch. Empty
  // status would otherwise leak INVITED users into the Institute Users tab, so we always
  // default it when the user hasn't picked one.
  const buildEffectiveFilter = (
    filter: RoleTypeSelectedFilter,
    tab: TabKey
  ): RoleTypeSelectedFilter => {
    const hasRoleOrStatus = filter.roles.length > 0 || filter.status.length > 0;
    return {
      roles: hasRoleOrStatus ? filter.roles : allRolesFilter,
      status: hasRoleOrStatus ? filter.status : statusDefaultForTab(tab),
      subOrgs: filter.subOrgs ?? [],
    };
  };

  // Transform RoleType data to show custom names while preserving backend values
  const roleTypeWithCustomNames = allRoles.map((role) => ({
    ...role,
    name: mapRoleToCustomName(role.name),
    label: mapRoleToCustomName(role.name),
  }));

  const roleStatusWithLabel = RoleTypeUserStatus.map((status) => ({
    ...status,
    label: status.name,
  }));



  const getDashboardUsersData = useMutation({
    mutationFn: ({
      instituteId,
      selectedFilter,
      pageNumber,
      name,
    }: {
      instituteId: string | undefined;
      selectedFilter: RoleTypeSelectedFilter;
      pageNumber: number;
      name?: string;
    }) => {
      // When a sub-org filter is active, resolve the matching user IDs from the cached
      // institute-wide links map (covers all pages → server-side pagination stays correct)
      // and pass them as user_ids. The backend ANDs user_ids with roles/status and returns an
      // empty page for an empty list, so a zero-match selection needs no special handling here.
      const selectedSubOrgIds = (selectedFilter.subOrgs ?? []).map((s) => s.id);
      let userIds: string[] | undefined;
      if (selectedSubOrgIds.length > 0) {
        const selectedSet = new Set(selectedSubOrgIds);
        userIds = (userSubOrgLinks ?? [])
          .filter((link) => link.sub_orgs.some((so) => selectedSet.has(so.id)))
          .map((link) => link.user_id);
      }
      return fetchInstituteDashboardUsers(
        instituteId,
        selectedFilter,
        pageNumber,
        pageSize,
        name || '',
        userIds
      );
    },
    onSuccess: (data) => {
      console.log('data', data);
      if (selectedTab === 'instituteUsers') {
        setDashboardUsers((prev) => ({ ...prev, instituteUsers: data }));
      } else {
        setDashboardUsers((prev) => ({ ...prev, invites: data }));
      }
    },
    onError: (error: unknown) => {
      throw error;
    },
  });

  const handleSubmitFilters = () => {
    setPage(0); // Reset to first page when filters change
    getDashboardUsersData.mutate({
      instituteId,
      selectedFilter: buildEffectiveFilter(selectedFilter, selectedTab),
      pageNumber: 0,
      name: searchFilter,
    });
  };

  const handleResetFilters = () => {
    setPage(0);
    setSelectedFilter({
      roles: [],
      status: [],
      subOrgs: [],
    });
    getDashboardUsersData.mutate({
      instituteId,
      selectedFilter: {
        roles: allRolesFilter,
        status:
          selectedTab === 'instituteUsers'
            ? [
              { id: '1', name: 'ACTIVE' },
              { id: '2', name: 'DISABLED' },
            ]
            : [{ id: '1', name: 'INVITED' }],
      },
      pageNumber: 0,
      name: searchFilter,
    });
  };

  const handleSearch = () => {
    if (searchInput.trim()) {
      setSearchFilter(searchInput);
      setPage(0);
      getDashboardUsersData.mutate({
        instituteId,
        selectedFilter: buildEffectiveFilter(selectedFilter, selectedTab),
        pageNumber: 0,
        name: searchInput,
      });
    }
  };

  const handleTabChange = (value: string) => {
    if (value === 'orgChart') {
      // Defence in depth: if the flag is off, do not switch to the org tab
      // even if some stale URL/router state asks for it.
      if (!orgChartTabVisible) return;
      setSelectedTab('orgChart');
      // Org chart owns its own data fetching; skip the dashboard users mutation.
      return;
    }
    if (value === 'instituteUsers' || value === 'invites') {
      setSelectedTab(value as TabKey);
      setPage(0);
      getDashboardUsersData.mutate({
        instituteId,
        selectedFilter: {
          roles: allRolesFilter,
          status:
            value === 'instituteUsers'
              ? [
                { id: '1', name: 'ACTIVE' },
                { id: '2', name: 'DISABLED' },
              ]
              : [{ id: '1', name: 'INVITED' }],
        },
        pageNumber: 0,
        name: searchFilter,
      });
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    getDashboardUsersData.mutate({
      instituteId,
      selectedFilter: buildEffectiveFilter(selectedFilter, selectedTab),
      pageNumber: newPage,
      name: searchFilter,
    });
  };

  const handleRefetchData = () => {
    getDashboardUsersData.mutate({
      instituteId,
      selectedFilter: buildEffectiveFilter(selectedFilter, selectedTab),
      pageNumber: page,
      name: searchFilter,
    });
  };

  useEffect(() => {
    setHandleRefetchUsersData(handleRefetchData);
  }, [setHandleRefetchUsersData, page, selectedFilter, selectedTab, allRolesFilter]);

  // Fetch custom roles on mount
  useEffect(() => {
    getAllRoles()
      .then((roles: CustomRole[]) => {
        setCustomRoles(roles || []);
      })
      .catch((error) => {
        console.error('Failed to fetch custom roles:', error);
      });
  }, []);

  // Fetch initial data once custom roles are loaded
  useEffect(() => {
    setIsLoading(true);
    fetchInstituteDashboardUsers(instituteId, {
      roles: allRolesFilter,
      status: [
        { id: '1', name: 'ACTIVE' },
        { id: '2', name: 'DISABLED' },
      ],
    }, 0, pageSize)
      .then((data) => {
        setDashboardUsers((prev) => ({
          ...prev,
          instituteUsers: data,
        }));
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [allRolesFilter]);

  useEffect(() => {
    setNavHeading('Teams');
  }, []);

  // Convert TeamMember to UserRolesDataEntry for the options components
  const toUserRolesDataEntry = (member: TeamMember): UserRolesDataEntry => ({
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
  });

  // Define table columns
  const columns: ColumnDef<TeamMember>[] = [
    {
      accessorKey: 'full_name',
      header: 'Name',
      size: 200,
      cell: ({ row }) => (
        <div className="text-sm font-medium text-neutral-700">
          {row.original.full_name || '-'}
        </div>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      size: 250,
      cell: ({ row }) => (
        <div className="text-sm text-neutral-600">
          {row.original.email || '-'}
        </div>
      ),
    },
    {
      accessorKey: 'username',
      header: 'Username',
      size: 150,
      cell: ({ row }) => (
        <div className="text-sm text-neutral-600">
          {row.original.username || '-'}
        </div>
      ),
    },
    {
      accessorKey: 'mobile_number',
      header: 'Phone',
      size: 150,
      cell: ({ row }) => (
        <div className="text-sm text-neutral-600">
          {row.original.mobile_number || '-'}
        </div>
      ),
    },
    {
      accessorKey: 'roles',
      header: 'Roles',
      size: 250,
      cell: ({ row }) => {
        const instituteRoles = row.original.roles.filter(
          (role) => role.institute_id === instituteId
        );
        return (
          <div className="flex flex-wrap gap-1">
            {instituteRoles.map((role) => (
              <span
                key={role.id}
                className="rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-700"
              >
                {mapRoleToCustomName(role.role_name)}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      id: 'subOrgs',
      header: 'Sub-Orgs',
      size: 200,
      cell: ({ row }) => {
        const subOrgs = linksMap.get(row.original.id) ?? [];
        if (subOrgs.length === 0) {
          return <div className="text-sm text-neutral-400">-</div>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {subOrgs.map((subOrg) => (
              <span
                key={subOrg.id}
                className="rounded-full bg-info-50 px-2 py-0.5 text-xs text-info-600"
              >
                {subOrg.name}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 80,
      cell: ({ row }) => {
        const member = row.original;
        const userEntry = toUserRolesDataEntry(member);
        if (selectedTab === 'instituteUsers') {
          return (
            <InstituteUsersOptions
              user={userEntry}
              refetchData={handleRefetchData}
              availableRoles={allRoles}
            />
          );
        }
        return (
          <InviteUsersOptions
            user={userEntry}
            refetchData={handleRefetchData}
            availableRoles={allRoles}
          />
        );
      },
    },
  ];



  const currentData = selectedTab === 'instituteUsers'
    ? dashboardUsers.instituteUsers
    : dashboardUsers.invites;

  return (
    <LayoutContainer>
      <Tabs value={selectedTab} onValueChange={handleTabChange}>
        <div className="mb-6 flex items-center justify-between">
          <TabsList className="inline-flex h-auto justify-start gap-4 rounded-none border-b !bg-transparent p-0">
            <TabsTrigger
              value="instituteUsers"
              className={`flex gap-1.5 rounded-none px-12 py-2 !shadow-none ${selectedTab === 'instituteUsers'
                ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                : 'border-none bg-transparent'
                }`}
            >
              <span className={`${selectedTab === 'instituteUsers' ? 'text-primary-500' : ''}`}>
                Institute Users
              </span>
              <Badge
                className="rounded-[10px] bg-primary-500 p-0 px-2 text-[9px] text-white"
                variant="outline"
              >
                {dashboardUsers.instituteUsers?.total_elements || 0}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="invites"
              className={`flex gap-1.5 rounded-none px-12 py-2 !shadow-none ${selectedTab === 'invites'
                ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                : 'border-none bg-transparent'
                }`}
            >
              <span className={`${selectedTab === 'invites' ? 'text-primary-500' : ''}`}>
                Invites
              </span>
              <Badge
                className="rounded-[10px] bg-primary-500 p-0 px-2 text-[9px] text-white"
                variant="outline"
              >
                {dashboardUsers.invites?.total_elements || 0}
              </Badge>
            </TabsTrigger>
            {orgChartTabVisible && (
              <TabsTrigger
                value="orgChart"
                className={`flex gap-1.5 rounded-none px-12 py-2 !shadow-none ${selectedTab === 'orgChart'
                  ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                  : 'border-none bg-transparent'
                  }`}
              >
                <span className={`${selectedTab === 'orgChart' ? 'text-primary-500' : ''}`}>
                  Org Chart
                </span>
              </TabsTrigger>
            )}
          </TabsList>
          {selectedTab !== 'orgChart' && (
            <InviteUsersComponent refetchData={handleRefetchData} availableRoles={allRoles} />
          )}
        </div>

        {selectedTab === 'orgChart' && orgChartTabVisible && instituteId ? (
          <OrgChartTab instituteId={instituteId} />
        ) : (
        <>
        <div className="mb-4 flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex w-[320px] items-center gap-2">
            <div className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
            >
              <SearchInput
                searchInput={searchInput}
                onSearchChange={(e) => {
                  setSearchInput(e.target.value);
                  // Auto-clear search when input is empty
                  if (e.target.value === '') {
                    setSearchFilter('');
                    setPage(0);
                    getDashboardUsersData.mutate({
                      instituteId,
                      selectedFilter: buildEffectiveFilter(selectedFilter, selectedTab),
                      pageNumber: 0,
                      name: '',
                    });
                  }
                }}
                placeholder="Search by name, email..."
              />
            </div>
            {searchInput.length > 0 && (
              <button
                onClick={handleSearch}
                className="flex h-5 w-5 items-center justify-center rounded-md bg-primary-500 text-white hover:bg-primary-600 transition-colors shadow-sm"
              >
                <CornerDownLeft size={14} strokeWidth={2.5} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <FilterChips
              label="Role Type"
              filterList={roleTypeWithCustomNames}
              selectedFilters={selectedFilter.roles.map(r => ({ id: r.id, label: r.name }))}
              handleSelect={(option) => {
                const isSelected = selectedFilter.roles.some(r => r.id === option.id);
                if (isSelected) {
                  // Remove the option
                  setSelectedFilter(prev => ({
                    ...prev,
                    roles: prev.roles.filter(r => r.id !== option.id)
                  }));
                } else {
                  // Add the option
                  const originalRole = allRoles.find((role) => role.id === option.id);
                  setSelectedFilter(prev => ({
                    ...prev,
                    roles: [...prev.roles, {
                      id: option.id,
                      name: originalRole?.name || option.label || '',
                    }]
                  }));
                }
              }}
              handleClearFilters={() => setSelectedFilter(prev => ({ ...prev, roles: [] }))}
            />
            {selectedTab === 'instituteUsers' && (
              <FilterChips
                label="Status"
                filterList={roleStatusWithLabel}
                selectedFilters={selectedFilter.status.map(s => ({ id: s.id, label: s.name }))}
                handleSelect={(option) => {
                  const isSelected = selectedFilter.status.some(s => s.id === option.id);
                  if (isSelected) {
                    // Remove the option
                    setSelectedFilter(prev => ({
                      ...prev,
                      status: prev.status.filter(s => s.id !== option.id)
                    }));
                  } else {
                    // Add the option - use label as name since they are same for status
                    setSelectedFilter(prev => ({
                      ...prev,
                      status: [...prev.status, {
                        id: option.id,
                        name: option.label || '',
                      }]
                    }));
                  }
                }}
                handleClearFilters={() => setSelectedFilter(prev => ({ ...prev, status: [] }))}
              />
            )}
            {selectedTab === 'instituteUsers' && subOrgFilterList.length > 0 && (
              <FilterChips
                label="Sub-Org"
                filterList={subOrgFilterList}
                selectedFilters={(selectedFilter.subOrgs ?? []).map(s => ({ id: s.id, label: s.name }))}
                handleSelect={(option) => {
                  const current = selectedFilter.subOrgs ?? [];
                  const isSelected = current.some(s => s.id === option.id);
                  if (isSelected) {
                    setSelectedFilter(prev => ({
                      ...prev,
                      subOrgs: (prev.subOrgs ?? []).filter(s => s.id !== option.id),
                    }));
                  } else {
                    setSelectedFilter(prev => ({
                      ...prev,
                      subOrgs: [...(prev.subOrgs ?? []), { id: option.id, name: option.label || '' }],
                    }));
                  }
                }}
                handleClearFilters={() => setSelectedFilter(prev => ({ ...prev, subOrgs: [] }))}
              />
            )}
            <div className="flex items-center gap-2">
              {(selectedFilter.roles.length > 0 || selectedFilter.status.length > 0 || (selectedFilter.subOrgs?.length ?? 0) > 0) && (
                <MyButton
                  buttonType="primary"
                  scale="small"
                  onClick={handleSubmitFilters}
                >
                  <div className="flex items-center gap-2">
                    <Funnel size={16} />
                    <span>Apply Filters</span>
                  </div>
                </MyButton>
              )}
              {(selectedFilter.roles.length > 0 || selectedFilter.status.length > 0 || (selectedFilter.subOrgs?.length ?? 0) > 0 || searchFilter) && (
                <MyButton
                  buttonType="secondary"
                  scale="small"
                  onClick={() => {
                    handleResetFilters();
                    setSearchInput('');
                    setSearchFilter('');
                  }}
                >
                  <div className="flex items-center gap-2">
                    <X size={16} />
                    <span>Clear All</span>
                  </div>
                </MyButton>
              )}
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="mt-4">
          {currentData && currentData.content.length > 0 ? (
            <>
              <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
                <MyTable<TeamMember>
                  data={{
                    content: currentData.content,
                    total_pages: currentData.total_pages,
                    page_no: currentData.page_number,
                    page_size: currentData.page_size,
                    total_elements: currentData.total_elements,
                    last: currentData.last,
                  }}
                  columns={columns}
                  isLoading={getDashboardUsersData.isPending}
                  error={getDashboardUsersData.error}
                  currentPage={page}
                />
              </div>

              {/* Pagination */}
              <div className="mt-4 flex justify-end">
                <MyPagination
                  currentPage={page}
                  totalPages={currentData.total_pages}
                  onPageChange={handlePageChange}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-neutral-200 bg-white py-16 text-center shadow-sm">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-50 border border-neutral-100">
                <Users size={32} className="text-neutral-400" weight="duotone" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-neutral-900">
                No team members found
              </h3>
              <p className="mb-6 max-w-sm text-sm text-neutral-500">
                We couldn't find any team members matching your current search or filters. Try adjusting them or invite new users.
              </p>
              {(selectedFilter.roles.length > 0 || selectedFilter.status.length > 0 || (selectedFilter.subOrgs?.length ?? 0) > 0 || searchFilter) && (
                <MyButton
                  buttonType="secondary"
                  scale="medium"
                  onClick={() => {
                    handleResetFilters();
                    setSearchInput('');
                    setSearchFilter('');
                  }}
                >
                  Clear all filters
                </MyButton>
              )}
            </div>
          )}
        </div>
        </>
        )}
      </Tabs>
    </LayoutContainer>
  );
}
