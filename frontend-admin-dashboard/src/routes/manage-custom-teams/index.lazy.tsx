import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import { SubOrgList } from './sub-orgs/-components/sub-org-list';

export const Route = createLazyFileRoute('/manage-custom-teams/')({
    component: ManageCustomTeams,
});

function ManageCustomTeams() {
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
                            Manage sub-organizations.
                        </p>
                    </div>
                </div>

                <SubOrgList />
            </div>
        </LayoutContainer>
    );
}
