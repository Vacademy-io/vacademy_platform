import { createLazyFileRoute } from '@tanstack/react-router';
import { SearchInput } from '@/routes/manage-students/students-list/-components/students-list/student-list-section/search-input';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect, useState, useRef } from 'react';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { fetchInstituteDashboardUsers } from '@/routes/dashboard/-services/dashboard-services';
import { useRefetchUsersStore } from '@/routes/dashboard/-global-states/refetch-store-users';
import { getInstituteId } from '@/constants/helper';
import { RolesDummyDataType } from '@/types/dashboard/user-roles';
import { MyFilterOption } from '@/types/assessments/my-filter';
import { useMutation } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScheduleTestFilters } from '@/routes/assessment/assessment-list/-components/ScheduleTestFilters';
import RoleTypeFilterButtons from '@/routes/dashboard/-components/RoleTypeFilterButtons';
import InviteUsersComponent from '@/routes/dashboard/-components/InviteUsersComponent';
import InstituteUsersComponent from '@/routes/dashboard/-components/InstituteUsersTab';
import InviteUsersTab from '@/routes/dashboard/-components/InviteUsersTab';
import { RoleType, RoleTypeUserStatus } from '@/constants/dummy-data';
import { mapRoleToCustomName } from '@/utils/roleUtils';
import { MyTable } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { ColumnDef } from '@tanstack/react-table';
import { FilterChips } from '@/components/design-system/chips';
import { MyButton } from '@/components/design-system/button';
import { Funnel, X, Users } from '@phosphor-icons/react';
import { CornerDownLeft } from 'lucide-react';

export interface RoleTypeSelectedFilter {
  roles: { id: string; name: string }[];
  status: { id: string; name: string }[];
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
type TabKey = 'instituteUsers' | 'invites';

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

  const [selectedFilter, setSelectedFilter] = useState<RoleTypeSelectedFilter>({
    roles: [],
    status: [],
  });

  const [dashboardUsers, setDashboardUsers] = useState<{
    instituteUsers: PaginatedTeamResponse | null;
    invites: PaginatedTeamResponse | null;
  }>({
    instituteUsers: null,
    invites: null,
  });

