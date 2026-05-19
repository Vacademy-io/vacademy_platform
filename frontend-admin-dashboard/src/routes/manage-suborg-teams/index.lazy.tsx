import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import { isCallerSubOrgAdmin, setSelectedSubOrgId } from '@/lib/auth/facultyAccessUtils';
import { listAccessibleSubOrgs } from '@/routes/manage-custom-teams/-services/custom-team-services';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { SubOrgAnalyticsPanel } from './-components/sub-org-analytics-panel';

export const Route = createLazyFileRoute('/manage-suborg-teams/')({
    component: ManageSubOrgTeams,
});

interface SubOrgItem {
    id: string;
    name: string;
}

function normaliseSubOrg(org: any): SubOrgItem | null {
    const id =
        org?.sub_org_id || org?.suborgId || org?.subOrgId || org?.suborg_id || org?.id;
    const name =
        org?.name || org?.institute_name || org?.instituteName || org?.subOrgName;
    if (!id) return null;
    return { id, name: name || 'Untitled Sub-Org' };
}

/**
 * Sub-org-admin route. Auto-resolves the caller's single accessible sub-org and
 * mounts the analytics panel in read-only mode. Institute admins reach the same
 * analytics surface via /manage-custom-teams/sub-orgs/$subOrgSlug instead.
 *
 * Why no picker / no slug here:
 *   - Sub-org admins typically have exactly one sub-org (their own); a picker is
 *     dead UI.
 *   - The panel already honours `readOnly` via `isCallerSubOrgAdmin()`, so we
 *     don't even need a route-level flag.
 *   - If the caller has multiple SUB_ORG-linked FSPSSM entries (unusual), we fall
 *     back to the first; a follow-on small picker can be added later if needed.
 */
function ManageSubOrgTeams() {
    const instituteId = getCurrentInstituteId();

    const { data: rawSubOrgs, isLoading } = useQuery({
        queryKey: ['sub-orgs-accessible-picker', instituteId],
        queryFn: () => listAccessibleSubOrgs(instituteId!),
        enabled: !!instituteId,
    });

    const subOrgs: SubOrgItem[] = useMemo(() => {
        const list = Array.isArray(rawSubOrgs)
            ? rawSubOrgs
            : (rawSubOrgs as any)?.content || [];
        return list.map(normaliseSubOrg).filter(Boolean) as SubOrgItem[];
    }, [rawSubOrgs]);

    const selectedSubOrg = subOrgs[0];

    // Only persist the selected sub-org for actual sub-org admins. Institute admins
    // hitting this route accidentally (the backend's listAccessibleSubOrgs returns
    // ALL sub-orgs for them, not just FSPSSM matches) would otherwise poison the
    // localStorage key and flip sidebar branding across the whole app.
    useEffect(() => {
        if (selectedSubOrg?.id && isCallerSubOrgAdmin()) {
            setSelectedSubOrgId(selectedSubOrg.id);
        }
    }, [selectedSubOrg?.id]);

    return (
        <LayoutContainer>
            <Helmet>
                <title>
                    {selectedSubOrg ? `${selectedSubOrg.name} — Sub-Org` : 'Sub-Org'}
                </title>
            </Helmet>
            <div className="p-6">
                <div className="mb-6 flex flex-col gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {selectedSubOrg?.name || 'Sub-Org'}
                        </h1>
                        <p className="text-sm text-gray-500">
                            Your sub-org&apos;s payments, learners and team. The ledger
                            is read-only — the parent institute admin manages installments
                            and discounts.
                        </p>
                    </div>
                </div>

                {isLoading ? (
                    <DashboardLoader />
                ) : !selectedSubOrg ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">
                        <p className="font-medium">No sub-org access.</p>
                        <p className="text-sm">
                            Ask your institute admin to grant you sub-org admin access.
                        </p>
                    </div>
                ) : (
                    <SubOrgAnalyticsPanel
                        subOrgId={selectedSubOrg.id}
                        subOrgName={selectedSubOrg.name}
                        restrictedView
                    />
                )}
            </div>
        </LayoutContainer>
    );
}
