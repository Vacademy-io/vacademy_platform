import { createLazyFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { getInstituteId } from '@/constants/helper';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
    MagnifyingGlass,
    User,
    X,
    UsersThree,
    ChatCircleText,
    ArrowsClockwise,
    Crown,
    ChartLineUp,
} from '@phosphor-icons/react';
import { CounsellorLeadsTab } from './-components/CounsellorLeadsTab';
import { CounsellorActivityTab } from './-components/CounsellorActivityTab';
import { ReassignDialog } from './-components/ReassignDialog';
import { FeatureDisabledNotice } from './-components/FeatureDisabledNotice';
import { ConversionBySourceWidget } from '@/routes/sales-dashboard/-components/ConversionBySourceWidget';
import { CallsPerDayWidget } from '@/routes/sales-dashboard/-components/CallsPerDayWidget';
import { CounsellorRatingBadge } from '@/components/counsellor/CounsellorRatingBadge';
import { useCounsellorRatingBatch } from '@/components/counsellor/useCounsellorRating';
import { getDisplaySettingsFromCache } from '@/services/display-settings';
import { ADMIN_DISPLAY_SETTINGS_KEY, TEACHER_DISPLAY_SETTINGS_KEY } from '@/types/display-settings';
import { getTokenFromCookie, getUserRoles } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import {
    fetchMyTeam,
    fetchTeamCounsellors,
    setCounsellorStatus,
    type StatusChangeResponse,
    type WorkbenchCounsellor,
    type WorkbenchLead,
} from './-services/counsellor-workbench-services';

export const Route = createLazyFileRoute('/counsellors/')({
    component: RouteComponent,
});

type DetailTab = 'leads' | 'activity' | 'performance';
type StatusFilter = 'all' | 'active' | 'inactive';

function isCounsellorsPageEnabled(): boolean {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const viewerRoles = getUserRoles(accessToken);
    const isAdmin = viewerRoles.includes('ADMIN');
    const roleKey = isAdmin ? ADMIN_DISPLAY_SETTINGS_KEY : TEACHER_DISPLAY_SETTINGS_KEY;
    const ds = getDisplaySettingsFromCache(roleKey);
    return ds?.workbench?.counsellorsPageVisible === true;
}

function RouteComponent() {
    if (!isCounsellorsPageEnabled()) {
        return (
            <FeatureDisabledNotice
                title="Counsellors page is not enabled"
                settingsLabel="Counsellor workbench"
            />
        );
    }
    return <WorkbenchPage />;
}

