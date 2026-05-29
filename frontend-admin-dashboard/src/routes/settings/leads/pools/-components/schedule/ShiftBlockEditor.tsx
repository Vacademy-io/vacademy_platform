/**
 * Renders one shift block row: start time, end time, optional label, the
 * multi-counsellor picker, and a remove button. Used by both editors
 * (per-day and same-hours-all-days) so the look-and-feel is identical.
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { type EditableShift, padToFullTime, trimToHM } from './shared';

interface Props {
    shift: EditableShift;
    counselorOptions: { id: string; name: string }[];
    /** Optional inline error message shown under the block. */
    error?: string;
    /** Optional inline-removal flag for the only-block case (e.g. UI B with one block). */
    canRemove?: boolean;
    onRemove: () => void;
    onUpdate: (patch: Partial<EditableShift>) => void;
    /** Optional override for the "End" label tooltip; UI B uses it to explain midnight wrap. */
    endLabel?: string;
}

export default function ShiftBlockEditor({
    shift,
    counselorOptions,
    error,
    canRemove = true,
    onRemove,
    onUpdate,
    endLabel,
}: Props) {
    const availableToAdd = counselorOptions.filter(
        (c) => !shift.counselorUserIds.includes(c.id)
    );

    return (
        <div
            className={
                'rounded border p-3 ' +
                (error ? 'border-red-300 bg-red-50' : 'border-neutral-200 bg-neutral-50')
            }
        >
            <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                    <Label className="text-xs">Start</Label>
                    <Input
                        type="time"
                        step={60}
                        value={trimToHM(shift.startTime)}
                        onChange={(e) =>
                            onUpdate({ startTime: padToFullTime(e.target.value) })
                        }
                        className="w-32"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">End{endLabel ? ` (${endLabel})` : ''}</Label>
                    <Input
                        type="time"
                        step={60}
                        value={trimToHM(shift.endTime)}
                        onChange={(e) =>
                            onUpdate({ endTime: padToFullTime(e.target.value) })
                        }
                        className="w-32"
                    />
                </div>
                <div className="flex-1 space-y-1">
                    <Label className="text-xs">Label (optional)</Label>
                    <Input
                        value={shift.label ?? ''}
                        onChange={(e) => onUpdate({ label: e.target.value })}
                        placeholder="e.g. Morning shift"
                    />
                </div>
                {canRemove && (
                    <button
                        type="button"
                        className="self-end pb-2 text-xs text-red-600 hover:underline"
                        onClick={onRemove}
                    >
                        Remove
                    </button>
                )}
            </div>

            <div className="mt-3 space-y-2">
                <Label className="text-xs">Counsellors on this shift</Label>
                <div className="flex flex-wrap gap-2">
                    {shift.counselorUserIds.length === 0 && (
                        <span className="text-xs text-muted-foreground">
                            None selected — add at least one
                        </span>
                    )}
                    {shift.counselorUserIds.map((id) => (
                        <Badge
                            key={id}
                            className="cursor-pointer bg-blue-100 text-blue-700 hover:bg-red-100 hover:text-red-700"
                            onClick={() =>
                                onUpdate({
                                    counselorUserIds: shift.counselorUserIds.filter(
                                        (c) => c !== id
                                    ),
                                })
                            }
                        >
                            {counselorOptions.find((c) => c.id === id)?.name ?? id} ×
                        </Badge>
                    ))}
                </div>
                {availableToAdd.length > 0 && (
                    <Select
                        value=""
                        onValueChange={(v) =>
                            onUpdate({ counselorUserIds: [...shift.counselorUserIds, v] })
                        }
                    >
                        <SelectTrigger className="w-64">
                            <SelectValue placeholder="+ Add counsellor" />
                        </SelectTrigger>
                        <SelectContent>
                            {availableToAdd.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
        </div>
    );
}
