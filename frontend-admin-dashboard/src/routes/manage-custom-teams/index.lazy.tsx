import { useState } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SubOrgList } from './sub-orgs/-components/sub-org-list';
import { RegistrationLinksTab } from './sub-orgs/-components/registration-links-tab';
import { getTerminologyPlural } from '@/components/common/layout-container/sidebar/utils';
import { OtherTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { SubOrgModuleGate } from './-components/sub-org-module-gate';
import { isSubOrgAssignmentScoped } from '@/lib/display-settings/sub-org-module';

export const Route = createLazyFileRoute('/manage-custom-teams/')({
    component: ManageCustomTeams,
});

function ManageCustomTeams() {
    const [selectedTab, setSelectedTab] = useState<string>('subOrgs');

    const subOrgTermPlural = getTerminologyPlural(OtherTerms.SubOrg, SystemTerms.SubOrg);

    // Registration Links are institute-wide — the templates and the registrations
    // they collect belong to the parent institute, not to any one channel partner,
    // so there is nothing to scope them by. Assignment-scoped users (a custom /
    // teacher role granted this module) get the list tab only.
    const assignmentScoped = isSubOrgAssignmentScoped();

    const TABS = [
        { value: 'subOrgs', label: subOrgTermPlural },
        ...(assignmentScoped ? [] : [{ value: 'registrationLinks', label: 'Registration Links' }]),
    ];

    return (
        <LayoutContainer>
            <Helmet>
                <title>Manage {subOrgTermPlural}</title>
            </Helmet>
            <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Manage {subOrgTermPlural}
                        </h1>
                        <p className="text-sm text-gray-500">
                            Manage your {subOrgTermPlural.toLowerCase()}.
                        </p>
                    </div>
                </div>

                <SubOrgModuleGate>
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
                                        className={
                                            selectedTab === tab.value ? 'text-primary-500' : ''
                                        }
                                    >
                                        {tab.label}
                                    </span>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        <TabsContent value="subOrgs">
                            <SubOrgList />
                        </TabsContent>
                        {!assignmentScoped && (
                            <TabsContent value="registrationLinks">
                                <RegistrationLinksTab />
                            </TabsContent>
                        )}
                    </Tabs>
                </SubOrgModuleGate>
            </div>
        </LayoutContainer>
    );
}
