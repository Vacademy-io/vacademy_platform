/**
 * Pool metadata form — name, description, assignment_mode.
 * Doubles as the create form when no pool exists yet.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        navigate({
                            to: '/settings/leads/pools/$poolId',
                            params: { poolId: created.id },
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
                onSuccess: () => toast.success('Pool updated'),
                onError: (err) => toast.error(extractError(err) ?? 'Failed to update pool'),
            }
        );
    };

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
                        <p className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                            After creating the pool, you can add campaigns, counselors, and (if
                            using Time-based) the weekly schedule from the other tabs.
                        </p>
                    )}
                </CardContent>
            </Card>

            <div className="flex justify-end">
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

function extractError(err: unknown): string | undefined {
    return (
        (err as { response?: { data?: { ex?: string; message?: string } } })?.response?.data?.ex ??
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
    );
}
