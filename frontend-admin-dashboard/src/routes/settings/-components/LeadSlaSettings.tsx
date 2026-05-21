import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { MyButton } from '@/components/design-system/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { X } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { getAllRoles } from '@/routes/manage-custom-teams/-services/custom-team-services';
import {
    useLeadSlaConfig,
    saveLeadSlaConfig,
    LEAD_SLA_CONFIG_QUERY_KEY,
    type LeadSlaSettings as SlaConfig,
} from '@/hooks/use-lead-sla-config';

// Multi-select of the institute's roles → saved with the SLA config and passed into the workflow
// trigger (ctx.notifyRoles). The backend never notifies directly.
function NotifyRolesPicker({
    roleNames,
    selected,
    onChange,
}: {
    roleNames: string[];
    selected: string[];
    onChange: (next: string[]) => void;
}) {
    const available = roleNames.filter((r) => !selected.includes(r));
    return (
        <div>
            <p className="text-sm font-medium">Notify which roles</p>
            <p className="text-xs text-muted-foreground">
                These roles are sent to your workflow so it can notify them. Pick the message and channel
                under Settings → Automations.
            </p>
            {selected.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                    {selected.map((name) => (
                        <span
                            key={name}
                            className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-1 text-xs font-medium text-primary-600"
                        >
                            {name}
                            <button
                                type="button"
                                aria-label={`Remove ${name}`}
                                onClick={() => onChange(selected.filter((r) => r !== name))}
                                className="rounded-full p-0.5 hover:bg-primary-200"
                            >
                                <X className="size-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
            <div className="mt-2">
                <Select
                    value=""
                    onValueChange={(name) => {
                        if (name && !selected.includes(name)) onChange([...selected, name]);
                    }}
                >
                    <SelectTrigger className="w-64">
                        <SelectValue
                            placeholder={selected.length === 0 ? 'Select roles to notify…' : 'Add another role…'}
                        />
                    </SelectTrigger>
                    <SelectContent>
                        {roleNames.length === 0 ? (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                No roles found for this institute.
                            </div>
                        ) : available.length === 0 ? (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">All roles added.</div>
                        ) : (
                            available.map((name) => (
                                <SelectItem key={name} value={name}>
                                    {name}
                                </SelectItem>
                            ))
                        )}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}

/**
 * Table-backed TAT + Follow-up SLA settings (replaces the JSON tatReminder/followUp cards).
 * Reads/writes via the lead-sla-config endpoint. Emit-only: the workflow engine delivers.
 */
export default function LeadSlaSettings() {
    const queryClient = useQueryClient();
    const { config, isLoading } = useLeadSlaConfig();

    const [draft, setDraft] = useState<SlaConfig>(config);
    const [hasChanges, setHasChanges] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setDraft(config);
        setHasChanges(false);
    }, [config]);

    const { data: rolesData } = useQuery({
        queryKey: ['institute-roles-for-lead-notify'],
        queryFn: getAllRoles,
        staleTime: 5 * 60 * 1000,
    });
    const roleNames: string[] = Array.isArray(rolesData)
        ? Array.from(new Set(rolesData.map((r: { name?: string }) => r?.name).filter(Boolean) as string[]))
        : [];

    const patch = (p: Partial<SlaConfig>) => {
        setDraft((prev) => ({ ...prev, ...p }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveLeadSlaConfig(draft);
            await queryClient.invalidateQueries({ queryKey: LEAD_SLA_CONFIG_QUERY_KEY });
            toast.success('Reminder settings saved');
            setHasChanges(false);
        } catch {
            toast.error('Failed to save reminder settings');
        } finally {
            setSaving(false);
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                    Loading reminder settings…
                </CardContent>
            </Card>
        );
    }

    const beforeMinutes = draft.tat_before_minutes ?? [];

    return (
        <>
            {/* ── New Lead Response Time ── */}
            <Card>
                <CardHeader>
                    <CardTitle>New Lead Response Time</CardTitle>
                    <CardDescription>
                        Make sure new leads get contacted quickly. If the assigned counsellor doesn&apos;t
                        reach out in time, they&apos;ll be reminded. Choose how they&apos;re notified (email,
                        WhatsApp, in-app) under <span className="font-medium">Settings → Automations</span>.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                        <Switch
                            id="tat-enabled"
                            checked={draft.tat_enabled}
                            onCheckedChange={(v) => patch({ tat_enabled: v })}
                        />
                        <Label htmlFor="tat-enabled" className="cursor-pointer">
                            {draft.tat_enabled ? 'On' : 'Off'}
                        </Label>
                    </div>

                    {draft.tat_enabled && (
                        <>
                            <div className="rounded-md bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
                                <span className="font-semibold">In plain words: </span>
                                a new lead should be contacted within{' '}
                                <span className="font-semibold">
                                    {draft.tat_hours} hour{draft.tat_hours === 1 ? '' : 's'}
                                </span>
                                .{' '}
                                {beforeMinutes.length > 0 && (
                                    <>
                                        The counsellor is reminded{' '}
                                        <span className="font-semibold">
                                            {beforeMinutes.map((m) => `${m} min`).join(' and ')}
                                        </span>{' '}
                                        before the deadline.{' '}
                                    </>
                                )}
                                If still untouched, the lead is flagged{' '}
                                <span className="font-semibold">overdue</span>.
                            </div>

                            <div className="grid grid-cols-[1fr_120px] items-center gap-4">
                                <div>
                                    <p className="text-sm font-medium">Respond to a new lead within</p>
                                    <p className="text-xs text-muted-foreground">
                                        After this much time without contact, the lead is overdue.
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        min={1}
                                        value={draft.tat_hours}
                                        onChange={(e) => patch({ tat_hours: parseInt(e.target.value, 10) || 24 })}
                                        className="w-20 text-center"
                                    />
                                    <span className="text-sm text-muted-foreground">hours</span>
                                </div>
                            </div>

                            <Separator />

                            <div>
                                <p className="text-sm font-medium">Early reminders (optional)</p>
                                <p className="text-xs text-muted-foreground">
                                    Give the counsellor a heads-up before the deadline. Add more than one to
                                    remind them again as it gets closer.
                                </p>
                            </div>
                            {beforeMinutes.map((m, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">Remind</span>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={m}
                                        onChange={(e) => {
                                            const list = [...beforeMinutes];
                                            list[i] = parseInt(e.target.value, 10) || 0;
                                            patch({ tat_before_minutes: list });
                                        }}
                                        className="w-24 text-center"
                                    />
                                    <span className="text-sm text-muted-foreground">
                                        minutes before the deadline
                                    </span>
                                    <MyButton
                                        buttonType="secondary"
                                        scale="small"
                                        onClick={() =>
                                            patch({
                                                tat_before_minutes: beforeMinutes.filter((_, idx) => idx !== i),
                                            })
                                        }
                                    >
                                        Remove
                                    </MyButton>
                                </div>
                            ))}
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                onClick={() => patch({ tat_before_minutes: [...beforeMinutes, 30] })}
                            >
                                + Add an early reminder
                            </MyButton>

                            <Separator />

                            <NotifyRolesPicker
                                roleNames={roleNames}
                                selected={draft.tat_notify_roles ?? []}
                                onChange={(roles) => patch({ tat_notify_roles: roles })}
                            />
                        </>
                    )}
                </CardContent>
            </Card>

            {/* ── Follow-up Reminders ── */}
            <Card>
                <CardHeader>
                    <CardTitle>Follow-up Reminders</CardTitle>
                    <CardDescription>
                        Keep counsellors following up. Once they&apos;ve contacted a lead, they&apos;ll be
                        reminded to follow up again within the time you set. The clock restarts every time
                        they log a new activity (call, note, meeting).
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                        <Switch
                            id="followup-enabled"
                            checked={draft.followup_enabled}
                            onCheckedChange={(v) => patch({ followup_enabled: v })}
                        />
                        <Label htmlFor="followup-enabled" className="cursor-pointer">
                            {draft.followup_enabled ? 'On' : 'Off'}
                        </Label>
                    </div>

                    {draft.followup_enabled && (
                        <>
                            <div className="rounded-md bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
                                <span className="font-semibold">In plain words: </span>
                                after a counsellor logs an activity on a lead, they have{' '}
                                <span className="font-semibold">
                                    {draft.followup_sla_hours} hour{draft.followup_sla_hours === 1 ? '' : 's'}
                                </span>{' '}
                                to follow up again, with a nudge{' '}
                                <span className="font-semibold">
                                    {draft.followup_remind_before_minutes} min
                                </span>{' '}
                                before it&apos;s due. The timer restarts each time they act.
                            </div>

                            <div className="grid grid-cols-[1fr_120px] items-center gap-4">
                                <div>
                                    <p className="text-sm font-medium">Follow up again within</p>
                                    <p className="text-xs text-muted-foreground">
                                        Time allowed between contacts before the lead is flagged.
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        min={1}
                                        value={draft.followup_sla_hours}
                                        onChange={(e) =>
                                            patch({ followup_sla_hours: parseInt(e.target.value, 10) || 24 })
                                        }
                                        className="w-20 text-center"
                                    />
                                    <span className="text-sm text-muted-foreground">hours</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-[1fr_120px] items-center gap-4">
                                <div>
                                    <p className="text-sm font-medium">Early reminder</p>
                                    <p className="text-xs text-muted-foreground">
                                        Nudge the counsellor this long before the follow-up is due.
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        min={1}
                                        value={draft.followup_remind_before_minutes}
                                        onChange={(e) =>
                                            patch({
                                                followup_remind_before_minutes:
                                                    parseInt(e.target.value, 10) || 30,
                                            })
                                        }
                                        className="w-20 text-center"
                                    />
                                    <span className="text-sm text-muted-foreground">minutes</span>
                                </div>
                            </div>

                            <Separator />

                            <NotifyRolesPicker
                                roleNames={roleNames}
                                selected={draft.followup_notify_roles ?? []}
                                onChange={(roles) => patch({ followup_notify_roles: roles })}
                            />
                        </>
                    )}

                    <div className="flex items-center justify-end border-t border-neutral-200 pt-3">
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            onClick={handleSave}
                            disable={saving || !hasChanges}
                        >
                            {saving ? 'Saving…' : 'Save reminder settings'}
                        </MyButton>
                    </div>
                </CardContent>
            </Card>
        </>
    );
}
