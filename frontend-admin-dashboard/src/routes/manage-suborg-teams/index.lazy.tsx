import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import { CustomTeamsList } from '@/routes/manage-custom-teams/-components/custom-teams-list';
import { getSelectedSubOrgId } from '@/lib/auth/facultyAccessUtils';

export const Route = createLazyFileRoute('/manage-suborg-teams/')({
    component: ManageSubOrgTeams,
});

function ManageSubOrgTeams() {
    const subOrgId = getSelectedSubOrgId();

    return (
        <LayoutContainer>
            <Helmet>
                <title>Manage Sub-Org Teams</title>
            </Helmet>
            <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Sub-Org Teams</h1>
                        <p className="text-sm text-gray-500">
                            Manage your sub-org team members. Only custom roles can be assigned;
                            members are scoped to your sub-org and not visible to other sub-orgs.
                        </p>
                    </div>
                </div>

                {!subOrgId ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">
                        <p className="font-medium">No sub-org selected.</p>
                        <p className="text-sm">
                            Pick a sub-org from the sidebar before managing team members.
                        </p>
                    </div>
                ) : (
                    <CustomTeamsList mode="subOrg" subOrgId={subOrgId} />
                )}
            </div>
        </LayoutContainer>
    );
}