function WorkbenchPage() {
    const { setNavHeading } = useNavHeadingStore();
    const instituteId = getInstituteId();
    const queryClient = useQueryClient();

    useEffect(() => {
        setNavHeading('Counsellors');
    }, [setNavHeading]);

    // UI state.
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [openCounsellorId, setOpenCounsellorId] = useState<string | null>(null);
    const [detailTab, setDetailTab] = useState<DetailTab>('leads');
    const [reassignOpen, setReassignOpen] = useState(false);
    const [reassignLeads, setReassignLeads] = useState<WorkbenchLead[]>([]);
    const [reassignFromUserId, setReassignFromUserId] = useState<string | null>(null);
    const [reassignFromName, setReassignFromName] = useState<string | null>(null);

    const teamQuery = useQuery({
        queryKey: ['workbench-my-team', instituteId],
        enabled: !!instituteId,
        queryFn: () => fetchMyTeam(instituteId!),
    });

    const counsellorsQuery = useQuery({
        queryKey: ['workbench-counsellors', instituteId, teamQuery.data?.team_id],
        enabled: !!instituteId && !!teamQuery.data?.team_id,
        queryFn: () => fetchTeamCounsellors(instituteId!, teamQuery.data!.team_id),
    });

    // Warm the rating cache for every counsellor at once so the badges
    // resolve without N round-trips.
    useCounsellorRatingBatch(
        instituteId,
        counsellorsQuery.data?.map((c) => c.user_id)
    );

    const counsellors = counsellorsQuery.data ?? [];

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return counsellors.filter((c) => {
            if (statusFilter === 'active' && !c.is_active) return false;
            if (statusFilter === 'inactive' && c.is_active) return false;
            if (!q) return true;
            return (
                (c.full_name ?? '').toLowerCase().includes(q) ||
                (c.email ?? '').toLowerCase().includes(q) ||
                (c.role_label ?? '').toLowerCase().includes(q)
            );
        });
    }, [counsellors, search, statusFilter]);

    const openCounsellor = useMemo(
        () => counsellors.find((c) => c.user_id === openCounsellorId) ?? null,
        [counsellors, openCounsellorId]
    );

    // Toggle status with a confirm + open-leads handoff for INACTIVE.
    const statusMutation = useMutation({
        mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
            setCounsellorStatus(userId, instituteId!, isActive ? 'ACTIVE' : 'INACTIVE'),
        onSuccess: (resp: StatusChangeResponse, vars) => {
            queryClient.invalidateQueries({ queryKey: ['workbench-counsellors', instituteId] });
            if (!vars.isActive && resp.open_leads?.length) {
                const counsellor = counsellors.find((c) => c.user_id === vars.userId);
                setReassignFromUserId(vars.userId);
                setReassignFromName(counsellor?.full_name ?? vars.userId);
                setReassignLeads(resp.open_leads);
                setReassignOpen(true);
            } else {
                toast.success(vars.isActive ? 'Marked active' : 'Marked inactive');
            }
        },
        onError: (e) => {
            const msg = (e as { response?: { data?: { ex?: string } } })?.response?.data?.ex;
            toast.error(msg ?? 'Could not change status');
        },
    });

    function handleLeadReassign(lead: WorkbenchLead) {
        setReassignFromUserId(lead.assigned_counselor_id);
        setReassignFromName(lead.assigned_counselor_name);
        setReassignLeads([lead]);
        setReassignOpen(true);
    }

    function handleReassignComplete() {
        queryClient.invalidateQueries({ queryKey: ['workbench-counsellors', instituteId] });
        queryClient.invalidateQueries({ queryKey: ['workbench-leads', instituteId] });
    }

    if (!instituteId) return null;

    if (teamQuery.isError) {
        const msg =
            (teamQuery.error as { response?: { data?: { ex?: string } } })?.response?.data?.ex ??
            'Could not resolve your team.';
        return (
            <LayoutContainer>
                <div className="rounded border border-warning-200 bg-warning-50 p-6 text-subtitle text-warning-700">
                    {msg} Configure the leads team under{' '}
                    <a href="/settings" className="underline">
                        Settings → Lead Workbench
                    </a>{' '}
                    to get started.
                </div>
            </LayoutContainer>
        );
    }

    const activeCount = counsellors.filter((c) => c.is_active).length;
    const totalOpenLeads = counsellors.reduce((sum, c) => sum + c.open_leads_count, 0);

    return (
        <LayoutContainer>
            {/* ── Page header ────────────────────────────────────── */}
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <div className="text-caption text-neutral-500">
                        {teamQuery.data?.ancestor_names.join(' › ') || 'Leads team'}
                    </div>
                    <h1 className="text-h1 font-medium text-neutral-900">
                        {teamQuery.data?.team_name ?? 'Counsellors'}
                    </h1>
                    <p className="mt-1 text-subtitle text-neutral-500">
                        Click any card to see that person’s leads and recent activity.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <StatChip icon={UsersThree} label="Counsellors" value={counsellors.length} />
                    <StatChip icon={Crown} label="Active" value={activeCount} tone="success" />
                    <StatChip
                        icon={ChatCircleText}
                        label="Open leads"
                        value={totalOpenLeads}
                        tone="primary"
                    />
                </div>
            </div>

            {/* ── Search + filter bar ────────────────────────────── */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="relative min-w-64 flex-1 sm:flex-none">
                    <MagnifyingGlass
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                    />
                    <input
                        className="w-full rounded-md border border-neutral-300 py-2 pl-9 pr-3 text-body"
                        placeholder="Search by name or email…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex overflow-hidden rounded-md border border-neutral-300">
                    {(['all', 'active', 'inactive'] as StatusFilter[]).map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setStatusFilter(s)}
                            className={cn(
                                'px-3 py-1.5 text-caption font-medium capitalize',
                                statusFilter === s
                                    ? 'bg-primary-500 text-white'
                                    : 'bg-white text-neutral-700 hover:bg-neutral-50'
                            )}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Counsellor cards grid ──────────────────────────── */}
            {counsellorsQuery.isLoading ? (
                <div className="rounded-md border border-neutral-200 bg-white p-8 text-center text-subtitle text-neutral-500">
                    Loading counsellors…
                </div>
            ) : filtered.length === 0 ? (
                <div className="rounded-md border border-neutral-200 bg-white p-8 text-center text-subtitle text-neutral-500">
                    {counsellors.length === 0
                        ? 'No counsellors in this team yet. Add them under Manage Institute → Teams → Org Chart.'
                        : 'No one matches your filters.'}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filtered.map((c) => (
                        <CounsellorCard
                            key={c.user_id}
                            counsellor={c}
                            instituteId={instituteId}
                            onOpen={() => {
                                setOpenCounsellorId(c.user_id);
                                setDetailTab('leads');
                            }}
                            onToggleStatus={() =>
                                statusMutation.mutate({
                                    userId: c.user_id,
                                    isActive: !c.is_active,
                                })
                            }
                            statusLoading={
                                statusMutation.isPending &&
                                statusMutation.variables?.userId === c.user_id
                            }
                        />
                    ))}
                </div>
            )}

            {/* ── Detail slide-over panel ────────────────────────── */}
            {openCounsellor && (
                <DetailDrawer
                    counsellor={openCounsellor}
                    onClose={() => setOpenCounsellorId(null)}
                    tab={detailTab}
                    onTabChange={setDetailTab}
                    instituteId={instituteId}
                    onReassign={handleLeadReassign}
                />
            )}

            <ReassignDialog
                open={reassignOpen}
                onOpenChange={setReassignOpen}
                instituteId={instituteId}
                fromUserId={reassignFromUserId}
                fromUserName={reassignFromName}
                openLeads={reassignLeads}
                candidates={counsellorsQuery.data ?? []}
                onComplete={handleReassignComplete}
            />
        </LayoutContainer>
    );
}

