import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
    getSubOrgsWithDetails,
    type SubOrgListItem,
} from '../../-services/custom-team-services';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { getTerminology, getTerminologyPlural } from '@/components/common/layout-container/sidebar/utils';
import { OtherTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { MyButton } from '@/components/design-system/button';
import { Input } from '@/components/ui/input';
import { MultiSelectFilter } from '@/components/shared/leads/multi-select-filter';
import { Plus, Buildings, Copy, LinkSimple, MagnifyingGlass, X } from '@phosphor-icons/react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CreateSubOrgModal } from './create-sub-org-modal';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { MyPagination } from '@/components/design-system/pagination';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { buildSubOrgSlug } from '@/routes/manage-suborg-teams/-utils/sub-org-slug';
import { humanizeStatus, statusToneClass } from '../../-utils/status-display';
import createInviteLink from '@/routes/manage-students/invite/-utils/createInviteLink';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';

/** Rows-per-page for the Manage VLEs listing. */
const SUB_ORG_PAGE_SIZE = 10;

/** Facet key for rows whose admin has no plan yet (plan_status null). */
const NO_PLAN = '__NO_PLAN__';

export function SubOrgList() {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    const [page, setPage] = useState(0);
    const navigate = useNavigate();

    const instituteId = getCurrentInstituteId();
    // Prefer the institute's white-label learner domain so the invite opens on
    // the institute's own portal; a backend `short_url` (already domain-correct)
    // still wins when present.
    const { instituteDetails } = useInstituteDetailsStore();
    // Fetch the WHOLE list (no page/size): search matches admin email/phone and the
    // status filter matches plan status — enrichment fields that live outside this
    // service's DB, so filtering must happen over the full dataset client-side.
    const { data, isLoading } = useQuery({
        queryKey: ['sub-orgs-with-details', instituteId],
        queryFn: () => getSubOrgsWithDetails(instituteId),
        enabled: !!instituteId,
    });
    const allSubOrgs = useMemo(() => data?.content ?? [], [data?.content]);

    // Status filter options come from the data itself (nothing hardcoded): the
    // distinct plan statuses present, plus "No plan" only when such rows exist.
    const statusOptions = useMemo(() => {
        const present = new Set<string>();
        let hasNoPlan = false;
        allSubOrgs.forEach((o) => {
            if (o.plan_status) present.add(o.plan_status);
            else hasNoPlan = true;
        });
        const options = [...present]
            .sort()
            .map((value) => ({ value, label: humanizeStatus(value) }));
        if (hasNoPlan) options.push({ value: NO_PLAN, label: 'No plan' });
        return options;
    }, [allSubOrgs]);

    const q = searchInput.trim().toLowerCase();
    const filteredSubOrgs = useMemo(
        () =>
            allSubOrgs.filter((o) => {
                if (statusFilter.length) {
                    const key = o.plan_status || NO_PLAN;
                    if (!statusFilter.includes(key)) return false;
                }
                if (q) {
                    const haystack = [
                        o.name,
                        o.admin_name,
                        o.admin_email,
                        o.admin_phone,
                        o.invite_code,
                    ]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase();
                    if (!haystack.includes(q)) return false;
                }
                return true;
            }),
        [allSubOrgs, q, statusFilter]
    );
    const hasActiveFilters = !!q || statusFilter.length > 0;

    // Any filter change jumps back to the first page.
    useEffect(() => {
        setPage(0);
    }, [q, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredSubOrgs.length / SUB_ORG_PAGE_SIZE));
    const subOrgs = filteredSubOrgs.slice(
        page * SUB_ORG_PAGE_SIZE,
        (page + 1) * SUB_ORG_PAGE_SIZE
    );

    // Row click navigates to the institute-admin deep page for that sub-org.
    const openSubOrg = (org: SubOrgListItem) => {
        const id = org.suborg_id;
        if (!id) return;
        navigate({
            to: '/manage-custom-teams/sub-orgs/$subOrgSlug',
            params: { subOrgSlug: buildSubOrgSlug({ id, name: org.name || '' }) },
        });
    };

    // Full invite URL for a row: backend short_url when present, otherwise built
    // from the invite code (never the bare code — that's not a usable link).
    const buildInviteUrl = (org: SubOrgListItem): string =>
        org.short_url ||
        (org.invite_code
            ? createInviteLink(org.invite_code, instituteDetails?.learner_portal_base_url)
            : '');

    const copyInviteLink = (e: React.MouseEvent, org: SubOrgListItem) => {
        e.stopPropagation();
        const url = buildInviteUrl(org);
        if (url) {
            navigator.clipboard.writeText(url);
            toast.success('Invite link copied');
        }
    };

    if (isLoading) return <DashboardLoader />;

    return (
        <div className="space-y-4">
            {/* Search + Status filter left, Create button right. The status options are
                derived from the loaded rows (see statusOptions) — nothing hardcoded. */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-1 flex-wrap items-center gap-2">
                    <div className="relative min-w-0 flex-1 sm:max-w-xs">
                        <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                        <Input
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder={`Search ${getTerminology(OtherTerms.SubOrg, SystemTerms.SubOrg).toLowerCase()}, email or phone`}
                            className="h-9 pl-8"
                        />
                    </div>
                    {statusOptions.length > 0 && (
                        <MultiSelectFilter
                            label="Status"
                            options={statusOptions}
                            selected={statusFilter}
                            onChange={setStatusFilter}
                            placeholder="Search status…"
                            widthClass="w-36"
                        />
                    )}
                    {hasActiveFilters && (
                        <MyButton
                            buttonType="secondary"
                            scale="small"
                            onClick={() => {
                                setSearchInput('');
                                setStatusFilter([]);
                            }}
                        >
                            <X className="mr-1 size-3.5" />
                            Clear
                        </MyButton>
                    )}
                </div>
                <MyButton onClick={() => setIsCreateModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create {getTerminology(OtherTerms.SubOrg, SystemTerms.SubOrg)}
                </MyButton>
            </div>

            {hasActiveFilters && (
                <p className="text-xs text-muted-foreground">
                    {filteredSubOrgs.length} of {allSubOrgs.length}{' '}
                    {getTerminologyPlural(OtherTerms.SubOrg, SystemTerms.SubOrg).toLowerCase()}{' '}
                    match your filters
                </p>
            )}

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Seats</TableHead>
                            <TableHead>{getTerminology(OtherTerms.Invite, SystemTerms.Invite)}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {!subOrgs || subOrgs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    <div className="flex flex-col items-center justify-center gap-2 text-gray-500">
                                        <Buildings className="h-8 w-8 opacity-50" />
                                        <p>
                                            {hasActiveFilters
                                                ? `No ${getTerminologyPlural(
                                                      OtherTerms.SubOrg,
                                                      SystemTerms.SubOrg
                                                  ).toLowerCase()} match your filters.`
                                                : `No ${getTerminologyPlural(
                                                      OtherTerms.SubOrg,
                                                      SystemTerms.SubOrg
                                                  ).toLowerCase()} found.`}
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            subOrgs.map((org) => {
                                const name = org.name || 'Unknown';
                                return (
                                    <TableRow
                                        key={org.suborg_id || name}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => openSubOrg(org)}
                                    >
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarFallback className="text-xs">
                                                        {String(name).charAt(0).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <p className="truncate">{name}</p>
                                                    {org.admin_name && (
                                                        <p className="truncate text-xs text-muted-foreground">
                                                            {org.admin_name}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{org.admin_email || '-'}</TableCell>
                                        <TableCell>{org.admin_phone || '-'}</TableCell>
                                        <TableCell>
                                            {org.plan_status ? (
                                                <Badge
                                                    variant="outline"
                                                    className={statusToneClass(org.plan_status)}
                                                >
                                                    {humanizeStatus(org.plan_status)}
                                                </Badge>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">
                                                    -
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {org.used_seats == null && org.total_seats == null ? (
                                                <span className="text-sm text-muted-foreground">
                                                    -
                                                </span>
                                            ) : (
                                                <span className="text-sm">
                                                    {org.used_seats ?? 0}
                                                    {org.total_seats != null
                                                        ? `/${org.total_seats}`
                                                        : ''}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {org.invite_code ? (
                                                <button
                                                    type="button"
                                                    onClick={(e) => copyInviteLink(e, org)}
                                                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                                                    title={buildInviteUrl(org)}
                                                >
                                                    <LinkSimple className="h-3.5 w-3.5" />
                                                    <span className="w-20 truncate">
                                                        {org.invite_code}
                                                    </span>
                                                    <Copy className="h-3 w-3" />
                                                </button>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">
                                                    -
                                                </span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {totalPages > 1 && (
                <MyPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            )}

            <CreateSubOrgModal open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} />
        </div>
    );
}