  // Transform RoleType data to show custom names while preserving backend values
  const roleTypeWithCustomNames = RoleType.map((role) => ({
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
    }) => fetchInstituteDashboardUsers(instituteId, selectedFilter, pageNumber, pageSize, name || ''),
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
      selectedFilter,
      pageNumber: 0,
      name: searchFilter,
    });
  };

  const handleResetFilters = () => {
    setPage(0);
    setSelectedFilter({
      roles: [],
      status: [],
    });
    getDashboardUsersData.mutate({
      instituteId,
      selectedFilter: {
        roles: [
          { id: '1', name: 'ADMIN' },
          { id: '2', name: 'COURSE CREATOR' },
          { id: '3', name: 'ASSESSMENT CREATOR' },
          { id: '4', name: 'EVALUATOR' },
          { id: '5', name: 'TEACHER' },
        ],
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
        selectedFilter: selectedFilter.roles.length > 0 || selectedFilter.status.length > 0
          ? selectedFilter
          : {
            roles: [
              { id: '1', name: 'ADMIN' },
              { id: '2', name: 'COURSE CREATOR' },
              { id: '3', name: 'ASSESSMENT CREATOR' },
              { id: '4', name: 'EVALUATOR' },
              { id: '5', name: 'TEACHER' },
            ],
            status:
              selectedTab === 'instituteUsers'
                ? [
                  { id: '1', name: 'ACTIVE' },
                  { id: '2', name: 'DISABLED' },
                ]
                : [{ id: '1', name: 'INVITED' }],
          },
        pageNumber: 0,
        name: searchInput,
      });
    }
  };

  const handleTabChange = (value: string) => {
    if (value === 'instituteUsers' || value === 'invites') {
      setSelectedTab(value as TabKey);
      setPage(0);
      getDashboardUsersData.mutate({
        instituteId,
        selectedFilter: {
          roles: [
            { id: '1', name: 'ADMIN' },
            { id: '2', name: 'COURSE CREATOR' },
            { id: '3', name: 'ASSESSMENT CREATOR' },
            { id: '4', name: 'EVALUATOR' },
            { id: '5', name: 'TEACHER' },
          ],
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
      selectedFilter: selectedFilter.roles.length > 0 || selectedFilter.status.length > 0
        ? selectedFilter
        : {
          roles: [
            { id: '1', name: 'ADMIN' },
            { id: '2', name: 'COURSE CREATOR' },
            { id: '3', name: 'ASSESSMENT CREATOR' },
            { id: '4', name: 'EVALUATOR' },
            { id: '5', name: 'TEACHER' },
          ],
          status:
            selectedTab === 'instituteUsers'
              ? [
                { id: '1', name: 'ACTIVE' },
                { id: '2', name: 'DISABLED' },
              ]
              : [{ id: '1', name: 'INVITED' }],
        },
      pageNumber: newPage,
      name: searchFilter,
    });
  };

  const handleRefetchData = () => {
    getDashboardUsersData.mutate({
      instituteId,
      selectedFilter: selectedFilter.roles.length > 0 || selectedFilter.status.length > 0
        ? selectedFilter
        : {
          roles: [
            { id: '1', name: 'ADMIN' },
            { id: '2', name: 'COURSE CREATOR' },
            { id: '3', name: 'ASSESSMENT CREATOR' },
            { id: '4', name: 'EVALUATOR' },
            { id: '5', name: 'TEACHER' },
          ],
          status:
            selectedTab === 'instituteUsers'
              ? [
                { id: '1', name: 'ACTIVE' },
                { id: '2', name: 'DISABLED' },
              ]
              : [{ id: '1', name: 'INVITED' }],
        },
      pageNumber: page,
      name: searchFilter,
    });
  };

  useEffect(() => {
    setHandleRefetchUsersData(handleRefetchData);
  }, [setHandleRefetchUsersData, page, selectedFilter, selectedTab]);

  useEffect(() => {
    setIsLoading(true);
    fetchInstituteDashboardUsers(instituteId, {
      roles: [
        { id: '1', name: 'ADMIN' },
        { id: '2', name: 'COURSE CREATOR' },
        { id: '3', name: 'ASSESSMENT CREATOR' },
        { id: '4', name: 'EVALUATOR' },
        { id: '5', name: 'TEACHER' },
      ],
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
  }, []);

  useEffect(() => {
    setNavHeading('Teams');
  }, []);

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
          </TabsList>
          <InviteUsersComponent refetchData={handleRefetchData} />
        </div>

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
                      selectedFilter: selectedFilter.roles.length > 0 || selectedFilter.status.length > 0
                        ? selectedFilter
                        : {
                          roles: [
                            { id: '1', name: 'ADMIN' },
                            { id: '2', name: 'COURSE CREATOR' },
                            { id: '3', name: 'ASSESSMENT CREATOR' },
                            { id: '4', name: 'EVALUATOR' },
                            { id: '5', name: 'TEACHER' },
                          ],
                          status:
                            selectedTab === 'instituteUsers'
                              ? [
                                { id: '1', name: 'ACTIVE' },
                                { id: '2', name: 'DISABLED' },
                              ]
                              : [{ id: '1', name: 'INVITED' }],
                        },
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
                  const originalRole = RoleType.find((role) => role.id === option.id);
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
            <div className="flex items-center gap-2">
              {(selectedFilter.roles.length > 0 || selectedFilter.status.length > 0) && (
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
              {(selectedFilter.roles.length > 0 || selectedFilter.status.length > 0 || searchFilter) && (
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
              {(selectedFilter.roles.length > 0 || selectedFilter.status.length > 0 || searchFilter) && (
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
      </Tabs>
    </LayoutContainer>
  );
}
