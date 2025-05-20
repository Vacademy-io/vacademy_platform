import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
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

export interface RoleTypeSelectedFilter {
    roles: { id: string; name: string }[];
    status: { id: string; name: string }[];
}

// Type for tabs
type TabKey = keyof RolesDummyDataType;

export const Route = createFileRoute('/manage-institute/teams/')({
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
    const [selectedFilter, setSelectedFilter] = useState({
        roles: [],
        status: [],
    });

    const [dashboardUsers, setDashboardUsers] = useState({
        instituteUsers: [],
        invites: [],
    });

    const handleFilterChange = (filterKey: string, selectedItems: MyFilterOption[]) => {
        setSelectedFilter((prev) => {
            const updatedFilters = { ...prev, [filterKey]: selectedItems };
            return updatedFilters;
        });
    };

    const getDashboardUsersData = useMutation({
        mutationFn: ({
            instituteId,
            selectedFilter,
        }: {
            instituteId: string | undefined;
            selectedFilter: RoleTypeSelectedFilter;
        }) => fetchInstituteDashboardUsers(instituteId, selectedFilter),
        onSuccess: (data) => {
            if (selectedTab === 'instituteUsers') {
                setDashboardUsers({ ...dashboardUsers, ['instituteUsers']: data });
            } else {
                setDashboardUsers({ ...dashboardUsers, ['invites']: data });
            }
        },
        onError: (error: unknown) => {
            throw error;
        },
    });

    const handleSubmitFilters = () => {
        getDashboardUsersData.mutate({
            instituteId,
            selectedFilter,
        });
    };

    const handleResetFilters = () => {
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
        });
    };

    const handleTabChange = (value: string) => {
        if (value === 'instituteUsers' || value === 'invites') {
            setSelectedTab(value as TabKey);
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
            });
        }
    };

    const handleRefetchData = () => {
        const timeoutId = setTimeout(() => {
            Promise.all([
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
                }),
                fetchInstituteDashboardUsers(instituteId, {
                    roles: [
                        { id: '1', name: 'ADMIN' },
                        { id: '2', name: 'COURSE CREATOR' },
                        { id: '3', name: 'ASSESSMENT CREATOR' },
                        { id: '4', name: 'EVALUATOR' },
                        { id: '5', name: 'TEACHER' },
                    ],
                    status: [{ id: '1', name: 'INVITED' }],
                }),
            ])
                .then(([instituteUsersData, invitesData]) => {
                    setDashboardUsers((prev) => ({
                        ...prev,
                        instituteUsers: instituteUsersData,
                        invites: invitesData,
                    }));
                })
                .catch((error) => {
                    console.error(error);
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }, 0);

        return () => {
            clearTimeout(timeoutId);
        };
    };

    // Define the handleRefetchData function here
    useEffect(() => {
        setHandleRefetchUsersData(handleRefetchData);
    }, [setHandleRefetchUsersData]);

    useEffect(() => {
        setIsLoading(true);

        const timeoutId = setTimeout(() => {
            Promise.all([
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
                }),
                fetchInstituteDashboardUsers(instituteId, {
                    roles: [
                        { id: '1', name: 'ADMIN' },
                        { id: '2', name: 'COURSE CREATOR' },
                        { id: '3', name: 'ASSESSMENT CREATOR' },
                        { id: '4', name: 'EVALUATOR' },
                        { id: '5', name: 'TEACHER' },
                    ],
                    status: [{ id: '1', name: 'INVITED' }],
                }),
            ])
                .then(([instituteUsersData, invitesData]) => {
                    setDashboardUsers((prev) => ({
                        ...prev,
                        instituteUsers: instituteUsersData,
                        invites: invitesData,
                    }));
                })
                .catch((error) => {
                    console.error(error);
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }, 0);

        return () => {
            clearTimeout(timeoutId);
        };
    }, []);

    useEffect(() => {
        setNavHeading('Teams');
    }, []);

    if (isLoading)
        return (
            <div className="flex h-screen w-screen items-center justify-center">
                <DashboardLoader />;
            </div>
        );

    return (
        <LayoutContainer>
            <Tabs value={selectedTab} onValueChange={handleTabChange}>
                <div className="inline-flex h-auto w-full justify-between gap-0 rounded-none !bg-transparent p-0">
                    <div className="flex flex-wrap items-center gap-4">
                        <TabsList className="inline-flex h-auto justify-start gap-4 rounded-none border-b !bg-transparent p-0">
                            <TabsTrigger
                                value="instituteUsers"
                                className={`flex gap-1.5 rounded-none px-12 py-2 !shadow-none ${
                                    selectedTab === 'instituteUsers'
                                        ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                                        : 'border-none bg-transparent'
                                }`}
                            >
                                <span
                                    className={`${
                                        selectedTab === 'instituteUsers' ? 'text-primary-500' : ''
                                    }`}
                                >
                                    Institute Users
                                </span>
                                <Badge
                                    className="rounded-[10px] bg-primary-500 p-0 px-2 text-[9px] text-white"
                                    variant="outline"
                                >
                                    {dashboardUsers['instituteUsers'].length}
                                </Badge>
                            </TabsTrigger>
                            <TabsTrigger
                                value="invites"
                                className={`flex gap-1.5 rounded-none px-12 py-2 !shadow-none ${
                                    selectedTab === 'invites'
                                        ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                                        : 'border-none bg-transparent'
                                }`}
                            >
                                <span
                                    className={`${
                                        selectedTab === 'invites' ? 'text-primary-500' : ''
                                    }`}
                                >
                                    Invites
                                </span>
                                <Badge
                                    className="rounded-[10px] bg-primary-500 p-0 px-2 text-[9px] text-white"
                                    variant="outline"
                                >
                                    {dashboardUsers['invites'].length}
                                </Badge>
                            </TabsTrigger>
                        </TabsList>
                        <ScheduleTestFilters
                            label="Role Type"
                            data={RoleType}
                            selectedItems={selectedFilter['roles'] || []}
                            onSelectionChange={(items) => handleFilterChange('roles', items)}
                        />
                        {selectedTab === 'instituteUsers' && (
                            <ScheduleTestFilters
                                label="Status"
                                data={RoleTypeUserStatus}
                                selectedItems={selectedFilter['status'] || []}
                                onSelectionChange={(items) => handleFilterChange('status', items)}
                            />
                        )}
                        <RoleTypeFilterButtons
                            selectedQuestionPaperFilters={selectedFilter}
                            handleSubmitFilters={handleSubmitFilters}
                            handleResetFilters={handleResetFilters}
                        />
                    </div>
                    <InviteUsersComponent refetchData={handleRefetchData} />
                </div>
                {/* Scrollable Content Area */}
                <div className="max-h-[80vh] overflow-y-auto pr-8">
                    {selectedTab === 'instituteUsers' && (
                        <InstituteUsersComponent
                            selectedTab={selectedTab}
                            selectedTabData={dashboardUsers.instituteUsers}
                            refetchData={handleRefetchData}
                        />
                    )}
                    {selectedTab === 'invites' && (
                        <InviteUsersTab
                            selectedTab={selectedTab}
                            selectedTabData={dashboardUsers.invites}
                            refetchData={handleRefetchData}
                        />
                    )}
                </div>
            </Tabs>
        </LayoutContainer>
    );
}
