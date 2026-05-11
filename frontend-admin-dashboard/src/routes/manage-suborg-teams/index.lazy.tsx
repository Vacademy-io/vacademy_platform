import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import { CustomTeamsList } from '@/routes/manage-custom-teams/-components/custom-teams-list';
import {
    getSelectedSubOrgId,
    setSelectedSubOrgId,
} from '@/lib/auth/facultyAccessUtils';
import { listAccessibleSubOrgs } from '@/routes/manage-custom-teams/-services/custom-team-services';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Building2 } from 'lucide-react';

// @ts-expect-error — routeTree.gen.ts hasn't been regenerated yet for this new route;
// the next dev/build run with the TanStack Router Vite plugin will pick it up.
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

function ManageSubOrgTeams() {
    const instituteId = getCurrentInstituteId();
    const [selectedId, setSelectedId] = useState<string | null>(() => getSelectedSubOrgId());

    const { data: rawSubOrgs, isLoading } = useQuery({
        queryKey: ['sub-orgs-accessible-picker', instituteId],
        queryFn: () => listAccessibleSubOrgs(instituteId),
        enabled: !!instituteId,
    });

    const subOrgs: SubOrgItem[] = useMemo(() => {
        const list = Array.isArray(rawSubOrgs)
            ? rawSubOrgs
            : (rawSubOrgs as any)?.content || [];
        return list.map(normaliseSubOrg).filter(Boolean) as SubOrgItem[];
    }, [rawSubOrgs]);

    // Auto-select the only sub-org (or the first one) once the list loads,
    // if nothing is already selected, or if the previous selection is no longer accessible.
    useEffect(() => {
        if (!subOrgs.length) return;
        if (selectedId && subOrgs.some((s) => s.id === selectedId)) return;
        const first = subOrgs[0];
        if (!first) return;
        setSelectedId(first.id);
        setSelectedSubOrgId(first.id);
    }, [subOrgs, selectedId]);

    const selectedSubOrg = subOrgs.find((s) => s.id === selectedId);

    const handleSelect = (newId: string) => {
        setSelectedId(newId);
        setSelectedSubOrgId(newId);
    };

    return (
        <LayoutContainer>
            <Helmet>
                <title>Manage Sub-Org Teams</title>
            </Helmet>
            <div className="p-6">
                <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Sub-Org Teams
                            {selectedSubOrg && (
                                <span className="ml-2 text-gray-500 font-normal">
                                    — {selectedSubOrg.name}
                                </span>
                            )}
                        </h1>
                        <p className="text-sm text-gray-500">
                            Manage your sub-org team members. Only custom roles can be
                            assigned; members are scoped to the selected sub-org.
                        </p>
                    </div>

                    {subOrgs.length > 1 && (
                        <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-gray-400" />
                            <Select
                                value={selectedId ?? ''}
                                onValueChange={handleSelect}
                            >
                                <SelectTrigger className="min-w-[240px]">
                                    <SelectValue placeholder="Pick a sub-org" />
                                </SelectTrigger>
                                <SelectContent>
                                    {subOrgs.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                {isLoading ? (
                    <DashboardLoader />
                ) : subOrgs.length === 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">
                        <p className="font-medium">No sub-orgs found.</p>
                        <p className="text-sm">
                            Create a sub-org from <strong>Manage Sub Org</strong> before
                            using this page.
                        </p>
                    </div>
                ) : !selectedId ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">
                        <p className="font-medium">Pick a sub-org to continue.</p>
                    </div>
                ) : (
                    <CustomTeamsList mode="subOrg" subOrgId={selectedId} />
                )}
            </div>
        </LayoutContainer>
    );
}
