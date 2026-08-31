import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getSubOrgsWithDetails, type SubOrgListItem } from '../../-services/custom-team-services';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';
import { OtherTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { MyButton } from '@/components/design-system/button';
import { Input } from '@/components/ui/input';
import { MultiSelectFilter } from '@/components/shared/leads/multi-select-filter';
import { ManageColumnsPopover } from '@/components/shared/leads/manage-columns-popover';
import {
    useLeadColumnPrefs,
    useColumnOrderPrefs,
    orderColumnIds,
    type LeadColumnToggle,
} from '@/components/shared/leads/use-lead-column-prefs';
import {
    Plus,
    Buildings,
    CaretDown,
    CaretUp,
    CaretUpDown,
    DownloadSimple,
    MagnifyingGlass,
    X,
} from '@phosphor-icons/react';
import { buildCsv, downloadCsv } from '../../-utils/list-export';
import {
    buildSubOrgColumns,
    compareSubOrgs,
    subOrgCsvHeaders,
    subOrgCsvRows,
    DEFAULT_HIDDEN_SUB_ORG_COLUMNS,
    type SortDirection,
    type SubOrgColumn,
} from '../../-utils/sub-org-columns';
import { CreateSubOrgModal } from './create-sub-org-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { MyPagination } from '@/components/design-system/pagination';
import { toast } from 'sonner';
import { buildSubOrgSlug } from '@/routes/manage-suborg-teams/-utils/sub-org-slug';
import { humanizeStatus } from '../../-utils/status-display';
import createInviteLink from '@/routes/manage-students/invite/-utils/createInviteLink';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { subOrgPermission } from '@/lib/display-settings/sub-org-module';
import { cn } from '@/lib/utils';

/**
 * Table density. The shared ui/table defaults (px-2 header, p-2 cell) are tuned for dense
 * grids; this listing is a directory people read a row at a time, so it gets the roomier
 * padding the design calls for. `whitespace-nowrap` on the header stops "Institute Name"
 * breaking across two lines and shoving the header row taller than the data rows.
 *
 * The horizontal padding stays at px-3 rather than px-4: eleven columns already need more
 * width than a laptop gives once the sidebar is open, and the extra 8px a side pushed two
 * more columns off screen. Anything that still does not fit is reachable by scrolling the
 * table, or by switching a column off in Manage Column.
 */
const HEAD_CLASS = 'h-12 whitespace-nowrap px-3 text-sm font-medium text-neutral-600';
const CELL_CLASS = 'px-3 py-4 align-middle';

/** Default rows-per-page; the footer's selector can change it. */
const SUB_ORG_PAGE_SIZE = 10;

/** Facet key for rows whose admin has no plan yet (plan_status null). */
const NO_PLAN = '__NO_PLAN__';

/** Per-browser column layout, same keys convention as Manage Payments / submissions. */
const COLUMN_PREFS_KEY = 'sub-orgs:hidden-columns';
const COLUMN_ORDER_KEY = 'sub-orgs:column-order';

/** Distinct, sorted non-blank values of one field across the rows → filter options. */
const facetOptions = (
    rows: SubOrgListItem[],
    pick: (row: SubOrgListItem) => string | null | undefined
) => {
    const values = new Set<string>();
    rows.forEach((row) => {
        const v = pick(row)?.trim();
        if (v) values.add(v);
    });
    return [...values].sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value }));
};

/**
 * A filter control under its own label. MultiSelectFilter renders its own trigger, so the
 * label is a plain <p> rather than a <label htmlFor> — there is no single form control to
 * point at, and a label pointing nowhere is worse than none for a screen reader.
 */
function FilterField({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <p className="mb-1 text-xs font-medium text-neutral-600">{label}</p>
            {children}
        </div>
    );
}

/**
 * Placeholder rows while the list loads. Replaces a full-page spinner: the toolbar and the
 * column headers are already known, so blanking the whole screen (and then reflowing it)
 * costs more than it communicates.
 */
function SkeletonRows({ columns }: { columns: number }) {
    return (
        <>
            {Array.from({ length: 5 }, (_, row) => (
                <TableRow key={row}>
                    {Array.from({ length: columns }, (_, col) => (
                        <TableCell key={col}>
                            <Skeleton className="h-4 w-full" />
                        </TableCell>
                    ))}
                </TableRow>
            ))}
        </>
    );
}

