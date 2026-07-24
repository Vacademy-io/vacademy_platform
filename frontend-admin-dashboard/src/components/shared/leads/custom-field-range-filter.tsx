import { useEffect, useMemo, useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
    EMPTY_SENTINEL,
    NOT_EMPTY_SENTINEL,
    decodeRange,
    encodeRange,
    sentinelLabel,
} from './custom-field-filter-encoding';

interface CustomFieldRangeFilterProps {
    /** custom_field_id (uuid). */
    fieldId: string;
    /** Display label, e.g. "Admission Date". */
    fieldName: string;
    /** 'DATE'/'DATETIME' → date inputs; anything else → number inputs. */
    fieldType: string;
    /** Sentinel-encoded selection (same string[] shape the multi-select uses). */
    selected: string[];
    onChange: (values: string[]) => void;
}

/**
 * Range popover for DATE and NUMBER custom fields — the typed-operator
 * counterpart of CustomFieldMultiSelectFilter. From/To bounds map to
 * BETWEEN (both), GTE (from only) or LTE (to only); "Empty (no value)" /
 * "Has any value" map to IS_EMPTY / NOT_EMPTY. The selection is emitted as
 * sentinel-encoded strings so every page keeps its existing string[] filter
 * state; payload builders decode via decodeSelectionToEntries.
 */
export function CustomFieldRangeFilter({
    fieldId,
    fieldName,
    fieldType,
    selected,
    onChange,
}: CustomFieldRangeFilterProps) {
    const isDate = (fieldType ?? '').toUpperCase().startsWith('DATE');
    const [open, setOpen] = useState(false);
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [emptyMode, setEmptyMode] = useState<
        '' | typeof EMPTY_SENTINEL | typeof NOT_EMPTY_SENTINEL
    >('');

    // Re-hydrate the popover inputs from the applied selection on open, so
    // reopening shows what's active (including after a page-level reset).
    useEffect(() => {
        if (!open) return;
        const range = selected.map(decodeRange).find(Boolean);
        if (range) {
            if (range.operator === 'BETWEEN') {
                setFrom(range.values[0] ?? '');
                setTo(range.values[1] ?? '');
            } else if (range.operator === 'GTE') {
                setFrom(range.values[0] ?? '');
                setTo('');
            } else {
                setFrom('');
                setTo(range.values[0] ?? '');
            }
        } else {
            setFrom('');
            setTo('');
        }
        setEmptyMode(
            selected.includes(EMPTY_SENTINEL)
                ? EMPTY_SENTINEL
                : selected.includes(NOT_EMPTY_SENTINEL)
                  ? NOT_EMPTY_SENTINEL
                  : ''
        );
    }, [open, selected]);

    const apply = () => {
        const next: string[] = [];
        if (emptyMode) {
            next.push(emptyMode);
        } else if (from && to) {
            // Swap inverted bounds — a reversed range would silently match
            // nothing. Dates compare lexicographically (ISO); numbers numerically.
            const inverted = isDate ? from > to : Number(from) > Number(to);
            next.push(encodeRange('BETWEEN', inverted ? [to, from] : [from, to]));
        } else if (from) {
            next.push(encodeRange('GTE', [from]));
        } else if (to) {
            next.push(encodeRange('LTE', [to]));
        }
        onChange(next);
        setOpen(false);
    };

    const clear = () => {
        setFrom('');
        setTo('');
        setEmptyMode('');
        onChange([]);
        setOpen(false);
    };

    const activeLabel = useMemo(() => {
        const labels = selected.map(sentinelLabel).filter(Boolean);
        return labels.length > 0 ? labels.join(', ') : null;
    }, [selected]);

    const inputType = isDate ? 'date' : 'number';

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Filter by ${fieldName}`}
                    className={cn(
                        'h-10 max-w-64 justify-between',
                        activeLabel && 'border-primary-300 bg-primary-50'
                    )}
                >
                    <span className="truncate text-sm font-normal">
                        {activeLabel ? `${fieldName} · ${activeLabel}` : fieldName}
                    </span>
                    <CaretDown className="size-4 shrink-0 text-neutral-400" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                        <Label className="text-xs text-neutral-600">From</Label>
                        <Input
                            type={inputType}
                            value={from}
                            disabled={Boolean(emptyMode)}
                            onChange={(e) => setFrom(e.target.value)}
                            className="h-9"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs text-neutral-600">To</Label>
                        <Input
                            type={inputType}
                            value={to}
                            disabled={Boolean(emptyMode)}
                            onChange={(e) => setTo(e.target.value)}
                            className="h-9"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                        <Label
                            htmlFor={`cf-range-empty-${fieldId}`}
                            className="text-xs text-neutral-600"
                        >
                            Empty (no value)
                        </Label>
                        <Switch
                            id={`cf-range-empty-${fieldId}`}
                            checked={emptyMode === EMPTY_SENTINEL}
                            onCheckedChange={(v) => setEmptyMode(v ? EMPTY_SENTINEL : '')}
                        />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <Label
                            htmlFor={`cf-range-notempty-${fieldId}`}
                            className="text-xs text-neutral-600"
                        >
                            Has any value
                        </Label>
                        <Switch
                            id={`cf-range-notempty-${fieldId}`}
                            checked={emptyMode === NOT_EMPTY_SENTINEL}
                            onCheckedChange={(v) => setEmptyMode(v ? NOT_EMPTY_SENTINEL : '')}
                        />
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-border pt-2">
                    <Button type="button" variant="ghost" size="sm" onClick={clear}>
                        Clear
                    </Button>
                    <Button type="button" size="sm" onClick={apply}>
                        Apply
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
