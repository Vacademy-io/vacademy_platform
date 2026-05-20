import { createLazyFileRoute, useNavigate, useParams, Link } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { getSubOrgs } from '../-services/custom-team-services';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { SubOrgAnalyticsPanel } from '@/routes/manage-suborg-teams/-components/sub-org-analytics-panel';
import {
    buildSubOrgSlug,
    resolveSubOrgBySlug,
} from '@/routes/manage-suborg-teams/-utils/sub-org-slug';

export const Route = createLazyFileRoute('/manage-custom-teams/sub-orgs/$subOrgSlug')({
    component: InstituteAdminSubOrgPage,
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
 * Institute-admin drilldown page for a single sub-org. Reached by clicking a sub-org
 * row in /manage-custom-teams. Reuses the same SubOrgAnalyticsPanel the sub-org-admin
 * sees, but in a writable context (caller has no SUB_ORG-linked FSPSSM, so the panel's
 * drawer treats the ledger as editable — same gate as everywhere else).
 *
 * Compare to /manage-suborg-teams: that route is sub-org-admin-only, auto-resolves
 * the caller's single accessible sub-org, and is read-only. This route lists *every*
 * sub-org under the institute and lets the parent admin pick any.
 */
function InstituteAdminSubOrgPage() {
    const { subOrgSlug } = useParams({
        from: '/manage-custom-teams/sub-orgs/$subOrgSlug',
    });
    const navigate = useNavigate();
    const instituteId = getCurrentInstituteId();

    // Institute admin sees the canonical institute-wide sub-org list (not the
    // FSPSSM-scoped "accessible" set used on /manage-suborg-teams).
    const { data: rawSubOrgs, isLoading } = useQuery({
        queryKey: ['sub-orgs-list', instituteId],
        queryFn: () => getSubOrgs(instituteId),
        enabled: !!instituteId,
    });

    const subOrgs: SubOrgItem[] = useMemo(() => {
        const list = Array.isArray(rawSubOrgs)
            ? rawSubOrgs
            : (rawSubOrgs as any)?.content || [];
        return list.map(normaliseSubOrg).filter(Boolean) as SubOrgItem[];
    }, [rawSubOrgs]);

    const selectedSubOrg = useMemo(
        () => resolveSubOrgBySlug(subOrgSlug, subOrgs),
        [subOrgSlug, subOrgs]
    );

    // NOTE: deliberately do NOT call setSelectedSubOrgId here. Institute admins
    // don't have FSPSSM access to the sub-org they're *viewing*, and writing the
    // id to localStorage would flip the sidebar branding to that sub-org across
    // the whole app — even after navigating away. The validated getter in
    // facultyAccessUtils will reject this id anyway (it's not in their subOrgs[]),
    // so the only effect of writing it would be visual breakage on /dashboard.

    // Stale slug → bounce back to the sub-orgs list instead of leaving a blank page.
    useEffect(() => {
        if (isLoading) return;
        if (subOrgs.length > 0 && !selectedSubOrg) {
            navigate({ to: '/manage-custom-teams', replace: true });
        }
    }, [isLoading, subOrgs.length, selectedSubOrg, navigate]);

    return (
        <LayoutContainer>
            <Helmet>
                <title>
                    {selectedSubOrg
                        ? `${selectedSubOrg.name} — Manage Custom Teams`
                        : 'Manage Custom Teams'}
                </title>
            </Helmet>
            <div className="p-6">
                <div className="mb-6 flex flex-col gap-3">
                    <Link
                        to="/manage-custom-teams"
                        className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="h-3 w-3" />
                        Back to sub-orgs
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {selectedSubOrg?.name || 'Sub-Org'}
                        </h1>
                        <p className="text-sm text-gray-500">
                            Manage this sub-org&apos;s admin payment, learners, invoices,
                            and team members. As parent institute admin you have full
                            edit access to the ledger.
                        </p>
                    </div>
                </div>

                {isLoading ? (
                    <DashboardLoader />
                ) : !selectedSubOrg ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">
                        <p className="font-medium">
                            Couldn&apos;t find a sub-org matching this link.
                        </p>
                        <p className="text-sm">Going back to the list…</p>
                    </div>
                ) : (
                    <SubOrgAnalyticsPanel
                        subOrgId={selectedSubOrg.id}
                        subOrgName={selectedSubOrg.name}
                    />
                )}
            </div>
        </LayoutContainer>
    );
}

/** Re-export so callers in this folder (SubOrgList) can build the same slug. */
export { buildSubOrgSlug };
