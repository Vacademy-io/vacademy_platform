import { createLazyFileRoute, useNavigate, useParams, Link } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowsClockwise, PencilSimple } from '@phosphor-icons/react';
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
import { SubOrgModuleGate } from '../-components/sub-org-module-gate';
import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';
import { OtherTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { subOrgPermission } from '@/lib/display-settings/sub-org-module';

export const Route = createLazyFileRoute('/manage-custom-teams/sub-orgs/$subOrgSlug')({
    component: InstituteAdminSubOrgPage,
});

interface SubOrgItem {
    id: string;
    name: string;
}

function normaliseSubOrg(org: any, fallbackLabel: string): SubOrgItem | null {
    const id =
        org?.sub_org_id || org?.suborgId || org?.subOrgId || org?.suborg_id || org?.id;
    const name =
        org?.name || org?.institute_name || org?.instituteName || org?.subOrgName;
    if (!id) return null;
    return { id, name: name || fallbackLabel };
}

/**
 * Drilldown page for a single sub-org. Reached by clicking a sub-org row in
 * /manage-custom-teams. Reuses the same SubOrgAnalyticsPanel the sub-org-admin sees;
 * for an institute admin it renders writable (caller has no SUB_ORG-linked FSPSSM, so
 * the panel's drawer treats the ledger as editable — same gate as everywhere else).
 *
 * Two kinds of caller land here:
 *   - Institute admins, who can open any sub-org under the institute and edit it.
 *   - Assignment-scoped users (a teacher / custom role granted the Sub-Organizations
 *     module from Display Settings), who reach only the sub-orgs assigned to them —
 *     getSubOrgs below already comes back scoped, so an unassigned slug simply doesn't
 *     resolve, and the backend rejects the per-sub-org calls regardless. They get the
 *     read-only view: no Edit / Re-sync, and the panel's ledger is not editable.
 *
 * Compare to /manage-suborg-teams: that route is sub-org-admin-only and auto-resolves
 * the caller's single accessible sub-org.
 */
function InstituteAdminSubOrgPage() {
    const { subOrgSlug } = useParams({
        from: '/manage-custom-teams/sub-orgs/$subOrgSlug',
    });
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const instituteId = getCurrentInstituteId();
    const [editOpen, setEditOpen] = useState(false);
    // A user who reaches this page through the Display Settings grant (rather than
    // the ADMIN role) is here to VIEW an assigned channel partner. The analytics
    // panel already renders read-only for them (canEditLedger is false once the
    // caller has SUB_ORG-linked access), so drop the two mutating header actions
    // rather than showing buttons whose effects they can't complete.
    const canEditConfig = subOrgPermission('canEditConfig');
    // Institutes rename this concept via Settings → Naming (Channel Partner,
    // Branch, Franchise, VLE …). Every label below reads from those settings.
    const term = getTerminology(OtherTerms.SubOrg, SystemTerms.SubOrg);
    const termPlural = getTerminologyPlural(OtherTerms.SubOrg, SystemTerms.SubOrg);

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
        return list
            .map((o: unknown) => normaliseSubOrg(o, `Untitled ${term}`))
            .filter(Boolean) as SubOrgItem[];
    }, [rawSubOrgs, term]);

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
            // Re-sync does two things now: mirror missing invites, and re-apply the
            // institute's naming settings to existing invite names. Report whichever
            // actually happened so a rename-only run doesn't read as "nothing to do".
            const parts: string[] = [];
            if (data.created_count > 0) {
                parts.push(
                    `Re-synced ${data.created_count} invite(s) across ${data.package_session_count} course(s)`
                );
            }
            if (data.renamed_count > 0) {
                parts.push(`renamed ${data.renamed_count} to match your naming settings`);
            }
            toast.success(parts.length > 0 ? parts.join(' · ') : 'Already in sync — no changes needed');
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
                        ? `${selectedSubOrg.name} — Manage ${termPlural}`
                        : `Manage ${termPlural}`}
                </title>
            </Helmet>
            <div className="p-6">
                <SubOrgModuleGate>
                <div className="mb-6 flex flex-col gap-3">
                    <Link
                        to="/manage-custom-teams"
                        className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="h-3 w-3" />
                        Back to {termPlural.toLowerCase()}
                    </Link>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h1 className="text-h2 font-bold text-neutral-900">
                                {selectedSubOrg?.name || term}
                            </h1>
                            <p className="text-caption text-neutral-500">
                                {canEditConfig
                                    ? `Manage this ${term.toLowerCase()}'s admin payment, learners, invoices, and team members.`
                                    : `View this ${term.toLowerCase()}'s admin payment, learners, invoices, and team members.`}
                            </p>
                        </div>
                        {selectedSubOrg && canEditConfig && (
                            <div className="flex shrink-0 items-center gap-2">
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    scale="small"
                                    onClick={() => setEditOpen(true)}
                                >
                                    <PencilSimple className="size-4" />
                                    Edit {term.toLowerCase()}
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
                            Couldn&apos;t find a {term.toLowerCase()} matching this link.
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
                </SubOrgModuleGate>
            </div>
            {selectedSubOrg && canEditConfig && (
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
