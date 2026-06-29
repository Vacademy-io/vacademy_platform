import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FacebookLeadsDailyFunnel } from './FacebookLeadsDailyFunnel';
import { CenterDistributionCharts } from './CenterDistributionCharts';
import { InfoHint } from './InfoHint';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    FacebookLogo,
    MapPin,
    Users,
    ChatCircle,
    PaperPlaneTilt,
    Warning,
    GraduationCap,
    Download,
    Phone,
    MagnifyingGlass,
    CheckCircle,
    Clock,
    ArrowsClockwise,
    type Icon,
} from '@phosphor-icons/react';
import { format } from 'date-fns';
import type {
    AudienceLead,
    CampaignListResponse,
    FacebookLeadsBundle,
    LeadJourneyFunnelResponse,
    LeadJourneyRecipient,
} from '@/types/challenge-analytics';
import { useFacebookLeads, useLeadJourneyFunnel } from '../-hooks/useAnalyticsData';

interface FacebookLeadsProps {
    startDate: string;
    endDate: string;
    /** SOCIAL MEDIA campaigns fetched by the parent (these are the Facebook audiences). */
    campaigns: CampaignListResponse | undefined;
    campaignsLoading: boolean;
    /** Canonical center list (institute's Zoho-form campaigns) so 0-lead centers still show. */
    allCenters?: string[];
    enabled: boolean;
}

const UNSPECIFIED = 'Unspecified';

// ---------- field resolution helpers ----------

/** Resolve a custom-field value by matching fieldName in custom_field_metadata. */
function getCF(lead: AudienceLead, ...fieldNames: string[]): string {
    const meta = lead.custom_field_metadata || {};
    const values = lead.custom_field_values || {};
    for (const name of fieldNames) {
        const lower = name.toLowerCase();
        for (const [id, m] of Object.entries(meta)) {
            if ((m?.fieldName || '').toLowerCase() === lower && values[id]) {
                return values[id] ?? '';
            }
        }
    }
    return '';
}

const leadName = (lead: AudienceLead) =>
    lead.user?.full_name || lead.parent_name || getCF(lead, 'full name', 'parent name', 'name') || '';

const leadPhone = (lead: AudienceLead) =>
    lead.user?.mobile_number ||
    lead.parent_mobile ||
    getCF(lead, 'phone number', 'phone', 'mobile') ||
    '';

const leadCenter = (lead: AudienceLead) => getCF(lead, 'center name', 'center') || '';

/** Digits-only, last 10 — used to match lead mobiles against journey channel ids. */
function phoneKey(raw: string): string {
    const digits = (raw || '').replace(/\D/g, '');
    return digits.length > 10 ? digits.slice(-10) : digits;
}

type LeadStatusKind = 'CONVERTED' | 'OPT_OUT_INACTIVE' | 'OPT_OUT_EXPLICIT' | 'OPTED_OUT' | 'ACTIVE';

function leadStatus(lead: AudienceLead, isOptedOut: boolean): LeadStatusKind {
    if (isOptedOut) {
        if (lead.conversion_status === 'OPT_OUT_INACTIVE') return 'OPT_OUT_INACTIVE';
        if (lead.conversion_status === 'OPT_OUT_EXPLICIT') return 'OPT_OUT_EXPLICIT';
        return 'OPTED_OUT';
    }
    if (lead.conversion_status === 'CONVERTED') return 'CONVERTED';
    return 'ACTIVE';
}

const STATUS_LABEL: Record<LeadStatusKind, string> = {
    CONVERTED: 'Converted',
    OPT_OUT_INACTIVE: 'Inactive',
    OPT_OUT_EXPLICIT: 'Opted out',
    OPTED_OUT: 'Opted out',
    ACTIVE: 'Active',
};

const STATUS_CLASS: Record<LeadStatusKind, string> = {
    CONVERTED: 'bg-emerald-100 text-emerald-700',
    OPT_OUT_INACTIVE: 'bg-amber-100 text-amber-700',
    OPT_OUT_EXPLICIT: 'bg-red-100 text-red-700',
    OPTED_OUT: 'bg-red-100 text-red-700',
    ACTIVE: 'bg-blue-100 text-blue-700',
};