// ─── Stat chip ────────────────────────────────────────────────

function StatChip({
    icon: Icon,
    label,
    value,
    tone = 'neutral',
}: {
    icon: typeof UsersThree;
    label: string;
    value: number;
    tone?: 'neutral' | 'primary' | 'success';
}) {
    const toneClass =
        tone === 'primary'
            ? 'bg-primary-50 text-primary-700'
            : tone === 'success'
            ? 'bg-success-50 text-success-700'
            : 'bg-neutral-100 text-neutral-700';
    return (
        <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${toneClass}`}>
            <Icon size={16} />
            <span className="text-caption">
                <span className="font-semibold">{value}</span>{' '}
                <span className="opacity-70">{label}</span>
            </span>
        </div>
    );
}

// ─── Counsellor card ──────────────────────────────────────────

function CounsellorCard({
    counsellor,
    instituteId,
    onOpen,
    onToggleStatus,
    statusLoading,
}: {
    counsellor: WorkbenchCounsellor;
    instituteId: string;
    onOpen: () => void;
    onToggleStatus: () => void;
    statusLoading: boolean;
}) {
    const name = counsellor.full_name || 'Unnamed';
    return (
        <button
            type="button"
            onClick={onOpen}
            className={cn(
                'group relative flex flex-col items-stretch overflow-hidden rounded-xl border bg-white text-left shadow-sm transition-all hover:border-primary-300 hover:shadow-md',
                counsellor.is_active ? 'border-neutral-200' : 'border-neutral-200 opacity-75'
            )}
        >
            <div
                className={cn(
                    'h-1',
                    counsellor.is_active ? 'bg-primary-500' : 'bg-neutral-300'
                )}
            />
            <div className="flex items-start gap-3 px-4 py-3">
                <Avatar name={name} large />
                <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate text-body font-semibold text-neutral-900">
                        {name}
                    </div>
                    {counsellor.role_label ? (
                        <div className="truncate text-caption italic text-neutral-700">
                            {counsellor.role_label}
                        </div>
                    ) : (
                        counsellor.email && (
                            <div className="truncate text-caption text-neutral-500">
                                {counsellor.email}
                            </div>
                        )
                    )}
                </div>
                <CounsellorRatingBadge instituteId={instituteId} userId={counsellor.user_id} size="md" />
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-neutral-100 bg-neutral-50 px-4 py-2.5 text-caption">
                <div>
                    <div className="text-neutral-500">Open leads</div>
                    <div className="text-body font-semibold text-neutral-900">
                        {counsellor.open_leads_count}
                    </div>
                </div>
                <div>
                    <div className="text-neutral-500">Team</div>
                    <div className="truncate text-body font-medium text-neutral-700">
                        {counsellor.team_name ?? '—'}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-2.5">
                <span
                    className={cn(
                        'flex items-center gap-1.5 text-caption font-medium',
                        counsellor.is_active ? 'text-success-700' : 'text-neutral-500'
                    )}
                >
                    <span
                        className={cn(
                            'inline-block size-1.5 rounded-full',
                            counsellor.is_active ? 'bg-success-500' : 'bg-neutral-400'
                        )}
                    />
                    {counsellor.is_active ? 'Active' : 'Inactive'}
                </span>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (
                            window.confirm(
                                counsellor.is_active
                                    ? `Mark ${name} inactive? Their open leads can be reassigned.`
                                    : `Mark ${name} active again?`
                            )
                        ) {
                            onToggleStatus();
                        }
                    }}
                    disabled={statusLoading}
                    className={cn(
                        'rounded-md px-2.5 py-1 text-caption font-medium transition-colors',
                        counsellor.is_active
                            ? 'text-danger-600 hover:bg-danger-50'
                            : 'text-success-700 hover:bg-success-50'
                    )}
                >
                    {statusLoading
                        ? '…'
                        : counsellor.is_active
                        ? 'Mark inactive'
                        : 'Mark active'}
                </button>
            </div>
        </button>
    );
}

// ─── Detail drawer ────────────────────────────────────────────

function DetailDrawer({
    counsellor,
    onClose,
    tab,
    onTabChange,
    instituteId,
    onReassign,
}: {
    counsellor: WorkbenchCounsellor;
    onClose: () => void;
    tab: DetailTab;
    onTabChange: (t: DetailTab) => void;
    instituteId: string;
    onReassign: (lead: WorkbenchLead) => void;
}) {
    // Close on Escape.
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const name = counsellor.full_name || 'Unnamed';
    return (
        <div
            className="fixed inset-0 z-40 flex justify-end bg-neutral-900/40"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={`${name} details`}
        >
            <div
                className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3">
                    <Avatar name={name} large />
                    <div className="min-w-0 flex-1 leading-tight">
                        <div className="truncate text-h3 font-medium text-neutral-900">{name}</div>
                        <div className="truncate text-caption text-neutral-500">
                            {counsellor.email ?? counsellor.role_label ?? '—'}
                        </div>
                    </div>
                    <CounsellorRatingBadge
                        instituteId={instituteId}
                        userId={counsellor.user_id}
                        size="lg"
                    />
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <Tabs
                    value={tab}
                    onValueChange={(v) => onTabChange(v as DetailTab)}
                    className="flex min-h-0 flex-1 flex-col"
                >
                    <TabsList className="m-3 gap-2">
                        <TabsTrigger value="leads">
                            <ChatCircleText size={14} className="mr-1.5" /> Leads (
                            {counsellor.open_leads_count})
                        </TabsTrigger>
                        <TabsTrigger value="activity">
                            <ArrowsClockwise size={14} className="mr-1.5" /> Activity
                        </TabsTrigger>
                        <TabsTrigger value="performance">
                            <ChartLineUp size={14} className="mr-1.5" /> Performance
                        </TabsTrigger>
                    </TabsList>
                    <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
                        {tab === 'leads' && (
                            <CounsellorLeadsTab
                                instituteId={instituteId}
                                counsellorUserId={counsellor.user_id}
                                onReassign={onReassign}
                            />
                        )}
                        {tab === 'activity' && (
                            <CounsellorActivityTab
                                instituteId={instituteId}
                                counsellorUserId={counsellor.user_id}
                            />
                        )}
                        {tab === 'performance' && (
                            <div className="space-y-4">
                                <ConversionBySourceWidget
                                    instituteId={instituteId}
                                    counsellorUserId={counsellor.user_id}
                                />
                                <CallsPerDayWidget
                                    instituteId={instituteId}
                                    counsellorUserId={counsellor.user_id}
                                />
                            </div>
                        )}
                    </div>
                </Tabs>
            </div>
        </div>
    );
}

// ─── Avatar ───────────────────────────────────────────────────

function Avatar({ name, large = false }: { name: string; large?: boolean }) {
    const initial = (name || '?').trim().slice(0, 1).toUpperCase();
    return (
        <div
            className={cn(
                'flex shrink-0 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700',
                large ? 'size-11 text-h3' : 'size-9 text-h4'
            )}
            aria-hidden="true"
        >
            {initial || <User size={16} />}
        </div>
    );
}
