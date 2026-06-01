import { createLazyFileRoute, useNavigate, useParams, Link } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ArrowsClockwise, PencilSimple } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { MyButton } from '@/components/design-system/button';
import { getSubOrgs, resyncSubOrgInvites } from '../-services/custom-team-services';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { SubOrgAnalyticsPanel } from '@/routes/manage-suborg-teams/-components/sub-org-analytics-panel';
import {
    buildSubOrgSlug,
    resolveSubOrgBySlug,
} from '@/routes/manage-suborg-teams/-utils/sub-org-slug';
import { InviteLinkSection } from './-components/invite-link-section';
import { EditSubOrgModal } from './-components/edit-sub-org-modal';

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
    const queryClient = useQueryClient();
    const instituteId = getCurrentInstituteId();
    const [editOpen, setEditOpen] = useState(false);

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

    const resyncMutation = useMutation({
        mutationFn: (subOrgId: string) => resyncSubOrgInvites(subOrgId),
        onSuccess: (data) => {
            toast.success(
                data.created_count > 0
                    ? `Re-synced ${data.created_count} invite(s) across ${data.package_session_count} course(s)`
                    : 'Already in sync — no new invites needed'
            );
            if (selectedSubOrg) {
                queryClient.invalidateQueries({
                    queryKey: ['sub-org-scoped-invites', selectedSubOrg.id],
                });
                queryClient.invalidateQueries({
                    queryKey: ['sub-org-subscription-status', selectedSubOrg.id],
                });
            }
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Failed to re-sync invites');
        },
    });

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
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h1 className="text-h2 font-bold text-neutral-900">
                                {selectedSubOrg?.name || 'Sub-Org'}
                            </h1>
                            <p className="text-caption text-neutral-500">
                                Manage this sub-org&apos;s admin payment, learners, invoices,
                                and team members. As parent institute admin you have full
                                edit access to the ledger.
                            </p>
                        </div>
                        {selectedSubOrg && (
                            <div className="flex shrink-0 items-center gap-2">
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    scale="small"
                                    onClick={() => setEditOpen(true)}
                                >
                                    <PencilSimple className="size-4" />
                                    Edit sub-org
                                </MyButton>
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    scale="small"
                                    disable={resyncMutation.isPending}
                                    onClick={() => resyncMutation.mutate(selectedSubOrg.id)}
                                >
                                    <ArrowsClockwise
                                        className={`size-4 ${resyncMutation.isPending ? 'animate-spin' : ''}`}
                                    />
                                    {resyncMutation.isPending ? 'Re-syncing…' : 'Re-sync invites'}
                                </MyButton>
                            </div>
                        )}
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
                    <div className="space-y-6">
                        <div className="rounded-lg border border-neutral-200 bg-white p-4">
                            <InviteLinkSection subOrgId={selectedSubOrg.id} />
                        </div>
                        {/* AddUserToSubOrgSection is now mounted INSIDE the panel's
                            Admin Payment tab (panel knows its own tab state). Previously
                            it sat at the deep-page level which made the form visible on
                            every tab — wrong context for Courses/Learners/Invoices/Team. */}
                        <SubOrgAnalyticsPanel
                            subOrgId={selectedSubOrg.id}
                            subOrgName={selectedSubOrg.name}
                        />
                    </div>
                )}
            </div>
            {selectedSubOrg && (
                <EditSubOrgModal
                    open={editOpen}
                    onOpenChange={setEditOpen}
                    subOrgId={selectedSubOrg.id}
                    subOrgName={selectedSubOrg.name}
                />
            )}
        </LayoutContainer>
    );
}

/** Re-export so callers in this folder (SubOrgList) can build the same slug. */
export { buildSubOrgSlug };
