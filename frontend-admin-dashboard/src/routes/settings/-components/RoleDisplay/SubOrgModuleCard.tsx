/**
 * SubOrgModuleCard — per-role access to the Sub-Organizations (Channel Partners)
 * module. Rendered identically in the Admin, Teacher and Custom Role panels.
 *
 * The toggle owns two things so an admin never has to flip two switches:
 *   1. `subOrganizations.moduleEnabled` — the gate read by the sidebar filter and
 *      the /manage-custom-teams route.
 *   2. The sidebar entry itself — "Manage Institute → Manage Institute Sub-Orgs"
 *      ships hidden by default, so enabling the module also un-hides that
 *      sub-item (and its parent tab) in this role's sidebar config.
 *
 * Below the toggle it also owns the ROLE-LEVEL assignment: the channel partners
 * every holder of this role can see. Assignment used to be per-person only (a
 * SUB_ORG-linked FSPSSM row created from a partner's Team tab), which meant wiring
 * up each member of a regional team by hand and redoing it for every new joiner.
 * The two mechanisms UNION server-side, so per-user assignments keep working and
 * simply add on top.
 *
 * What this card never does is widen visibility beyond what it lists. The backend
 * (SubOrgAccessScopeService) re-reads this same persisted blob and scopes every
 * sub-org response to it — search, filters, pagination and totals included.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { MultiSelectFilter } from '@/components/shared/leads/multi-select-filter';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { getSubOrgsWithDetails } from '@/routes/manage-custom-teams/-services/custom-team-services';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import type { DisplaySettingsData, SubOrgModulePermissions } from '@/types/display-settings';
import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';
import { OtherTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { X } from '@phosphor-icons/react';
import {
    SUB_ORG_MODULE_SUB_ITEM_ID,
    SUB_ORG_MODULE_TAB_ID,
} from '@/lib/display-settings/sub-org-module';

interface SubOrgModuleCardProps {
    settings: DisplaySettingsData;
    onChange: (next: DisplaySettingsData) => void;
    /** 'Admin' | 'Teacher' | the custom role's name — used in the copy. */
    roleLabel: string;
    /** Admins always see every channel partner; the assignment note is hidden for them. */
    isAdminRole?: boolean;
}

/** Flip the module's sidebar tab + sub-item visibility to match the toggle. */
const applySidebarVisibility = (
    sidebar: DisplaySettingsData['sidebar'],
    enabled: boolean
): DisplaySettingsData['sidebar'] =>
    sidebar.map((tab) => {
        if (tab.id !== SUB_ORG_MODULE_TAB_ID) return tab;
        return {
            ...tab,
            // Only force the parent open. Turning the module off must not hide
            // "Manage Institute" wholesale — an admin may still want its other
            // sub-items (teams, sessions, …).
            visible: enabled ? true : tab.visible,
            subTabs: (tab.subTabs || []).map((sub) =>
                sub.id === SUB_ORG_MODULE_SUB_ITEM_ID ? { ...sub, visible: enabled } : sub
            ),
        };
    });

