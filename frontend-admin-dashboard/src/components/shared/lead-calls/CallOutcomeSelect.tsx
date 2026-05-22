import { useRef, useState } from 'react';
import { CaretDown, Check, PencilSimple, ArrowLeft } from '@phosphor-icons/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CALL_OUTCOMES, CALL_OUTCOME_LABELS } from './call-activity';

interface CallOutcomeSelectProps {
    value?: string;
    onChange: (value: string | undefined) => void;
}

/**
 * Styled outcome/disposition picker for the Call Log. Lists the preset
 * dispositions and an "Other…" entry that switches to a free-text input so a
 * custom status can be typed.
 */
export const CallOutcomeSelect = ({ value, onChange }: CallOutcomeSelectProps) => {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<'list' | 'custom'>('list');
    const [customText, setCustomText] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const isPreset = value ? (CALL_OUTCOMES as readonly string[]).includes(value) : false;
    const label = value ? (CALL_OUTCOME_LABELS[value] ?? value) : null;

    const reset = () => {
        setMode('list');
        setCustomText('');
    };
    const close = () => {
        setOpen(false);
        reset();
    };
    const select = (next: string | undefined) => {
        onChange(next);
        close();
    };
    const openCustom = () => {
        setCustomText(isPreset ? '' : (value ?? ''));
        setMode('custom');
        setTimeout(() => inputRef.current?.focus(), 0);
    };
    const submitCustom = () => {
        const trimmed = customText.trim();
        if (trimmed) select(trimmed);
    };

    return (
        <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={`flex h-7 w-52 items-center justify-between gap-2 rounded-lg border px-2.5 text-xs transition-colors ${
                        value
                            ? 'border-primary-200 bg-primary-50 text-primary-700'
                            : 'border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50'
                    }`}
                >
                    <span className="truncate">{label ?? 'Outcome…'}</span>
                    <CaretDown className="size-3.5 shrink-0 opacity-60" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" portal={false} className="w-56 p-1">
                {mode === 'list' ? (
                    <div className="flex max-h-64 flex-col overflow-y-auto">
                        {value && (
                            <button
                                type="button"
                                onClick={() => select(undefined)}
                                className="rounded-md px-2 py-1.5 text-left text-xs text-neutral-400 hover:bg-neutral-100"
                            >
                                Clear
                            </button>
                        )}
                        {CALL_OUTCOMES.map((o) => {
                            const active = value === o;
                            return (
                                <button
                                    key={o}
                                    type="button"
                                    onClick={() => select(o)}
                                    className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-neutral-100 ${
                                        active ? 'font-medium text-primary-700' : 'text-neutral-700'
                                    }`}
                                >
                                    {CALL_OUTCOME_LABELS[o] ?? o}
                                    {active && <Check className="size-3.5 text-primary-600" />}
                                </button>
                            );
                        })}
                        <div className="my-1 h-px bg-neutral-100" />
                        <button
                            type="button"
                            onClick={openCustom}
                            className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-neutral-100 ${
                                value && !isPreset
                                    ? 'font-medium text-primary-700'
                                    : 'text-neutral-700'
                            }`}
                        >
                            <span className="flex items-center gap-1.5">
                                <PencilSimple className="size-3.5" /> Other…
                            </span>
                            {value && !isPreset && <Check className="size-3.5 text-primary-600" />}
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2 p-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-600">
                            <button
                                type="button"
                                onClick={reset}
                                className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                                title="Back"
                            >
                                <ArrowLeft className="size-3.5" />
                            </button>
                            Custom outcome
                        </div>
                        <input
                            ref={inputRef}
                            value={customText}
                            onChange={(e) => setCustomText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    submitCustom();
                                }
                            }}
                            placeholder="Type a status…"
                            className="h-8 w-full rounded-lg border border-neutral-200 px-2 text-xs text-neutral-700 focus:border-primary-300 focus:outline-none focus:ring-1 focus:ring-primary-300"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={reset}
                                className="rounded-lg px-2.5 py-1 text-xs text-neutral-500 hover:bg-neutral-100"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={submitCustom}
                                disabled={!customText.trim()}
                                className="rounded-lg bg-primary-500 px-2.5 py-1 text-xs text-white hover:bg-primary-600 disabled:opacity-50"
                            >
                                Add
                            </button>
                        </div>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
};

export default CallOutcomeSelect;