// ---------- derived row types ----------

interface CenterRow {
    center: string;
    leads: number;
    converted: number;
    optedOut: number;
    messaged: number;
    replied: number;
}

interface ExplorerRow {
    id: string;
    name: string;
    phone: string;
    center: string;
    submittedAt: string | null;
    status: LeadStatusKind;
    daysMessaged: number;
}

export function FacebookLeads({
    startDate,
    endDate,
    campaigns,
    campaignsLoading,
    allCenters,
    enabled,
}: FacebookLeadsProps) {
    // Facebook audiences = active SOCIAL MEDIA campaigns.
    const fbAudiences = useMemo(
        () =>
            (campaigns?.content || []).filter((c) =>
                (c.campaign_type || '').toUpperCase().includes('SOCIAL')
            ),
        [campaigns]
    );
    const audienceIds = useMemo(() => fbAudiences.map((a) => a.id), [fbAudiences]);

    const { data: bundle, isLoading: leadsLoading } = useFacebookLeads(
        audienceIds,
        startDate,
        endDate,
        enabled
    );
    const { data: funnel, isLoading: funnelLoading } = useLeadJourneyFunnel(
        startDate,
        endDate,
        enabled
    );

    // Filters for the lead explorer
    const [centerFilter, setCenterFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const pageSize = 12;

    // Filter for the message roster
    const [rosterFilter, setRosterFilter] = useState('all');

    const isLoading = campaignsLoading || leadsLoading;

    const active = bundle?.active || [];
    const optedOut = bundle?.optedOut || [];
    const totalLeads = active.length + optedOut.length;

    // Map normalized phone -> journey recipient (for per-lead messaged days)
    const recipientByPhone = useMemo(() => {
        const map = new Map<string, LeadJourneyRecipient>();
        for (const r of funnel?.recipients || []) {
            map.set(phoneKey(r.phone), r);
        }
        return map;
    }, [funnel]);

    // Per-center aggregation
    const centerRows = useMemo<CenterRow[]>(() => {
        const map = new Map<string, CenterRow>();
        const ensure = (center: string) => {
            const key = center || UNSPECIFIED;
            if (!map.has(key)) {
                map.set(key, {
                    center: key,
                    leads: 0,
                    converted: 0,
                    optedOut: 0,
                    messaged: 0,
                    replied: 0,
                });
            }
            return map.get(key)!;
        };
        // Seed every known center so centers with zero Facebook leads still appear.
        for (const c of allCenters || []) {
            if (c) ensure(c);
        }
        for (const lead of active) {
            const row = ensure(leadCenter(lead));
            row.leads++;
            if (lead.conversion_status === 'CONVERTED') row.converted++;
        }
        for (const lead of optedOut) {
            const row = ensure(leadCenter(lead));
            row.leads++;
            row.optedOut++;
        }
        for (const r of funnel?.recipients || []) {
            const row = ensure(r.center || '');
            row.messaged++;
            if (r.replied) row.replied++;
        }
        return Array.from(map.values()).sort(
            (a, b) => b.leads - a.leads || a.center.localeCompare(b.center)
        );
    }, [active, optedOut, funnel, allCenters]);

    const hasOptOuts = optedOut.length > 0;

    const maxCenterLeads = Math.max(...centerRows.map((c) => c.leads), 1);

    // KPI values
    const convertedCount = active.filter((l) => l.conversion_status === 'CONVERTED').length;
    const inactiveCount = optedOut.filter(
        (l) => l.conversion_status === 'OPT_OUT_INACTIVE'
    ).length;
    const explicitCount = optedOut.filter(
        (l) => l.conversion_status === 'OPT_OUT_EXPLICIT'
    ).length;
    const activeCenters = centerRows.filter(
        (c) => c.center !== UNSPECIFIED && c.leads > 0
    ).length;

    // Lead explorer rows
    const explorerRows = useMemo<ExplorerRow[]>(() => {
        const build = (lead: AudienceLead, isOpted: boolean): ExplorerRow => {
            const phone = leadPhone(lead);
            const rec = recipientByPhone.get(phoneKey(phone));
            return {
                id: lead.response_id,
                name: leadName(lead) || 'Anonymous',
                phone,
                center: leadCenter(lead) || UNSPECIFIED,
                submittedAt: lead.submitted_at_local ?? null,
                status: leadStatus(lead, isOpted),
                daysMessaged: rec?.days_received?.length || 0,
            };
        };
        return [
            ...active.map((l) => build(l, false)),
            ...optedOut.map((l) => build(l, true)),
        ];
    }, [active, optedOut, recipientByPhone]);

    const centerOptions = useMemo(
        () => Array.from(new Set(explorerRows.map((r) => r.center))).sort(),
        [explorerRows]
    );

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return explorerRows.filter((r) => {
            if (centerFilter !== 'all' && r.center !== centerFilter) return false;
            if (statusFilter !== 'all') {
                if (statusFilter === 'OPTED_OUT' && !r.status.startsWith('OPT')) return false;
                if (statusFilter !== 'OPTED_OUT' && r.status !== statusFilter) return false;
            }
            if (q && !(`${r.name} ${r.phone} ${r.center}`.toLowerCase().includes(q))) return false;
            return true;
        });
    }, [explorerRows, centerFilter, statusFilter, search]);

    const pagedRows = filteredRows.slice(page * pageSize, page * pageSize + pageSize);
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

    const exportToCSV = () => {
        const headers = ['Name', 'Phone', 'Center', 'Status', 'Days Messaged', 'Submitted'];
        const rows = filteredRows.map((r) => [
            r.name,
            r.phone || 'N/A',
            r.center,
            STATUS_LABEL[r.status],
            String(r.daysMessaged),
            r.submittedAt ? new Date(r.submittedAt).toLocaleString() : 'N/A',
        ]);
        const csv = [headers, ...rows].map((line) => line.map((c) => `"${c}"`).join(',')).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `facebook_leads_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    // KPI cards — the Opted-Out card is omitted entirely until there are opt-outs.
    const kpiCards: Array<{
        label: string;
        value: number;
        sub?: string;
        icon: KpiCardProps['icon'];
        color: KpiCardProps['color'];
    }> = [
        { label: 'Total Leads', value: totalLeads, icon: Users, color: 'blue' },
        { label: 'Active Centers', value: activeCenters, icon: MapPin, color: 'violet' },
        {
            label: 'Messaged',
            value: funnel?.summary?.unique_recipients ?? 0,
            icon: PaperPlaneTilt,
            color: 'indigo',
        },
        {
            label: 'Replied',
            value: funnel?.summary?.replied_recipients ?? 0,
            sub:
                funnel?.summary?.reply_rate != null
                    ? `${funnel.summary.reply_rate}% reply rate`
                    : undefined,
            icon: ChatCircle,
            color: 'emerald',
        },
        ...(hasOptOuts
            ? [
                  {
                      label: 'Opted-Out',
                      value: optedOut.length,
                      sub: `${explicitCount} explicit · ${inactiveCount} inactive`,
                      icon: Warning,
                      color: 'red' as const,
                  },
              ]
            : []),
        { label: 'Converted', value: convertedCount, icon: GraduationCap, color: 'emerald' },
    ];
    const kpiLgColsClass = kpiCards.length === 6 ? 'lg:grid-cols-6' : 'lg:grid-cols-5';

    // ---------- render ----------

    if (isLoading) {
        return (
            <Card className="shadow-sm">
                <CardHeader>
                    <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
                </CardHeader>
                <CardContent>
                    <div className="h-72 animate-pulse rounded bg-gray-100" />
                </CardContent>
            </Card>
        );
    }

    if (audienceIds.length === 0) {
        return (
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center gap-2">
                    <FacebookLogo className="size-5 text-blue-600" weight="fill" />
                    <CardTitle className="text-base font-semibold">Facebook Leads</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-gray-500">
                        <FacebookLogo className="size-8 text-gray-300" weight="fill" />
                        <p>No active Facebook (Social Media) campaign found for this institute.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const noLeads = totalLeads === 0;

    return (
        <div className="space-y-4">
            {/* KPI summary — opt-out card only appears once there are opt-outs */}
            <div className={`grid grid-cols-2 gap-3 md:grid-cols-3 ${kpiLgColsClass}`}>
                {kpiCards.map((c) => (
                    <KpiCard
                        key={c.label}
                        label={c.label}
                        value={c.value}
                        sub={c.sub}
                        icon={c.icon}
                        color={c.color}
                    />
                ))}
            </div>

            <Tabs defaultValue="centers" className="space-y-4">
                <TabsList className="flex w-full justify-start gap-1 overflow-x-auto">
                    <TabsTrigger value="centers" className="shrink-0 gap-2">
                        <MapPin className="size-4" />
                        Centers
                    </TabsTrigger>
                    <TabsTrigger value="messages" className="shrink-0 gap-2">
                        <PaperPlaneTilt className="size-4" />
                        Daily Messages
                    </TabsTrigger>
                    <TabsTrigger value="leads" className="shrink-0 gap-2">
                        <Users className="size-4" />
                        Leads
                    </TabsTrigger>
                </TabsList>

                {/* Centers tab */}
                <TabsContent value="centers" className="space-y-4">
            {/* Center distribution charts (bar + donut), like the Zoho centers view */}
            {!noLeads && (
                <CenterDistributionCharts
                    data={centerRows.map((r) => ({
                        name: r.center,
                        users: r.leads,
                        interactions: r.messaged,
                        optedOut: r.optedOut,
                    }))}
                    usersLabel="Leads"
                    interactionsLabel="Messaged"
                />
            )}

            {/* Per-center performance */}
            <Card className="shadow-sm">
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-blue-100 p-2">
                            <FacebookLogo className="size-5 text-blue-600" weight="fill" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-semibold">
                                Center Performance — Facebook Leads
                            </CardTitle>
                            <p className="text-xs text-gray-500">
                                Leads, messaging & opt-outs per center (all centers funnel into one
                                Facebook campaign; grouped by the lead&apos;s center).{' '}
                                <span className="font-medium text-gray-600">Share</span> = each
                                center&apos;s % of total Facebook leads.
                            </p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {noLeads ? (
                        <div className="flex flex-col items-center justify-center gap-1 py-10 text-center text-gray-500">
                            <p>No Facebook leads in the selected date range.</p>
                            <p className="text-xs">Try widening the date range above.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium text-gray-700">
                                            Center
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium text-gray-700">
                                            <span className="flex items-center justify-end gap-1">
                                                <Users className="size-3.5" />
                                                Leads
                                            </span>
                                        </th>
                                        <th className="hidden px-4 py-3 text-left font-medium text-gray-700 md:table-cell">
                                            <span className="flex items-center gap-1">
                                                Share of leads
                                                <InfoHint text="Each center's share of all Facebook leads = this center's leads ÷ total leads." />
                                            </span>
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium text-gray-700">
                                            <span className="flex items-center justify-end gap-1">
                                                <PaperPlaneTilt className="size-3.5" />
                                                Messaged
                                            </span>
                                        </th>
                                        <th className="hidden px-4 py-3 text-right font-medium text-gray-700 sm:table-cell">
                                            <span className="flex items-center justify-end gap-1">
                                                <ChatCircle className="size-3.5" />
                                                Replied
                                            </span>
                                        </th>
                                        {hasOptOuts && (
                                            <th className="px-4 py-3 text-right font-medium text-gray-700">
                                                <span className="flex items-center justify-end gap-1">
                                                    <Warning className="size-3.5" />
                                                    Opt-Outs
                                                </span>
                                            </th>
                                        )}
                                        <th className="hidden px-4 py-3 text-right font-medium text-gray-700 lg:table-cell">
                                            <span className="flex items-center justify-end gap-1">
                                                <GraduationCap className="size-3.5" />
                                                Converted
                                            </span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {centerRows.map((row) => {
                                        const sharePercent =
                                            totalLeads > 0
                                                ? ((row.leads / totalLeads) * 100).toFixed(1)
                                                : '0';
                                        const barWidth = Math.round(
                                            (row.leads / maxCenterLeads) * 100
                                        );
                                        return (
                                            <tr key={row.center} className="border-t hover:bg-gray-50">
                                                <td className="px-4 py-3">
                                                    <span className="font-medium text-gray-800">
                                                        {row.center}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold text-blue-700">
                                                    {row.leads.toLocaleString()}
                                                </td>
                                                <td className="hidden px-4 py-3 md:table-cell">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
                                                            {/* dynamic share bar width */}
                                                            <div
                                                                className="bg-primary-500 h-full rounded-full"
                                                                style={{ width: `${barWidth}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs text-gray-500">
                                                            {sharePercent}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-indigo-700">
                                                    {row.messaged.toLocaleString()}
                                                </td>
                                                <td className="hidden px-4 py-3 text-right text-emerald-700 sm:table-cell">
                                                    {row.replied.toLocaleString()}
                                                </td>
                                                {hasOptOuts && (
                                                    <td className="px-4 py-3 text-right">
                                                        {row.optedOut > 0 ? (
                                                            <span className="font-medium text-red-600">
                                                                {row.optedOut.toLocaleString()}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400">0</span>
                                                        )}
                                                    </td>
                                                )}
                                                <td className="hidden px-4 py-3 text-right font-medium text-emerald-700 lg:table-cell">
                                                    {row.converted.toLocaleString()}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="border-t bg-gray-50">
                                    <tr>
                                        <td className="px-4 py-3 font-semibold text-gray-700">
                                            Total
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-blue-700">
                                            {totalLeads.toLocaleString()}
                                        </td>
                                        <td className="hidden px-4 py-3 md:table-cell" />
                                        <td className="px-4 py-3 text-right font-bold text-indigo-700">
                                            {(funnel?.summary?.unique_recipients ?? 0).toLocaleString()}
                                        </td>
                                        <td className="hidden px-4 py-3 text-right font-bold text-emerald-700 sm:table-cell">
                                            {(funnel?.summary?.replied_recipients ?? 0).toLocaleString()}
                                        </td>
                                        {hasOptOuts && (
                                            <td className="px-4 py-3 text-right font-bold text-red-600">
                                                {optedOut.length.toLocaleString()}
                                            </td>
                                        )}
                                        <td className="hidden px-4 py-3 text-right font-bold text-emerald-700 lg:table-cell">
                                            {convertedCount.toLocaleString()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
                </TabsContent>

                {/* Daily Messages tab */}
                <TabsContent value="messages" className="space-y-4">
                    {/* Overview-style daily charts (Messages by Day + Response Rate Trend) */}
                    <FacebookLeadsDailyFunnel funnel={funnel} loading={funnelLoading} />

                    {/* Daily-message funnel — per-day bars + recipient roster */}
                    <DailyMessageFunnel
                        funnel={funnel}
                        isLoading={funnelLoading}
                        rosterFilter={rosterFilter}
                        onRosterFilterChange={setRosterFilter}
                    />
                </TabsContent>

                {/* Leads tab */}
                <TabsContent value="leads">
            {/* Lead explorer */}
            <Card className="shadow-sm">
                <CardHeader className="pb-2">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle className="text-base font-semibold">Lead Explorer</CardTitle>
                            <p className="text-xs text-gray-500">
                                Every Facebook lead — center, status & days messaged
                            </p>
                        </div>
                        {filteredRows.length > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={exportToCSV}
                                className="gap-2 self-start"
                            >
                                <Download className="size-4" />
                                Export CSV
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                        <div className="relative w-full sm:w-64">
                            <MagnifyingGlass className="absolute left-2.5 top-2.5 size-4 text-gray-400" />
                            <Input
                                placeholder="Search name, phone, center"
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setPage(0);
                                }}
                                className="pl-8"
                            />
                        </div>
                        <Select
                            value={centerFilter}
                            onValueChange={(v) => {
                                setCenterFilter(v);
                                setPage(0);
                            }}
                        >
                            <SelectTrigger className="w-full sm:w-48">
                                <SelectValue placeholder="Center" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All centers</SelectItem>
                                {centerOptions.map((c) => (
                                    <SelectItem key={c} value={c}>
                                        {c}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={statusFilter}
                            onValueChange={(v) => {
                                setStatusFilter(v);
                                setPage(0);
                            }}
                        >
                            <SelectTrigger className="w-full sm:w-44">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All statuses</SelectItem>
                                <SelectItem value="ACTIVE">Active</SelectItem>
                                <SelectItem value="CONVERTED">Converted</SelectItem>
                                <SelectItem value="OPTED_OUT">Opted out</SelectItem>
                                <SelectItem value="OPT_OUT_INACTIVE">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                        <span className="text-xs text-gray-500 sm:ml-auto">
                            {filteredRows.length.toLocaleString()} of {totalLeads.toLocaleString()}{' '}
                            leads
                        </span>
                    </div>

                    {filteredRows.length === 0 ? (
                        <div className="flex items-center justify-center py-10 text-center text-gray-500">
                            No leads match the current filters.
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto rounded-lg border">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-medium text-gray-700">
                                                #
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium text-gray-700">
                                                Lead
                                            </th>
                                            <th className="hidden px-4 py-3 text-left font-medium text-gray-700 sm:table-cell">
                                                Center
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium text-gray-700">
                                                Status
                                            </th>
                                            <th className="hidden px-4 py-3 text-right font-medium text-gray-700 md:table-cell">
                                                Days Messaged
                                            </th>
                                            <th className="hidden px-4 py-3 text-left font-medium text-gray-700 lg:table-cell">
                                                Submitted
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedRows.map((row, index) => (
                                            <tr key={row.id} className="border-t hover:bg-gray-50">
                                                <td className="px-4 py-3 text-gray-500">
                                                    {page * pageSize + index + 1}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-gray-800">
                                                        {row.name}
                                                    </p>
                                                    {row.phone && (
                                                        <span className="flex items-center gap-1 text-xs text-gray-500">
                                                            <Phone className="size-3" />
                                                            {row.phone}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="hidden px-4 py-3 text-gray-600 sm:table-cell">
                                                    {row.center}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[row.status]}`}
                                                    >
                                                        {STATUS_LABEL[row.status]}
                                                    </span>
                                                </td>
                                                <td className="hidden px-4 py-3 text-right md:table-cell">
                                                    {row.daysMessaged > 0 ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                                                            {row.daysMessaged}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">0</span>
                                                    )}
                                                </td>
                                                <td className="hidden px-4 py-3 text-xs text-gray-600 lg:table-cell">
                                                    {row.submittedAt
                                                        ? format(
                                                              new Date(row.submittedAt),
                                                              'MMM dd, yyyy'
                                                          )
                                                        : 'N/A'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {totalPages > 1 && (
                                <div className="mt-4 flex items-center justify-between">
                                    <span className="text-sm text-gray-500">
                                        Page {page + 1} of {totalPages}
                                    </span>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                                            disabled={page === 0}
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setPage((p) => Math.min(totalPages - 1, p + 1))
                                            }
                                            disabled={page >= totalPages - 1}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ---------- KPI card ----------

interface KpiCardProps {
    label: string;
    value: number | string;
    sub?: string;
    icon: Icon;
    color: 'blue' | 'violet' | 'indigo' | 'emerald' | 'red';
}

const KPI_BG: Record<KpiCardProps['color'], string> = {
    blue: 'bg-blue-100 text-blue-600',
    violet: 'bg-violet-100 text-violet-600',
    indigo: 'bg-indigo-100 text-indigo-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    red: 'bg-red-100 text-red-600',
};

function KpiCard({ label, value, sub, icon: Icon, color }: KpiCardProps) {
    return (
        <Card className="shadow-sm">
            <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                    <div className={`rounded-lg p-2 ${KPI_BG[color]}`}>
                        <Icon className="size-4" weight="fill" />
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-xs text-gray-500">{label}</p>
                        <p className="text-xl font-bold text-gray-800">
                            {typeof value === 'number' ? value.toLocaleString() : value}
                        </p>
                        {sub && <p className="truncate text-xs text-gray-400">{sub}</p>}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ---------- daily-message funnel ----------

interface DailyMessageFunnelProps {
    funnel: LeadJourneyFunnelResponse | undefined;
    isLoading: boolean;
    rosterFilter: string;
    onRosterFilterChange: (v: string) => void;
}

function DailyMessageFunnel({
    funnel,
    isLoading,
    rosterFilter,
    onRosterFilterChange,
}: DailyMessageFunnelProps) {
    const days = funnel?.days || [];
    const recipients = funnel?.recipients || [];
    const maxSends = Math.max(...days.map((d) => d.total_sends), 1);

    const filteredRoster = recipients.filter((r) => {
        if (rosterFilter === 'replied') return r.replied;
        if (rosterFilter === 'silent') return !r.replied;
        return true;
    });

    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-indigo-100 p-2">
                        <PaperPlaneTilt className="size-5 text-indigo-600" weight="fill" />
                    </div>
                    <div>
                        <CardTitle className="text-base font-semibold">
                            Daily-Message Funnel
                        </CardTitle>
                        <p className="text-xs text-gray-500">
                            The 7-day WhatsApp journey — sends, recipients & replies per day
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="h-40 animate-pulse rounded bg-gray-100" />
                ) : days.length === 0 ? (
                    <div className="flex items-center justify-center py-10 text-center text-gray-500">
                        No journey messages sent in the selected date range.
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* per-day bars */}
                        <div className="space-y-2">
                            {days.map((d) => {
                                const width = Math.round((d.total_sends / maxSends) * 100);
                                return (
                                    <div key={d.day_number} className="flex items-center gap-3">
                                        <span className="w-12 shrink-0 text-xs font-medium text-gray-600">
                                            Day {d.day_number}
                                        </span>
                                        <div className="h-6 flex-1 overflow-hidden rounded-md bg-gray-100">
                                            {/* dynamic funnel bar width */}
                                            <div
                                                className="bg-primary-500 flex h-full items-center rounded-md px-2"
                                                style={{ width: `${Math.max(width, 6)}%` }}
                                            >
                                                <span className="text-xs font-semibold text-white">
                                                    {d.total_sends}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="hidden w-24 shrink-0 text-right text-xs text-gray-500 sm:inline">
                                            {d.unique_recipients} ppl
                                        </span>
                                        <span className="w-20 shrink-0 text-right text-xs font-medium text-emerald-700">
                                            {d.reply_rate}% reply
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* recipient roster */}
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <h4 className="text-sm font-medium text-gray-700">
                                    Who received messages
                                </h4>
                                <Select value={rosterFilter} onValueChange={onRosterFilterChange}>
                                    <SelectTrigger className="w-40">
                                        <SelectValue placeholder="Filter" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All recipients</SelectItem>
                                        <SelectItem value="replied">Replied</SelectItem>
                                        <SelectItem value="silent">Silent (no reply)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="max-h-96 overflow-y-auto rounded-lg border">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-medium text-gray-700">
                                                Phone
                                            </th>
                                            <th className="hidden px-4 py-2 text-left font-medium text-gray-700 sm:table-cell">
                                                Center
                                            </th>
                                            <th className="px-4 py-2 text-left font-medium text-gray-700">
                                                Days received
                                            </th>
                                            <th className="hidden px-4 py-2 text-left font-medium text-gray-700 md:table-cell">
                                                Last sent
                                            </th>
                                            <th className="px-4 py-2 text-center font-medium text-gray-700">
                                                Replied
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRoster.map((r) => (
                                            <tr key={r.phone} className="border-t hover:bg-gray-50">
                                                <td className="px-4 py-2 font-medium text-gray-800">
                                                    {r.phone}
                                                </td>
                                                <td className="hidden px-4 py-2 text-gray-600 sm:table-cell">
                                                    {r.center || '—'}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="flex flex-wrap gap-1">
                                                        {r.days_received.map((day) => (
                                                            <span
                                                                key={day}
                                                                className="inline-flex size-5 items-center justify-center rounded bg-indigo-100 text-xs font-medium text-indigo-700"
                                                            >
                                                                {day}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="hidden px-4 py-2 text-xs text-gray-500 md:table-cell">
                                                    {r.last_sent_at
                                                        ? format(new Date(r.last_sent_at), 'MMM dd')
                                                        : '—'}
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    {r.replied ? (
                                                        <CheckCircle
                                                            className="mx-auto size-4 text-emerald-600"
                                                            weight="fill"
                                                        />
                                                    ) : (
                                                        <Clock className="mx-auto size-4 text-amber-500" />
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {funnel?.recipients_truncated && (
                                <p className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                                    <ArrowsClockwise className="size-3" />
                                    Recipient list was capped — narrow the date range for the full
                                    roster.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
