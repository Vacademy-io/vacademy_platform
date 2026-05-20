import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ArrowsClockwise, X, FunnelSimple, DownloadSimple } from '@phosphor-icons/react';
import {
    exportActivityLogsCsv,
    type AdminActivityLogFilters,
} from '@/services/admin-activity-logs/getActivityLogs';
import { toast } from 'sonner';

interface Props {
    value: AdminActivityLogFilters;
    onChange: (next: Partial<AdminActivityLogFilters>) => void;
    onRefresh: () => void;
    isFetching: boolean;
}

// Curated dropdown choices. Keep `value` aligned with the entity_type / action
// strings the backend emits in @Auditable annotations; `label` is what an
// institute owner reads. Add new entries here as the audit coverage grows.
const RESOURCE_OPTIONS: { value: string; label: string }[] = [
    { value: 'COURSE', label: 'Course' },
    { value: 'LIVE_SESSION', label: 'Live session' },
    { value: 'LEARNER', label: 'Learner' },
    { value: 'INSTITUTE_SETTING', label: 'Settings' },
];

const ACTIVITY_OPTIONS: { value: string; label: string }[] = [
    { value: 'CREATE', label: 'Created' },
    { value: 'UPDATE', label: 'Updated' },
    { value: 'DELETE', label: 'Deleted' },
    { value: 'CANCEL', label: 'Cancelled' },
    { value: 'ENROLL', label: 'Enrolled' },
];

// Sentinel value used in the Select for "any" (Radix Select doesn't allow
// empty-string SelectItem values).
const ANY = '__any__';

const toDateInput = (epochMs: number | undefined) =>
    epochMs ? new Date(epochMs).toISOString().slice(0, 10) : '';

const fromDateInput = (value: string): number | undefined =>
    value ? new Date(`${value}T00:00:00.000Z`).getTime() : undefined;

const countActiveFilters = (value: AdminActivityLogFilters): number => {
    let n = 0;
    if (value.entityType) n++;
    if (value.action) n++;
    if (value.actorId) n++;
    if (value.startDate) n++;
    if (value.endDate) n++;
    return n;
};

export function ActivityLogFilters({ value, onChange, onRefresh, isFetching }: Props) {
    const activeCount = countActiveFilters(value);
    const [isExporting, setIsExporting] = useState(false);

    const clearAll = () =>
        onChange({
            entityType: undefined,
            action: undefined,
            actorId: undefined,
            startDate: undefined,
            endDate: undefined,
            page: 0,
        });

    const handleExport = async () => {
        setIsExporting(true);
        try {
            await exportActivityLogsCsv({
                entityType: value.entityType,
                action: value.action,
                actorId: value.actorId,
                entityId: value.entityId,
                startDate: value.startDate,
                endDate: value.endDate,
            });
            toast.success('Activity logs CSV downloaded');
        } catch (e) {
            toast.error('Failed to export activity logs');
            // eslint-disable-next-line no-console
            console.error('Activity logs CSV export failed', e);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Card className="border-gray-200 shadow-sm">
            <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <FunnelSimple className="size-4" />
                        Filters
                        {activeCount > 0 && (
                            <Badge variant="secondary" className="ml-1">
                                {activeCount} active
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {activeCount > 0 && (
                            <Button variant="ghost" size="sm" onClick={clearAll}>
                                <X className="mr-1 size-4" /> Clear
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onRefresh}
                            disabled={isFetching}
                        >
                            <ArrowsClockwise
                                className={`mr-1 size-4 ${isFetching ? 'animate-spin' : ''}`}
                            />
                            Refresh
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExport}
                            disabled={isExporting}
                            title="Download a CSV of all rows matching the current filters (max 50,000)"
                        >
                            <DownloadSimple
                                className={`mr-1 size-4 ${isExporting ? 'animate-pulse' : ''}`}
                            />
                            {isExporting ? 'Exporting…' : 'Export CSV'}
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <Field label="Resource">
                        <Select
                            value={value.entityType ?? ANY}
                            onValueChange={(v) =>
                                onChange({ entityType: v === ANY ? undefined : v })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Any resource" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ANY}>Any resource</SelectItem>
                                {RESOURCE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Activity">
                        <Select
                            value={value.action ?? ANY}
                            onValueChange={(v) =>
                                onChange({ action: v === ANY ? undefined : v })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Any activity" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ANY}>Any activity</SelectItem>
                                {ACTIVITY_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Performed by (user ID)">
                        <Input
                            placeholder="Paste a user ID"
                            value={value.actorId ?? ''}
                            onChange={(e) => onChange({ actorId: e.target.value || undefined })}
                        />
                    </Field>
                    <Field label="From">
                        <Input
                            type="date"
                            value={toDateInput(value.startDate)}
                            onChange={(e) =>
                                onChange({ startDate: fromDateInput(e.target.value) })
                            }
                        />
                    </Field>
                    <Field label="To">
                        <Input
                            type="date"
                            value={toDateInput(value.endDate)}
                            onChange={(e) => onChange({ endDate: fromDateInput(e.target.value) })}
                        />
                    </Field>
                </div>
            </CardContent>
        </Card>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-600">
            {label}
            {children}
        </label>
    );
}
