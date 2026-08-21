import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SettingsPageShell, SettingToggleRow } from '@/components/settings/shell';
import { MyButton } from '@/components/design-system/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { MyInput } from '@/components/design-system/input';
import { MyTable } from '@/components/design-system/table';
import type { ColumnDef } from '@tanstack/react-table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    EMPTY_REPORT_SETTING,
    fetchReportSetting,
    fetchRuns,
    fetchSections,
    newSchedule,
    previewScope,
    saveReportSetting,
    type ReportSchedule,
    type ReportSettingConfig,
    type ReportRun,
    type ScopePreview,
} from '../-services/scheduled-reports-service';

/**
 * Scheduled Reports — push reporting configuration.
 *
 * Two things here are load-bearing rather than decorative:
 *
 * 1. **Sections are offered only when the institute has data for them.**
 *    Institutes differ wildly in shape — one runs 1,500 live sessions and no
 *    chatbot, another has 67,000 progress rows and one live session. Letting an
 *    admin tick a section that can only ever render empty is a bad first run, so
 *    availability comes from the server and unavailable sections are disabled.
 *
 * 2. **Fan-out is previewed before saving.** Scope multiplies everything: at a
 *    real institute "every batch" resolves to 661 documents per run, and daily
 *    that is ~20,000 generations a month — each of which bills. The admin is
 *    shown that number before they commit to it, not afterwards on the ledger.
 */

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const SCOPES = [
    { v: 'INSTITUTE', label: 'Whole institute' },
    { v: 'BATCH', label: 'Per batch' },
    { v: 'SUBJECT', label: 'Per subject' },
    { v: 'FACULTY', label: 'Per faculty' },
];
const ROLES = ['ADMIN', 'TEACHER', 'EVALUATOR'];

/** Delivery history columns. Read-only — the audit view, not an editing surface. */
const runColumns: ColumnDef<ReportRun>[] = [
    {
        accessorKey: 'createdAt',
        header: 'When',
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
    },
    { accessorKey: 'scopeLabel', header: 'Report' },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) =>
            row.original.skipReason
                ? `${row.original.status} — ${row.original.skipReason}`
                : row.original.status,
    },
    { accessorKey: 'recipientCount', header: 'Recipients' },
    { accessorKey: 'namedLearners', header: 'Learners named' },
];
/** Mirrors ReportingScopeResolver.MAX_DOCUMENTS_PER_RUN — the server refuses above this. */
const MAX_DOCS_PER_RUN = 50;