export const SubOrgModuleCard = ({
    settings,
    onChange,
    roleLabel,
    isAdminRole = false,
}: SubOrgModuleCardProps) => {
    // Institutes rename this concept (Channel Partner / Branch / Franchise / VLE …)
    // via Settings → Naming. Both forms are needed: the module is named in the
    // plural, but the per-record phrases below are singular.
    const term = getTerminologyPlural(OtherTerms.SubOrg, SystemTerms.SubOrg);
    const one = getTerminology(OtherTerms.SubOrg, SystemTerms.SubOrg).toLowerCase();
    const many = term.toLowerCase();
    const enabled = settings.subOrganizations?.moduleEnabled === true;
    // Memoized so the `?? []` fallback doesn't mint a new array identity on every
    // render and re-run the chip lookup below.
    const assignedIds = useMemo(
        () => settings.subOrganizations?.assignedSubOrgIds ?? [],
        [settings.subOrganizations?.assignedSubOrgIds]
    );

    // The admin configuring this is unrestricted, so this returns the institute's
    // full partner list to pick from. Only fetched once the module is on.
    const instituteId = getCurrentInstituteId();
    const { data, isLoading } = useQuery({
        queryKey: ['sub-orgs-with-details', instituteId],
        queryFn: () => getSubOrgsWithDetails(instituteId),
        enabled: !!instituteId && enabled && !isAdminRole,
    });

    const options = useMemo(
        () =>
            (data?.content ?? [])
                .filter((o) => !!o.suborg_id)
                .map((o) => ({
                    value: o.suborg_id as string,
                    label: o.name || (o.suborg_id as string),
                }))
                .sort((a, b) => a.label.localeCompare(b.label)),
        [data?.content]
    );

    // Names for the currently-selected ids, so the admin can eyeball exactly which
    // partners this role grants instead of trusting a bare count. An id that no longer
    // resolves (partner deleted, or list still loading) is shown as-is rather than
    // dropped — silently hiding a granted partner would misrepresent real access.
    const selectedChips = useMemo(() => {
        const nameById = new Map(options.map((o) => [o.value, o.label]));
        return assignedIds.map((id) => ({
            id,
            label: nameById.get(id),
            unresolved: !nameById.has(id),
        }));
    }, [assignedIds, options]);

    // Always emit the whole section so neither field is dropped on save.
    const patch = (partial: Partial<NonNullable<DisplaySettingsData['subOrganizations']>>) =>
        onChange({
            ...settings,
            subOrganizations: {
                moduleEnabled: enabled,
                assignedSubOrgIds: assignedIds,
                ...partial,
            },
            sidebar: applySidebarVisibility(settings.sidebar, partial.moduleEnabled ?? enabled),
        });

    const toggle = (next: boolean) => patch({ moduleEnabled: next });

    // Reads default ON, writes default OFF — see SubOrgModulePermissions.
    const perms = settings.subOrganizations?.permissions ?? {};
    const permValue = (k: keyof SubOrgModulePermissions) =>
        perms[k] ?? (k === 'canViewFinance' || k === 'canExport');
    const setPerm = (k: keyof SubOrgModulePermissions, v: boolean) =>
        patch({ permissions: { ...perms, [k]: v } });

    // `uiOnly` marks capabilities the server does NOT re-check. The money actions run
    // through endpoints shared with manage-students (record-offline-payment is literally
    // the same one the learner side view calls), so adding a channel-partner permission
    // check there would reject unrelated, legitimate traffic. Those toggles hide the
    // affordance only — surfaced honestly rather than implying enforcement that isn't there.
    const PERMISSIONS: {
        key: keyof SubOrgModulePermissions;
        label: string;
        hint: string;
        uiOnly?: boolean;
    }[] = [
        { key: 'canCreate', label: `Create ${many}`, hint: `Show the "Create ${one}" button.` },
        {
            key: 'canEditConfig',
            label: `Edit ${one} configuration`,
            hint: 'Edit courses, seats, validity, roles and permissions; re-sync invites.',
        },
        {
            key: 'canManageTeam',
            label: 'Manage team members',
            hint: `Add and remove people on a ${one}'s Team tab.`,
        },
        {
            key: 'canViewFinance',
            label: 'View finances',
            hint: 'See the Admin Payment and Invoices tabs.',
            uiOnly: true,
        },
        {
            key: 'canManageFinance',
            label: 'Manage finances',
            hint: 'Record payments, mark invoices paid, send reminders, raise invoices.',
            uiOnly: true,
        },
        { key: 'canExport', label: 'Export CSV', hint: `Download the ${one} list.`, uiOnly: true },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle>{term}</CardTitle>
                <CardDescription>
                    Give the {roleLabel} role access to the {term} module — the {many} list, learner
                    counts and each {one}&apos;s details.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                <div className="flex items-center justify-between gap-4 border-b border-border py-3.5">
                    <div>
                        <div className="text-sm font-medium text-neutral-800">
                            Enable {term} module
                        </div>
                        <p className="text-caption text-neutral-500">
                            Adds &quot;{term}&quot; to the sidebar and unlocks the page for this
                            role.
                        </p>
                    </div>
                    <Switch checked={enabled} onCheckedChange={toggle} />
                </div>

                {enabled && !isAdminRole && (
                    <div className="space-y-3 pt-3">
                        <div>
                            <div className="text-sm font-medium text-neutral-800">
                                {term} for this role
                            </div>
                            <p className="text-caption text-neutral-500">
                                Everyone with this role sees these — including people added to the
                                role later.
                            </p>
                        </div>

                        {isLoading ? (
                            <DashboardLoader />
                        ) : options.length === 0 ? (
                            <div className="rounded-md border border-dashed border-neutral-200 px-3 py-4 text-center text-caption text-neutral-500">
                                No {many} exist in this institute yet.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <MultiSelectFilter
                                    label={`Select ${many}`}
                                    options={options}
                                    selected={assignedIds}
                                    onChange={(values) => patch({ assignedSubOrgIds: values })}
                                    placeholder={`Search ${many}…`}
                                    widthClass="w-64"
                                />
                                {selectedChips.length === 0 ? (
                                    <p className="text-caption text-neutral-500">
                                        None selected — this role sees no {many} yet.
                                    </p>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                        {selectedChips.map((chip) => (
                                            <span
                                                key={chip.id}
                                                className={
                                                    chip.unresolved
                                                        ? 'inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-caption text-warning-700'
                                                        : 'inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-caption text-primary-700'
                                                }
                                                title={
                                                    chip.unresolved
                                                        ? `This ${one} no longer exists or is still loading (${chip.id})`
                                                        : chip.label
                                                }
                                            >
                                                {chip.label ?? `Unknown ${one}`}
                                                <button
                                                    type="button"
                                                    aria-label={`Remove ${chip.label ?? chip.id}`}
                                                    onClick={() =>
                                                        patch({
                                                            assignedSubOrgIds: assignedIds.filter(
                                                                (v) => v !== chip.id
                                                            ),
                                                        })
                                                    }
                                                    className="rounded-full hover:bg-black/10"
                                                >
                                                    <X className="size-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <p className="rounded-md bg-primary-50 px-3 py-2 text-caption text-neutral-600">
                            This role sees only the {many} listed above, plus any {one} assigned to
                            a person individually from a {one}&apos;s Team tab. Search, filters,
                            pagination and exports all stay within that set, and the list is empty
                            when nothing is assigned.
                        </p>

                        <div className="space-y-1 pt-2">
                            <div className="text-sm font-medium text-neutral-800">
                                What this role can do
                            </div>
                            <p className="text-caption text-neutral-500">
                                Everything starts read-only. Turning one off hides the action; those
                                without the &ldquo;screen only&rdquo; tag are also refused by the
                                server.
                            </p>
                            {PERMISSIONS.map((perm) => (
                                <div
                                    key={perm.key}
                                    className="flex items-center justify-between gap-4 border-b border-border py-3"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-neutral-800">
                                                {perm.label}
                                            </span>
                                            {perm.uiOnly && (
                                                <span
                                                    className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-caption text-neutral-500"
                                                    title="Hides the action on screen. Runs through endpoints shared with other pages, so it is not re-checked server-side."
                                                >
                                                    screen only
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-caption text-neutral-500">{perm.hint}</p>
                                    </div>
                                    <Switch
                                        checked={permValue(perm.key)}
                                        onCheckedChange={(v) => setPerm(perm.key, v)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {enabled && isAdminRole && (
                    <p className="rounded-md bg-primary-50 px-3 py-2 text-caption text-neutral-600">
                        Admins see every {one} in the institute.
                    </p>
                )}
            </CardContent>
        </Card>
    );
};

export default SubOrgModuleCard;