export function SubOrgList() {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    const [cityFilter, setCityFilter] = useState<string[]>([]);
    const [stateFilter, setStateFilter] = useState<string[]>([]);
    /** Free text, matched as a prefix — typing "20" narrows to the 20xxxx pincodes. */
    const [pincodeFilter, setPincodeFilter] = useState('');
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(SUB_ORG_PAGE_SIZE);
    /** Ties the search label to its input; useId keeps it unique if the list ever repeats. */
    const searchId = useId();
    /** Which column the table is ordered by; null = the backend's newest-first order. */
    const [sort, setSort] = useState<{ id: string; direction: SortDirection } | null>(null);
    const navigate = useNavigate();

    const instituteId = getCurrentInstituteId();
    // Creating a channel partner is an institute-level action, not something scoped
    // to the ones assigned to you — hide it for roles granted the module via
    // Display Settings. The rows themselves are already scoped by the backend.
    // Per-role capabilities (institute admins and sub-org admins always pass).
    const canCreate = subOrgPermission('canCreate');
    const canExport = subOrgPermission('canExport');
    // Prefer the institute's white-label learner domain so the invite opens on
    // the institute's own portal; a backend `short_url` (already domain-correct)
    // still wins when present.
    const { instituteDetails } = useInstituteDetailsStore();
    // Fetch the WHOLE list (no page/size): search matches admin email/phone and the
    // status filter matches plan status — enrichment fields that live outside this
    // service's DB, so filtering must happen over the full dataset client-side.
    // "Whole list" is caller-scoped: the backend returns only the sub-orgs assigned
    // to the caller unless they're a root user or a true institute admin, so every
    // filter, facet, page and export below is confined to the assigned set.
    const { data, isLoading, isError, error } = useQuery({
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

    // City/State options come from the loaded rows (address stamped on the spawned
    // institute at registration) — a filter only appears when values exist. Address and
    // pincode deliberately get no facet: both are near-unique per row, so every option
    // would match exactly one VLE. Free-text search and the pincode box cover them.
    const cityOptions = useMemo(() => facetOptions(allSubOrgs, (o) => o.city), [allSubOrgs]);
    const stateOptions = useMemo(() => facetOptions(allSubOrgs, (o) => o.state), [allSubOrgs]);

    const q = searchInput.trim().toLowerCase();
    const filteredSubOrgs = useMemo(
        () =>
            allSubOrgs.filter((o) => {
                if (statusFilter.length) {
                    const key = o.plan_status || NO_PLAN;
                    if (!statusFilter.includes(key)) return false;
                }
                if (cityFilter.length && !cityFilter.includes(o.city?.trim() || '')) return false;
                if (stateFilter.length && !stateFilter.includes(o.state?.trim() || ''))
                    return false;
                const pin = pincodeFilter.trim();
                if (pin && !(o.pincode?.trim() || '').startsWith(pin)) return false;
                if (q) {
                    const haystack = [
                        o.name,
                        o.admin_name,
                        o.admin_email,
                        o.admin_phone,
                        o.address_line,
                        o.city,
                        o.state,
                        o.pincode,
                        o.invite_code,
                    ]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase();
                    if (!haystack.includes(q)) return false;
                }
                return true;
            }),
        [allSubOrgs, q, statusFilter, cityFilter, stateFilter, pincodeFilter]
    );
    const hasActiveFilters =
        !!q ||
        statusFilter.length > 0 ||
        cityFilter.length > 0 ||
        stateFilter.length > 0 ||
        pincodeFilter.trim().length > 0;

    // Any filter change jumps back to the first page.
    useEffect(() => {
        setPage(0);
    }, [q, statusFilter, cityFilter, stateFilter, pincodeFilter]);

    // Row click navigates to the institute-admin deep page for that sub-org.
    const openSubOrg = useCallback(
        (org: SubOrgListItem) => {
            const id = org.suborg_id;
            if (!id) return;
            navigate({
                to: '/manage-custom-teams/sub-orgs/$subOrgSlug',
                params: { subOrgSlug: buildSubOrgSlug({ id, name: org.name || '' }) },
            });
        },
        [navigate]
    );

    // Full invite URL for a row: backend short_url when present, otherwise built
    // from the invite code (never the bare code — that's not a usable link).
    const buildInviteUrl = useCallback(
        (org: SubOrgListItem): string =>
            org.short_url ||
            (org.invite_code
                ? createInviteLink(org.invite_code, instituteDetails?.learner_portal_base_url)
                : ''),
        [instituteDetails?.learner_portal_base_url]
    );

    const copyInviteLink = useCallback(
        (e: React.MouseEvent, org: SubOrgListItem) => {
            e.stopPropagation();
            const url = buildInviteUrl(org);
            if (url) {
                navigator.clipboard.writeText(url);
                toast.success('Invite link copied');
            }
        },
        [buildInviteUrl]
    );

    // Column layout, remembered per browser: which columns are on, and their order.
    const { hiddenColumns, toggleColumn, resetColumns } = useLeadColumnPrefs(
        COLUMN_PREFS_KEY,
        DEFAULT_HIDDEN_SUB_ORG_COLUMNS
    );
    const { columnOrder, setColumnOrder, resetColumnOrder } = useColumnOrderPrefs(COLUMN_ORDER_KEY);

    /** Every column this table can render, in their natural order. */
    const naturalColumns = useMemo<SubOrgColumn[]>(
        () =>
            buildSubOrgColumns({
                inviteTerm: getTerminology(OtherTerms.Invite, SystemTerms.Invite),
                buildInviteUrl,
                copyInviteLink,
                openSubOrg,
            }),
        [buildInviteUrl, copyInviteLink, openSubOrg]
    );

    /** Natural ids reconciled against the saved order — the on-screen left-to-right order. */
    const orderedColumns = useMemo(() => {
        const byId = new Map(naturalColumns.map((c) => [c.id, c]));
        return orderColumnIds([...byId.keys()], columnOrder)
            .map((id) => byId.get(id))
            .filter((c): c is SubOrgColumn => !!c);
    }, [naturalColumns, columnOrder]);

    // The popover lists every column (locked ones included, so they can still be dragged);
    // the table and the CSV render only the ones left visible.
    const columnToggles = useMemo<LeadColumnToggle[]>(
        () => orderedColumns.map(({ id, label, locked }) => ({ id, label, locked })),
        [orderedColumns]
    );
    const visibleColumns = useMemo(
        () => orderedColumns.filter((c) => c.locked || !hiddenColumns.has(c.id)),
        [orderedColumns, hiddenColumns]
    );

    /**
     * Rows in the order the table shows them. Sorting is client-side like every other filter
     * on this screen — the whole caller-scoped list is already in memory, and the sortable
     * fields include enrichment (plan status, seats, learner count) that the backend query
     * cannot ORDER BY anyway.
     */
    const sortedSubOrgs = useMemo(() => {
        if (!sort) return filteredSubOrgs;
        const column = naturalColumns.find((c) => c.id === sort.id);
        if (!column?.sortValue) return filteredSubOrgs;
        // Copy first: Array.prototype.sort mutates, and filteredSubOrgs is a memo other
        // derivations (the stat cards, the export) read.
        return [...filteredSubOrgs].sort(compareSubOrgs(column, sort.direction));
    }, [filteredSubOrgs, naturalColumns, sort]);

    const totalPages = Math.max(1, Math.ceil(sortedSubOrgs.length / pageSize));
    const firstRowIndex = page * pageSize;
    const subOrgs = sortedSubOrgs.slice(firstRowIndex, firstRowIndex + pageSize);

    /**
     * Header click cycles ascending → descending → back to the default order, so the third
     * click is an undo rather than a state the admin can only escape by reloading.
     */
    const toggleSort = (id: string) => {
        setPage(0);
        setSort((prev) => {
            if (prev?.id !== id) return { id, direction: 'asc' };
            if (prev.direction === 'asc') return { id, direction: 'desc' };
            return null;
        });
    };

    /** "Reset" restores both halves of the layout — hidden columns and order. */
    const handleResetColumns = () => {
        resetColumns();
        resetColumnOrder();
    };

    /**
     * Export every row matching the current filters (all pages, not just the visible one),
     * with exactly the columns the table is showing, in the order it is showing them — so
     * what an admin arranged on screen is what lands in the spreadsheet.
     */
    const handleExport = () => {
        if (filteredSubOrgs.length === 0) {
            toast.info('Nothing to export.');
            return;
        }
        const csv = buildCsv(
            subOrgCsvHeaders(visibleColumns),
            subOrgCsvRows(visibleColumns, filteredSubOrgs)
        );
        const safeName = getTerminologyPlural(OtherTerms.SubOrg, SystemTerms.SubOrg).replace(
            /[^\w.-]+/g,
            '_'
        );
        downloadCsv(csv, `${safeName}_list.csv`);
        toast.success(
            `Exported ${filteredSubOrgs.length} ${
                filteredSubOrgs.length === 1
                    ? getTerminology(OtherTerms.SubOrg, SystemTerms.SubOrg).toLowerCase()
                    : getTerminologyPlural(OtherTerms.SubOrg, SystemTerms.SubOrg).toLowerCase()
            }.`
        );
    };

    // A failed fetch must NOT fall through to the empty table. React Query leaves `data`
    // undefined on error, which previously rendered "No <partners> found." — telling an
    // admin their institute has none when the real cause was a 403 (role not permitted,
    // or a backend that predates assignment scoping). Two very different problems that
    // looked identical, so the error is surfaced explicitly.
    if (isError) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        return (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-danger-200 bg-danger-50 p-8 text-center">
                <Buildings className="size-8 text-danger-400" />
                <p className="text-subtitle font-semibold text-danger-700">
                    Couldn&apos;t load{' '}
                    {getTerminologyPlural(OtherTerms.SubOrg, SystemTerms.SubOrg).toLowerCase()}
                </p>
                <p className="text-caption text-danger-600">
                    {status === 403
                        ? 'Your role does not have access to this data. Ask an institute admin to check the Display Settings for your role.'
                        : 'Something went wrong fetching the list. Please retry in a moment.'}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/*
              Filters and actions share one row, as the design has them. Fitting all six
              inside ~1140px is tight, so each control is sized to its own longest label
              rather than padded: the City select drops its pin icon (it was pushing "All
              Cities" into an ellipsis at this width) and the search sits at w-40. Squeezing
              further truncates labels; giving more forces the actions onto a second line
              with a wide empty band beside them, which is what this row used to do.
            */}
            <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-end gap-x-1.5 gap-y-2 p-3">
                    {/*
                      The search is the one elastic control: it takes the width the fixed
                      filters and the action buttons leave over (min-w-32 so it can never
                      collapse to just its icon, max-w-52 so it does not sprawl on a wide
                      screen). That absorbs the ~20px shortfall that was tipping the whole
                      row onto a second line on a laptop.

                      No visible label in the design, so the box carries an aria-label — a
                      placeholder alone leaves the field nameless to a screen reader.
                    */}
                    <div className="relative w-full min-w-32 sm:w-auto sm:max-w-52 sm:flex-1">
                        <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                        <Input
                            id={searchId}
                            aria-label="Search"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search by name, email or phone"
                            className="h-10 pl-8"
                        />
                    </div>
                    {statusOptions.length > 0 && (
                        <FilterField label="Status">
                            <MultiSelectFilter
                                label="All Status"
                                showSelectedLabel
                                options={statusOptions}
                                selected={statusFilter}
                                onChange={setStatusFilter}
                                placeholder="Search status…"
                                widthClass="w-28"
                            />
                        </FilterField>
                    )}
                    {cityOptions.length > 0 && (
                        <FilterField label="City">
                            <MultiSelectFilter
                                label="All Cities"
                                showSelectedLabel
                                options={cityOptions}
                                selected={cityFilter}
                                onChange={setCityFilter}
                                placeholder="Search city…"
                                widthClass="w-28"
                            />
                        </FilterField>
                    )}
                    {stateOptions.length > 0 && (
                        <FilterField label="State">
                            <MultiSelectFilter
                                label="All States"
                                showSelectedLabel
                                options={stateOptions}
                                selected={stateFilter}
                                onChange={setStateFilter}
                                placeholder="Search state…"
                                widthClass="w-28"
                            />
                        </FilterField>
                    )}
                    <FilterField label="Pincode">
                        <Input
                            aria-label="Pincode"
                            value={pincodeFilter}
                            onChange={(e) => setPincodeFilter(e.target.value)}
                            placeholder="110001"
                            inputMode="numeric"
                            className="h-10 w-24"
                        />
                    </FilterField>
                    {hasActiveFilters && (
                        <MyButton
                            buttonType="secondary"
                            scale="small"
                            onClick={() => {
                                setSearchInput('');
                                setStatusFilter([]);
                                setCityFilter([]);
                                setStateFilter([]);
                                setPincodeFilter('');
                            }}
                        >
                            <X className="mr-1 size-3.5" />
                            Clear
                        </MyButton>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                        <ManageColumnsPopover
                            columns={columnToggles}
                            hiddenColumns={hiddenColumns}
                            onToggle={toggleColumn}
                            onReset={handleResetColumns}
                            onReorder={setColumnOrder}
                        />
                        {canExport && (
                            <MyButton
                                buttonType="secondary"
                                onClick={handleExport}
                                disable={filteredSubOrgs.length === 0}
                            >
                                <DownloadSimple className="mr-2 size-4" />
                                Export CSV
                            </MyButton>
                        )}
                        {canCreate && (
                            <MyButton onClick={() => setIsCreateModalOpen(true)}>
                                <Plus className="mr-2 size-4" />
                                Create {getTerminology(OtherTerms.SubOrg, SystemTerms.SubOrg)}
                            </MyButton>
                        )}
                    </div>
                </div>

                {hasActiveFilters && (
                    <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                        {filteredSubOrgs.length} of {allSubOrgs.length}{' '}
                        {getTerminologyPlural(OtherTerms.SubOrg, SystemTerms.SubOrg).toLowerCase()}{' '}
                        match your filters
                    </p>
                )}

                <div className="border-t">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {visibleColumns.map((c) => {
                                    const active = sort?.id === c.id;
                                    if (!c.sortValue) {
                                        return (
                                            <TableHead key={c.id} className={HEAD_CLASS}>
                                                {c.label}
                                            </TableHead>
                                        );
                                    }
                                    return (
                                        <TableHead
                                            key={c.id}
                                            className={HEAD_CLASS}
                                            // Announces the direction to screen readers, which
                                            // otherwise get no hint that the order changed.
                                            aria-sort={
                                                active
                                                    ? sort.direction === 'asc'
                                                        ? 'ascending'
                                                        : 'descending'
                                                    : 'none'
                                            }
                                        >
                                            <button
                                                type="button"
                                                onClick={() => toggleSort(c.id)}
                                                className="-mx-2 flex items-center gap-1 rounded-sm px-2 py-1 text-left transition-colors hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                                                // The visible text is just the column name, which
                                                // does not say the control sorts. The label keeps
                                                // that visible text inside it, so voice control
                                                // ("click Name") still targets the right button.
                                                aria-label={`Sort by ${c.label}`}
                                                title={`Sort by ${c.label}`}
                                            >
                                                {c.label}
                                                {!active && (
                                                    <CaretUpDown
                                                        className="size-3.5 text-neutral-400"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                                {active && sort.direction === 'asc' && (
                                                    <CaretUp
                                                        className="size-3.5 text-primary-500"
                                                        weight="bold"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                                {active && sort.direction === 'desc' && (
                                                    <CaretDown
                                                        className="size-3.5 text-primary-500"
                                                        weight="bold"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                            </button>
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <SkeletonRows columns={visibleColumns.length} />
                            ) : !subOrgs || subOrgs.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={visibleColumns.length}
                                        className="h-24 text-center"
                                    >
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
                                subOrgs.map((org) => (
                                    <TableRow
                                        key={org.suborg_id || org.name || 'Unknown'}
                                        // Click-anywhere is a mouse affordance only; the row keeps
                                        // its native `row` semantics and the keyboard route in is
                                        // the name button inside the first cell. Overriding this
                                        // <tr> with role="button" would buy keyboard access at the
                                        // cost of the row no longer being announced as a row.
                                        onClick={() => openSubOrg(org)}
                                        className="cursor-pointer transition-colors focus-within:bg-muted/50 hover:bg-muted/50"
                                    >
                                        {visibleColumns.map((c) => (
                                            <TableCell
                                                key={c.id}
                                                className={cn(CELL_CLASS, c.cellClassName)}
                                            >
                                                {c.cell(org)}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {!isLoading && sortedSubOrgs.length > 0 && (
                    // MyPagination already renders "Showing 1 to 10 of 16 entries" plus the
                    // per-page selector when given totalElements/pageSize — no need to
                    // hand-roll a second footer next to it.
                    <MyPagination
                        currentPage={page}
                        totalPages={totalPages}
                        onPageChange={setPage}
                        totalElements={sortedSubOrgs.length}
                        pageSize={pageSize}
                        onPageSizeChange={(size) => {
                            setPageSize(size);
                            // Page 3 of 10-per-page does not exist at 100-per-page.
                            setPage(0);
                        }}
                    />
                )}
            </div>

            {canCreate && (
                <CreateSubOrgModal open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} />
            )}
        </div>
    );
}