export default function ScheduledReportsSettings() {
    const [config, setConfig] = useState<ReportSettingConfig>(EMPTY_REPORT_SETTING);
    const [saving, setSaving] = useState(false);
    const [preview, setPreview] = useState<Record<string, ScopePreview | null>>({});

    const { data: stored, isLoading } = useQuery({
        queryKey: ['report-setting'],
        queryFn: fetchReportSetting,
    });
    const {
        data: sections = [],
        isLoading: sectionsLoading,
        error: sectionsError,
    } = useQuery({
        queryKey: ['report-sections'],
        queryFn: fetchSections,
    });
    const {
        data: runs = [],
        refetch: refetchRuns,
        isLoading: runsLoading,
        error: runsError,
    } = useQuery({
        queryKey: ['report-runs'],
        queryFn: fetchRuns,
    });

    useEffect(() => {
        if (stored) setConfig(stored);
    }, [stored]);

    const availableSections = useMemo(() => sections.filter((s) => s.available), [sections]);

    function patchSchedule(id: string, patch: Partial<ReportSchedule>) {
        setConfig((c) => ({
            ...c,
            schedules: c.schedules.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        }));
        // Any change to scope or frequency invalidates the fan-out estimate.
        setPreview((p) => ({ ...p, [id]: null }));
    }

    async function runPreview(schedule: ReportSchedule) {
        try {
            const p = await previewScope(schedule);
            setPreview((prev) => ({ ...prev, [schedule.id]: p }));
        } catch {
            toast.error('Could not work out how many reports this would create');
        }
    }

    async function handleSave() {
        // Refuse to save a schedule that would fan out past the server cap —
        // saving it would simply fail every run, silently, forever.
        for (const s of config.schedules) {
            const p = preview[s.id];
            if (p?.exceedsCap) {
                toast.error(
                    `"${s.name}" would create ${p.documentsPerRun} reports per run, above the ${MAX_DOCS_PER_RUN} limit. Narrow the scope first.`
                );
                return;
            }
            if (s.sections.length === 0) {
                toast.error(`"${s.name}" has no sections selected.`);
                return;
            }
            if (s.recipients.roles.length === 0 && s.recipients.userIds.length === 0) {
                toast.error(`"${s.name}" has no recipients.`);
                return;
            }
        }
        setSaving(true);
        try {
            await saveReportSetting(config);
            toast.success('Scheduled reports saved');
            refetchRuns();
        } catch {
            toast.error('Could not save scheduled reports');
        } finally {
            setSaving(false);
        }
    }

    return (
        <SettingsPageShell
            title="Scheduled Reports"
            description="Send institute activity to your team on a schedule, instead of waiting for someone to come and look."
            maxWidth="max-w-5xl"
            actions={
                <MyButton onClick={handleSave} disabled={saving || isLoading}>
                    {saving ? 'Saving…' : 'Save'}
                </MyButton>
            }
        >
            <div className="flex flex-col gap-6">
                <SettingToggleRow
                    label="Enable scheduled reports"
                    description="When off, nothing is generated and nothing is charged."
                    control={
                        <Switch
                            checked={config.enabled}
                            onCheckedChange={(v) => setConfig((c) => ({ ...c, enabled: v }))}
                        />
                    }
                />

                <SettingToggleRow
                    label="Timezone"
                    description="Report days and windows are worked out in this timezone."
                    control={
                        <MyInput
                            inputType="text"
                            className="w-56"
                            input={config.timezone}
                            onChangeFunction={(e) =>
                                setConfig((c) => ({ ...c, timezone: e.target.value }))
                            }
                        />
                    }
                />

                {config.schedules.map((s) => {
                    const p = preview[s.id];
                    return (
                        <div key={s.id} className="rounded-md border border-border p-4">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <MyInput
                                    inputType="text"
                                    className="max-w-xs font-medium"
                                    input={s.name}
                                    onChangeFunction={(e) =>
                                        patchSchedule(s.id, { name: e.target.value })
                                    }
                                />
                                <div className="flex items-center gap-3">
                                    <Switch
                                        checked={s.enabled}
                                        onCheckedChange={(v) => patchSchedule(s.id, { enabled: v })}
                                    />
                                    <MyButton
                                        buttonType="text"
                                        onClick={() =>
                                            setConfig((c) => ({
                                                ...c,
                                                schedules: c.schedules.filter((x) => x.id !== s.id),
                                            }))
                                        }
                                    >
                                        Remove
                                    </MyButton>
                                </div>
                            </div>

                            {/* ── What goes in it ── */}
                            <p className="mb-2 text-caption font-medium text-neutral-600">
                                Sections
                            </p>
                            <div className="mb-4 flex flex-col gap-2">
                                {sections.map((sec) => (
                                    <label
                                        key={sec.key}
                                        className={`flex items-start gap-2 text-body ${
                                            sec.available ? '' : 'opacity-50'
                                        }`}
                                    >
                                        <Checkbox
                                            className="mt-1"
                                            disabled={!sec.available}
                                            checked={s.sections.includes(sec.key)}
                                            onCheckedChange={(v) =>
                                                patchSchedule(s.id, {
                                                    sections: v
                                                        ? [...s.sections, sec.key]
                                                        : s.sections.filter((k) => k !== sec.key),
                                                })
                                            }
                                        />
                                        <span>
                                            {sec.title}
                                            {sec.identifying && (
                                                <Badge className="ml-2" variant="outline">
                                                    names learners
                                                </Badge>
                                            )}
                                            {!sec.available && (
                                                <span className="ml-2 text-caption text-neutral-500">
                                                    no data in the last 30 days
                                                </span>
                                            )}
                                            <span className="block text-caption text-neutral-500">
                                                {sec.description}
                                            </span>
                                        </span>
                                    </label>
                                ))}
                                {/* "The list is empty" and "the list failed to
                                    load" must not read the same. Saying no
                                    section has data when the request actually
                                    failed sends an admin looking for a data
                                    problem that does not exist. */}
                                {sectionsError ? (
                                    <p className="text-caption text-danger-600">
                                        Could not load the available sections. Refresh to try
                                        again — this is not the same as having no data.
                                    </p>
                                ) : sectionsLoading ? (
                                    <p className="text-caption text-neutral-500">
                                        Checking which sections have data…
                                    </p>
                                ) : (
                                    sections.length === 0 && (
                                        <p className="text-caption text-neutral-500">
                                            No section has data for this institute yet.
                                        </p>
                                    )
                                )}
                            </div>

                            {/* ── When ── */}
                            <div className="mb-4 flex flex-wrap items-center gap-3">
                                <Select
                                    value={s.frequency}
                                    onValueChange={(v) =>
                                        patchSchedule(s.id, {
                                            frequency: v as ReportSchedule['frequency'],
                                        })
                                    }
                                >
                                    <SelectTrigger className="w-40">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="daily">Daily</SelectItem>
                                        <SelectItem value="weekly">Weekly</SelectItem>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                    </SelectContent>
                                </Select>

                                {s.frequency === 'weekly' && (
                                    <Select
                                        value={s.dayOfWeek}
                                        onValueChange={(v) => patchSchedule(s.id, { dayOfWeek: v })}
                                    >
                                        <SelectTrigger className="w-32">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {DAYS.map((d) => (
                                                <SelectItem key={d} value={d}>
                                                    {d}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}

                                <MyInput
                                    inputType="number"
                                    className="w-24"
                                    input={String(s.hour)}
                                    onChangeFunction={(e) =>
                                        patchSchedule(s.id, {
                                            hour: Math.min(23, Math.max(0, Number(e.target.value))),
                                        })
                                    }
                                />
                                <span className="text-caption text-neutral-500">
                                    hour ({config.timezone})
                                </span>
                            </div>

                            {/* ── Scope, and the fan-out guard ── */}
                            <div className="mb-3 flex flex-wrap items-center gap-3">
                                <Select
                                    value={s.scopeType}
                                    onValueChange={(v) =>
                                        patchSchedule(s.id, {
                                            scopeType: v as ReportSchedule['scopeType'],
                                        })
                                    }
                                >
                                    <SelectTrigger className="w-48">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SCOPES.map((sc) => (
                                            <SelectItem key={sc.v} value={sc.v}>
                                                {sc.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <MyButton buttonType="secondary" onClick={() => runPreview(s)}>
                                    Check how many reports
                                </MyButton>
                            </div>

                            {p && (
                                <div
                                    className={`mb-4 rounded-md border p-3 text-body ${
                                        p.exceedsCap
                                            ? 'border-danger-500 bg-danger-50 text-danger-700'
                                            : 'border-border bg-neutral-50'
                                    }`}
                                >
                                    <b>{p.documentsPerRun}</b> report
                                    {p.documentsPerRun === 1 ? '' : 's'} per run ×{' '}
                                    <b>{p.runsPerMonth}</b> runs = <b>{p.documentsPerMonth}</b> a
                                    month.
                                    {p.exceedsCap && (
                                        <span className="block">
                                            That is above the {MAX_DOCS_PER_RUN}-per-run limit and
                                            will not run. Narrow the scope.
                                        </span>
                                    )}
                                    {p.sampleLabels?.length > 1 && (
                                        <span className="block text-caption text-neutral-500">
                                            e.g. {p.sampleLabels.slice(0, 3).join(', ')}…
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* ── Who ── */}
                            <p className="mb-2 text-caption font-medium text-neutral-600">
                                Send to
                            </p>
                            <div className="mb-2 flex flex-wrap gap-4">
                                {ROLES.map((r) => (
                                    <label key={r} className="flex items-center gap-2 text-body">
                                        <Checkbox
                                            checked={s.recipients.roles.includes(r)}
                                            onCheckedChange={(v) =>
                                                patchSchedule(s.id, {
                                                    recipients: {
                                                        ...s.recipients,
                                                        roles: v
                                                            ? [...s.recipients.roles, r]
                                                            : s.recipients.roles.filter(
                                                                  (x) => x !== r
                                                              ),
                                                    },
                                                })
                                            }
                                        />
                                        {r}
                                    </label>
                                ))}
                            </div>
                            <p className="mb-4 text-caption text-neutral-500">
                                Only people with an account can receive these — reports can name
                                learners, so there is no free-text email option. Teachers are
                                automatically limited to their own batches.
                            </p>

                            <SettingToggleRow
                                label="Skip when there is nothing to report"
                                description="Recommended. Otherwise a quiet week still sends an empty report."
                                control={
                                    <Switch
                                        checked={s.skipIfNoData}
                                        onCheckedChange={(v) =>
                                            patchSchedule(s.id, { skipIfNoData: v })
                                        }
                                    />
                                }
                            />
                        </div>
                    );
                })}

                <MyButton
                    buttonType="secondary"
                    onClick={() =>
                        setConfig((c) => ({ ...c, schedules: [...c.schedules, newSchedule()] }))
                    }
                >
                    Add a schedule
                </MyButton>

                {/* ── Delivery history / audit ── */}
                <div>
                    <p className="mb-2 text-subtitle font-medium">Recent reports</p>
                    {runsError ? (
                        <p className="text-caption text-danger-600">
                            Could not load delivery history.
                        </p>
                    ) : runs.length === 0 && !runsLoading ? (
                        <p className="text-caption text-neutral-500">
                            Nothing sent yet. Reports appear here once a schedule runs.
                        </p>
                    ) : (
                        <MyTable<ReportRun>
                            data={{
                                content: runs,
                                total_pages: 1,
                                page_no: 0,
                                page_size: runs.length,
                                total_elements: runs.length,
                                last: true,
                            }}
                            columns={runColumns}
                            isLoading={runsLoading}
                            error={runsError}
                            currentPage={0}
                        />
                    )}
                </div>
            </div>
        </SettingsPageShell>
    );
}
