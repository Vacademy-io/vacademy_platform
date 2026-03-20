import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CustomTeamsList } from './-components/custom-teams-list';
import { SubOrgList } from './sub-orgs/-components/sub-org-list';

export const Route = createLazyFileRoute('/manage-custom-teams/')({
    component: ManageCustomTeams,
});

function ManageCustomTeams() {
    const [activeTab, setActiveTab] = useState('members');

    return (
        <LayoutContainer>
            <Helmet>
                <title>Manage Custom Teams</title>
            </Helmet>
            <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Manage Custom Teams</h1>
                        <p className="text-sm text-gray-500">
                            Manage faculty members, custom roles, and sub-organizations.
                        </p>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="mb-4">
                        <TabsTrigger value="members">Team Members</TabsTrigger>
                        <TabsTrigger value="sub-orgs">Sub-Organizations</TabsTrigger>
                    </TabsList>

                    <TabsContent value="members">
                        <CustomTeamsList />
                    </TabsContent>

                    <TabsContent value="sub-orgs">
                        <SubOrgList />
                    </TabsContent>
                </Tabs>
            </div>
        </LayoutContainer>
    );
}
