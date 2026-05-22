/**
 * Pool metadata: name, description, assignment mode.
 *
 * Two render modes:
 *   - Editing (always in create flow; toggleable in edit flow) → form inputs + Save/Cancel
 *   - Read-only (default once the pool exists) → values shown as plain text + Edit button
 *
 * After successful create, navigates to the new pool's edit URL with
 * `?tab=audiences` so the admin lands on the next step automatically.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MyButton } from '@/components/design-system/button';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    AssignmentMode,
    CounselorPoolDTO,
    useCreatePool,
    useUpdatePool,
} from '@/services/counselor-pool';

interface OverviewTabProps {
    pool: CounselorPoolDTO | null;
}

const MODE_OPTIONS: { value: AssignmentMode; label: string; description: string }[] = [
    {
        value: 'MANUAL',
        label: 'Manual',
        description:
            'No auto-assignment. Leads land unassigned; a human picks the counselor later.',
    },
    {
        value: 'ROUND_ROBIN',
        label: 'Round-robin',
        description: 'Cycle through pool counselors by display order, per campaign.',
    },
    {
        value: 'TIME_BASED',
        label: 'Time-based',
        description:
            'Pick from counselors who are on their scheduled shift right now. Requires a 24/7 weekly schedule.',
    },
];

export default function OverviewTab({ pool }: OverviewTabProps) {
    const navigate = useNavigate();
    const isCreating = pool === null;

    // Editing toggle: always true while creating; admin-toggled while editing an existing pool.
    const [editing, setEditing] = useState(isCreating);

    const [name, setName] = useState(pool?.name ?? '');
    const [description, setDescription] = useState(pool?.description ?? '');
    const [mode, setMode] = useState<AssignmentMode>(pool?.assignment_mode ?? 'ROUND_ROBIN');

    useEffect(() => {
        if (pool) {
            setName(pool.name);
            setDescription(pool.description ?? '');
            setMode(pool.assignment_mode);
        }
    }, [pool]);

    const { mutate: createPool, isPending: creating } = useCreatePool();
    const { mutate: updatePool, isPending: updating } = useUpdatePool(pool?.id ?? '');

    const saving = creating || updating;
    const dirty = !pool
        ? name.trim().length > 0
        : name !== pool.name ||
          description !== (pool.description ?? '') ||
          mode !== pool.assignment_mode;

    const startEdit = () => {
        if (pool) {
            setName(pool.name);
            setDescription(pool.description ?? '');
            setMode(pool.assignment_mode);
        }
        setEditing(true);
    };

    const cancelEdit = () => {
        if (pool) {
            setName(pool.name);
            setDescription(pool.description ?? '');
            setMode(pool.assignment_mode);
        }
        setEditing(false);
    };

    const handleSave = () => {
        if (!name.trim()) {
            toast.error('Pool name is required');
            return;
        }

        if (isCreating) {
            createPool(
                {
                    institute_id: getCurrentInstituteId() ?? '',
                    name: name.trim(),
                    description: description.trim() || undefined,
                    assignment_mode: mode,
                },
                {
                    onSuccess: (created) => {
                        toast.success(`Pool "${created.name}" created`);
                        // Land on the Audiences tab so the admin's next obvious step
                        // (attach a campaign) is one click away.
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        navigate({
                            to: '/settings/leads/pools/$poolId',
                            params: { poolId: created.id },
                            search: { tab: 'audiences' },
                        } as any);
                    },
                    onError: (err) => toast.error(extractError(err) ?? 'Failed to create pool'),
                }
            );
            return;
        }

        updatePool(
            {
                name: name.trim(),
                description: description.trim() || undefined,
                assignment_mode: mode,
            },
            {
                onSuccess: () => {
                    toast.success('Pool updated');
                    setEditing(false);
                },
                onError: (err) => toast.error(extractError(err) ?? 'Failed to update pool'),
            }
        );
    };

    // ── Read-only view (only for existing pool, when not editing) ─────────────
    if (pool && !editing) {
        const modeOpt = MODE_OPTIONS.find((m) => m.value === pool.assignment_mode);
        return (
            <div className="space-y-6">
                <Card>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0">
                        <div>
                            <CardTitle>Pool Details</CardTitle>
                            <CardDescription>
                                Name, description, and assignment mode for this pool.
                            </CardDescription>
                        </div>
                        <MyButton buttonType="secondary" scale="small" onClick={startEdit}>
                            Edit
                        </MyButton>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <ReadField label="Name" value={pool.name} />
                        <ReadField
                            label="Description"
                            value={pool.description?.trim() || '—'}
                        />
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Assignment Mode
                            </p>
                            <div className="flex items-center gap-2">
                                <Badge className="bg-primary-100 text-primary-700">
                                    {modeOpt?.label ?? pool.assignment_mode}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                    {modeOpt?.description}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // ── Editing view (create flow OR admin clicked Edit) ──────────────────────
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Pool Details</CardTitle>
                    <CardDescription>
                        Give the pool a clear name so admins know which team it represents.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="pool-name">Name *</Label>
                        <Input
                            id="pool-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Class 11 Counselors"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="pool-desc">Description</Label>
                        <Textarea
                            id="pool-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional notes about who this pool covers"
                            rows={3}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Assignment Mode</CardTitle>
                    <CardDescription>
                        How leads from this pool's campaigns get auto-routed to a counselor.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Select value={mode} onValueChange={(v) => setMode(v as AssignmentMode)}>
                        <SelectTrigger className="w-full md:w-80">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {MODE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        {MODE_OPTIONS.find((o) => o.value === mode)?.description}
                    </p>
                    {isCreating && (
                        <p className="rounded border border-warning-200 bg-warning-50 p-3 text-xs text-warning-700">
                            After creating the pool, you'll be taken to the Audiences tab to
                            attach campaigns. You can add counselors and (if Time-based) the
                            weekly schedule from the other tabs.
                        </p>
                    )}
                </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
                {!isCreating && (
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={cancelEdit}
                        disable={saving}
                    >
                        Cancel
                    </MyButton>
                )}
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    onClick={handleSave}
                    disable={saving || !dirty}
                >
                    {saving ? 'Saving…' : isCreating ? 'Create Pool' : 'Save Changes'}
                </MyButton>
            </div>
        </div>
    );
}

function ReadField({ label, value }: { label: string; value: string }) {
    return (
        <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-sm">{value}</p>
        </div>
    );
}

function extractError(err: unknown): string | undefined {
    return (
        (err as { response?: { data?: { ex?: string; message?: string } } })?.response?.data?.ex ??
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
    );
}
