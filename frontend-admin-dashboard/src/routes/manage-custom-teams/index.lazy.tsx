import { useState } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SubOrgList } from './sub-orgs/-components/sub-org-list';
import { RegistrationLinksTab } from './sub-orgs/-components/registration-links-tab';

export const Route = createLazyFileRoute('/manage-custom-teams/')({
    component: ManageCustomTeams,
});

const TABS = [
    { value: 'subOrgs', label: 'Sub-Orgs' },
    { value: 'registrationLinks', label: 'Registration Links' },
] as const;

function ManageCustomTeams() {
    const [selectedTab, setSelectedTab] = useState<string>('subOrgs');

    return (
        <LayoutContainer>
            <Helmet>
                <title>Manage Custom Teams</title>
            </Helmet>
            <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Manage Custom Teams</h1>
                        <p className="text-sm text-gray-500">Manage sub-organizations.</p>
                    </div>
                </div>

                <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                    <TabsList className="mb-4 inline-flex h-auto justify-start gap-4 rounded-none border-b !bg-transparent p-0">
                        {TABS.map((tab) => (
                            <TabsTrigger
                                key={tab.value}
                                value={tab.value}
                                className={`flex gap-1.5 rounded-none px-12 py-2 !shadow-none ${
                                    selectedTab === tab.value
                                        ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                                        : 'border-none bg-transparent'
                                }`}
                            >
                                <span
                                    className={selectedTab === tab.value ? 'text-primary-500' : ''}
                                >
                                    {tab.label}
                                </span>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    <TabsContent value="subOrgs">
                        <SubOrgList />
                    </TabsContent>
                    <TabsContent value="registrationLinks">
                        <RegistrationLinksTab />
                    </TabsContent>
                </Tabs>
            </div>
        </LayoutContainer>
    );
}
