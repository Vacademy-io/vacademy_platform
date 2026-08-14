import { useEffect, useState } from 'react';
import { Minus, Phone, Plus } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** Sentinel for "no call-history filter" — the Select can't hold an empty value. */
export const CALL_HISTORY_ANY = 'ANY';

/** Filter values that read an accompanying attempt count (LeadFilterDTO.callCountValue). */
export const CALLED_N_TIMES = 'CALLED_N_TIMES';
export const CALLED_N_PLUS_TIMES = 'CALLED_N_PLUS_TIMES';

export const MIN_CALL_COUNT = 1;
export const MAX_CALL_COUNT = 99;
/** Starting N when the admin first picks one of the count-driven options. */
export const DEFAULT_CALL_COUNT = 3;

/** True when `value` is one of the count-driven options, i.e. the stepper applies. */
export function isCallCountFilter(value: string | undefined | null): boolean {
    return value === CALLED_N_TIMES || value === CALLED_N_PLUS_TIMES;
}

/** Clamp to the supported range, falling back to the default for anything unparseable. */
export function normalizeCallCount(value: number | string | undefined | null): number {
    const parsed = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed)) return DEFAULT_CALL_COUNT;
    return Math.min(MAX_CALL_COUNT, Math.max(MIN_CALL_COUNT, Math.trunc(parsed)));
}

interface CallHistoryFilterProps {
    /** Current filter value; '' (or undefined) means no filter. */
    value: string;
    /** Emits '' to clear, otherwise the selected filter value. */
    onValueChange: (value: string) => void;
    /** N for the count-driven options. Ignored by every other value. */
    count: number;
    onCountChange: (count: number) => void;
    className?: string;
}

/**
 * Call-history filter for the leads lists: has this lead been call-attempted,
 * by whom, and how many times.
 *
 * The fixed CALLED_ONCE / CALLED_TWICE_PLUS options are kept as-is (existing
 * deep links and saved views still resolve), with CALLED_N_TIMES /
 * CALLED_N_PLUS_TIMES generalising them to an arbitrary N. Picking either
 * reveals a stepper that can be nudged with the +/- buttons or typed into
 * directly for larger values.
 */
export function CallHistoryFilter({
    value,
    onValueChange,
    count,
    onCountChange,
    className,
}: CallHistoryFilterProps) {
    const showStepper = isCallCountFilter(value);

    // Draft copy so the field can be emptied mid-typing ("1" → "" → "11")
    // without the parent snapping it back to the clamped minimum on every
    // keystroke. Committed on valid input, clamped on blur.
    const [draft, setDraft] = useState(String(count));
    useEffect(() => {
        setDraft(String(count));
    }, [count, value]);

    const step = (delta: number) => {
        const next = normalizeCallCount(count + delta);
        setDraft(String(next));
        onCountChange(next);
    };

    return (
        <div className={cn('flex items-center gap-1.5', className)}>
            <Select
                value={value || CALL_HISTORY_ANY}
                onValueChange={(v) => onValueChange(v === CALL_HISTORY_ANY ? '' : v)}
            >
                <SelectTrigger className="h-10 w-44">
                    <Phone className="mr-1.5 size-4 shrink-0 text-neutral-400" />
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={CALL_HISTORY_ANY}>Call history</SelectItem>
                    <SelectItem value="NOT_CALLED">Not called</SelectItem>
                    <SelectItem value="CALLED">Called (any)</SelectItem>
                    <SelectItem value="CALLED_ONCE">Called once</SelectItem>
                    <SelectItem value="CALLED_TWICE_PLUS">Called 2+ times</SelectItem>
                    <SelectItem value={CALLED_N_TIMES}>Called exactly…</SelectItem>
                    <SelectItem value={CALLED_N_PLUS_TIMES}>Called at least…</SelectItem>
                    <SelectItem value="AI_CALLED">AI called</SelectItem>
                    <SelectItem value="MANUAL_CALLED">Manually called</SelectItem>
                </SelectContent>
            </Select>
            {showStepper && (
                <div className="flex h-10 items-center gap-0.5 rounded-md border border-primary-300 bg-primary-50 px-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        aria-label="Decrease call count"
                        disabled={count <= MIN_CALL_COUNT}
                        onClick={() => step(-1)}
                    >
                        <Minus className="size-3.5" />
                    </Button>
                    <Input
                        type="number"
                        inputMode="numeric"
                        min={MIN_CALL_COUNT}
                        max={MAX_CALL_COUNT}
                        aria-label="Number of calls"
                        value={draft}
                        onChange={(e) => {
                            const raw = e.target.value;
                            setDraft(raw);
                            if (raw.trim() === '') return;
                            const parsed = parseInt(raw, 10);
                            if (Number.isFinite(parsed)) {
                                onCountChange(normalizeCallCount(parsed));
                            }
                        }}
                        onBlur={() => {
                            const next = normalizeCallCount(draft);
                            setDraft(String(next));
                            onCountChange(next);
                        }}
                        className="h-8 w-12 border-0 bg-transparent px-1 text-center text-sm shadow-none focus-visible:ring-0"
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        aria-label="Increase call count"
                        disabled={count >= MAX_CALL_COUNT}
                        onClick={() => step(1)}
                    >
                        <Plus className="size-3.5" />
                    </Button>
                    <span className="pr-1 text-xs text-neutral-500">
                        {value === CALLED_N_PLUS_TIMES ? 'or more' : 'times'}
                    </span>
                </div>
            )}
        </div>
    );
}
