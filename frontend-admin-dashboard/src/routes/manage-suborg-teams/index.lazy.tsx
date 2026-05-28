import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import {
    getSelectedSubOrgId,
    isCallerSubOrgAdmin,
    setSelectedSubOrgId,
} from '@/lib/auth/facultyAccessUtils';
import { listAccessibleSubOrgs } from '@/routes/manage-custom-teams/-services/custom-team-services';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { MyDropdown } from '@/components/design-system/dropdown';
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
 * Sub-org-admin route. Lists the caller's accessible sub-orgs and mounts the
 * analytics panel in restricted (admin-payment + team) mode for the selected
 * one. Institute admins reach the same analytics surface via
 * /manage-custom-teams/sub-orgs/$subOrgSlug instead.
 *
 * Why the picker is back:
 *   - A single sub-org admin can hold FSPSSM entries against multiple sub-orgs
 *     (e.g. principal of two campuses under the same parent institute). Without
 *     a picker they were stuck on subOrgs[0] with no way to switch.
 *   - Initial selection prefers the persisted `selected_suborg_id` (so deep
 *     refresh keeps the same context as the sidebar), falling back to the first
 *     accessible sub-org.
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

    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Pick an initial sub-org once the list resolves: persisted choice if it's
    // still valid (so sidebar branding and this page stay in sync), otherwise
    // the first accessible sub-org.
    useEffect(() => {
        if (subOrgs.length === 0) {
            setSelectedId(null);
            return;
        }
        if (selectedId && subOrgs.some((s) => s.id === selectedId)) return;
        const persisted = getSelectedSubOrgId();
        const initial =
            (persisted && subOrgs.find((s) => s.id === persisted)?.id) || subOrgs[0]!.id;
        setSelectedId(initial);
    }, [subOrgs, selectedId]);

    const selectedSubOrg = useMemo(
        () => subOrgs.find((s) => s.id === selectedId) || null,
        [subOrgs, selectedId]
    );

    // Only persist the selected sub-org for actual sub-org admins. Institute admins
    // hitting this route accidentally (the backend's listAccessibleSubOrgs returns
    // ALL sub-orgs for them, not just FSPSSM matches) would otherwise poison the
    // localStorage key and flip sidebar branding across the whole app.
    useEffect(() => {
        if (selectedSubOrg?.id && isCallerSubOrgAdmin()) {
            setSelectedSubOrgId(selectedSubOrg.id);
        }
    }, [selectedSubOrg?.id]);

    const dropdownList = useMemo(
        () => subOrgs.map((s) => ({ label: s.name, value: s.id })),
        [subOrgs]
    );

    return (
        <LayoutContainer>
            <Helmet>
                <title>
                    {selectedSubOrg ? `${selectedSubOrg.name} — Sub-Org` : 'Sub-Org'}
                </title>
            </Helmet>
            <div className="p-6">
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-h2 font-bold text-neutral-900">
                            {selectedSubOrg?.name || 'Sub-Org'}
                        </h1>
                        <p className="text-caption text-neutral-500">
                            Your sub-org&apos;s payments, learners and team. The ledger
                            is read-only — the parent institute admin manages installments
                            and discounts.
                        </p>
                    </div>
                    {subOrgs.length > 1 && (
                        <div className="flex flex-col gap-1">
                            <span className="text-caption text-neutral-500">
                                Switch sub-org
                            </span>
                            <MyDropdown
                                dropdownList={dropdownList}
                                currentValue={selectedSubOrg?.name || ''}
                                placeholder="Select sub-org"
                                handleChange={(value: string) => setSelectedId(value)}
                                className="min-w-[220px]"
                            />
                        </div>
                    )}
                </div>

                {isLoading ? (
                    <DashboardLoader />
                ) : !selectedSubOrg ? (
                    <div className="rounded-lg border border-warning-200 bg-warning-50 p-6 text-warning-800">
                        <p className="font-medium">No sub-org access.</p>
                        <p className="text-caption">
                            Ask your institute admin to grant you sub-org admin access.
                        </p>
                    </div>
                ) : (
                    <SubOrgAnalyticsPanel
                        key={selectedSubOrg.id}
                        subOrgId={selectedSubOrg.id}
                        subOrgName={selectedSubOrg.name}
                        restrictedView
                    />
                )}
            </div>
        </LayoutContainer>
    );
}
