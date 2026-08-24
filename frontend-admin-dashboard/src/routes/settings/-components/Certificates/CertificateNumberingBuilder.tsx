import { useRef } from 'react';
import { Hash, Info, Warning } from '@phosphor-icons/react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/**
 * The certificate-number format builder.
 *
 * <p>Modelled on the invoice-number builder, for the same reason it exists
 * there: a bare text box asking for a format string invites an admin to type
 * the number they want rather than the shape of it. Typing
 * <code>{'{PREFIX}'}000111</code> looks like "start at 111" and is really a
 * constant — the same number on every certificate, which collides on the second
 * one issued, because the number is the certificate's identity.
 *
 * <p>So the sequence is not optional here, and the preview shows three
 * consecutive numbers rather than one: one sample can look right while the
 * format has no sequence in it at all, and three cannot.
 */

export interface CertificateNumberingValue {
    pattern: string;
    prefix: string;
    suffix: string;
    sequencePadding: number;
    /**
     * Where the series should begin. 0 means "no start number set" — the
     * counter just continues. It is a floor, not a set: a value at or below
     * what has already been issued is ignored rather than reusing a number
     * that is on a learner's certificate.
     */
    startFrom: number;
    /** Whether the counter restarts each 1 January. */
    resetAnnually: boolean;
}

interface Props {
    value: CertificateNumberingValue;
    onChange: (patch: Partial<CertificateNumberingValue>) => void;
    /** Format one sample, so the preview runs through the same code as the page. */
    formatSample: (value: CertificateNumberingValue, sequence: number) => string;
    /** Shown under the prefix field: what blank resolves to for this institute. */
    derivedPrefix: string;
    /**
     * Highest position this institute's counter has already handed out, for the
     * counter currently selected. 0 when nothing has been issued yet, undefined
     * while it is still being read.
     */
    highestIssuedSequence?: number;
    disabled?: boolean;
}

export const DEFAULT_CERTIFICATE_PATTERN = '{PREFIX}{YYYY}{SEQ:3}';

/** Whatever an admin composes, it has to contain one of these. */
export const SEQUENCE_TOKEN = /\{SEQ(?::\d+)?\}/;

/**
 * A format carrying neither of these repeats itself every January if the
 * counter resets — the first certificate of the new year formats to a number
 * already issued, and the number is the certificate's primary key.
 */
export const YEAR_TOKEN = /\{(YYYY|YY)\}/;

const TOKENS: Array<{ token: string; label: string; hint: string }> = [
    { token: '{SEQ}', label: 'Number', hint: 'The counter — 001, 002, 003. Required.' },
    { token: '{SEQ:4}', label: 'Number (4 digits)', hint: '0001, 0002 — set the width yourself' },
    { token: '{PREFIX}', label: 'Prefix', hint: 'The prefix set beside this field' },
    { token: '{YYYY}', label: 'Year', hint: '2026' },
    { token: '{YY}', label: 'Year (2-digit)', hint: '26' },
    { token: '{SUFFIX}', label: 'Suffix', hint: 'The suffix set beside this field' },
    { token: '{COURSE_CODE}', label: 'Course code', hint: 'Blank for courses with no code' },
];

const PRESETS: Array<{ label: string; pattern: string; padding: number }> = [
    { label: 'EDU2026001', pattern: '{PREFIX}{YYYY}{SEQ:3}', padding: 3 },
    { label: 'EDU-2026-0001', pattern: '{PREFIX}-{YYYY}-{SEQ:4}', padding: 4 },
    { label: 'EDU/26/001', pattern: '{PREFIX}/{YY}/{SEQ:3}', padding: 3 },
    { label: 'EDU0001', pattern: '{PREFIX}{SEQ:4}', padding: 4 },
];

export const CertificateNumberingBuilder = ({
    value,
    onChange,
    formatSample,
    derivedPrefix,
    highestIssuedSequence,
    disabled,
}: Props) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const pattern = value.pattern.trim() || DEFAULT_CERTIFICATE_PATTERN;
    const usingDefault = !value.pattern.trim();
    const hasSequence = SEQUENCE_TOKEN.test(pattern);
    const hasYearToken = YEAR_TOKEN.test(pattern);

    const issued = highestIssuedSequence ?? 0;
    const startFrom = value.startFrom > 0 ? value.startFrom : 0;

    // The number the next certificate actually gets. Mirrors the backend's
    // max(counter + 1, startFrom) exactly, so what the admin approves here is
    // what gets issued. Computed locally rather than refetched per keystroke —
    // only `issued` comes from the server, and it does not move as you type.
    const nextSequence = Math.max(issued + 1, startFrom, 1);

    // A start number at or below what is already issued cannot be honoured: the
    // number is the certificate's identity and those are already on real
    // documents. Say so, rather than letting the value look accepted.
    const startFromIgnored = startFrom > 0 && startFrom <= issued;

    // Three consecutive numbers. One sample can look perfectly sensible while
    // the format has no counter in it; three identical ones cannot be missed.
    const samples = [0, 1, 2].map((offset) =>
        formatSample({ ...value, pattern }, nextSequence + offset)
    );

    /** Insert at the caret, so editing mid-format doesn't mean retyping the rest. */
    const insertToken = (token: string) => {
        const input = inputRef.current;
        const current = value.pattern || (usingDefault ? DEFAULT_CERTIFICATE_PATTERN : '');
        if (!input) {
            onChange({ pattern: `${current}${token}` });
            return;
        }
        const start = input.selectionStart ?? current.length;
        const end = input.selectionEnd ?? current.length;
        onChange({ pattern: current.slice(0, start) + token + current.slice(end) });
        requestAnimationFrame(() => {
            input.focus();
            const caret = start + token.length;
            input.setSelectionRange(caret, caret);
        });
    };

    return (
        <div className="flex flex-col gap-5 rounded-md border p-4">
            <div>
                <div className="text-sm font-medium">Certificate numbering</div>
                <p className="text-xs text-muted-foreground">
                    Numbers come from a counter for this institute, so they are sequential and never
                    repeat. Choose the shape below, and where the count starts.
                </p>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label>Start from a common format</Label>
                <div className="flex flex-wrap gap-2">
                    {PRESETS.map((preset) => (
                        <Button
                            key={preset.pattern}
                            type="button"
                            size="sm"
                            disabled={disabled}
                            variant={pattern === preset.pattern ? 'default' : 'outline'}
                            onClick={() =>
                                onChange({
                                    pattern: preset.pattern,
                                    sequencePadding: preset.padding,
                                })
                            }
                        >
                            {preset.label.replace('EDU', derivedPrefix || 'EDU')}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cert-number-format">Format</Label>
                    <Input
                        id="cert-number-format"
                        ref={inputRef}
                        spellCheck={false}
                        disabled={disabled}
                        value={value.pattern}
                        placeholder={DEFAULT_CERTIFICATE_PATTERN}
                        onChange={(e) => onChange({ pattern: e.target.value })}
                        className={cn('font-mono', !hasSequence && 'border-danger-500')}
                    />
                    <p className="text-xs text-muted-foreground">
                        Anything outside {'{ }'} is printed as-is. Click a value below to add it.
                    </p>
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cert-number-prefix">Prefix</Label>
                    <Input
                        id="cert-number-prefix"
                        disabled={disabled}
                        value={value.prefix}
                        placeholder={derivedPrefix}
                        onChange={(e) => onChange({ prefix: e.target.value })}
                        className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                        Blank uses <span className="font-mono">{derivedPrefix}</span>, from your
                        institute name.
                    </p>
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cert-number-padding">Number width</Label>
                    <Input
                        id="cert-number-padding"
                        type="number"
                        min={1}
                        max={10}
                        disabled={disabled}
                        value={String(value.sequencePadding)}
                        onChange={(e) =>
                            onChange({
                                sequencePadding: Math.max(
                                    1,
                                    Math.min(10, Number(e.target.value) || 1)
                                ),
                            })
                        }
                    />
                    <p className="text-xs text-muted-foreground">
                        Digits in a bare <span className="font-mono">{'{SEQ}'}</span>. Past this
                        width numbers get longer rather than starting over.
                    </p>
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cert-number-suffix">Suffix (optional)</Label>
                    <Input
                        id="cert-number-suffix"
                        disabled={disabled}
                        value={value.suffix}
                        onChange={(e) => onChange({ suffix: e.target.value })}
                        className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                        Only printed where your format has{' '}
                        <span className="font-mono">{'{SUFFIX}'}</span>.
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <Label>Add a value</Label>
                <div className="flex flex-wrap gap-1.5">
                    {TOKENS.map(({ token, label, hint }) => (
                        <button
                            key={token}
                            type="button"
                            disabled={disabled}
                            onClick={() => insertToken(token)}
                            title={`${token} — ${hint}`}
                            className={cn(
                                'rounded-md border px-2 py-1 text-xs transition-colors',
                                'border-neutral-200 bg-white hover:border-primary-300 hover:bg-primary-50',
                                token.startsWith('{SEQ') && 'border-primary-200 bg-primary-50'
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-4 rounded-md border border-neutral-200 bg-neutral-50/60 p-4">
                <div>
                    <div className="text-sm font-medium">Where the series starts</div>
                    <p className="text-xs text-muted-foreground">
                        {issued > 0
                            ? `This institute has issued up to #${issued}. The next certificate takes #${nextSequence}.`
                            : 'No certificate has been issued from this counter yet.'}
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="cert-number-start">Start numbering from</Label>
                        <Input
                            id="cert-number-start"
                            type="number"
                            min={0}
                            disabled={disabled}
                            placeholder="Leave blank to continue"
                            value={value.startFrom > 0 ? String(value.startFrom) : ''}
                            onChange={(e) => {
                                const parsed = Number(e.target.value);
                                onChange({
                                    startFrom:
                                        e.target.value.trim() === '' || !Number.isFinite(parsed)
                                            ? 0
                                            : Math.max(0, Math.floor(parsed)),
                                });
                            }}
                            className={cn('font-mono', startFromIgnored && 'border-warning-500')}
                        />
                        <p className="text-xs text-muted-foreground">
                            Set this if your certificates continue from paper records or another
                            system — enter 1500 and the next one issued is #1500.
                        </p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="cert-number-reset">Restart the count each year</Label>
                        <div className="flex h-10 items-center gap-3">
                            <Switch
                                id="cert-number-reset"
                                disabled={disabled}
                                checked={value.resetAnnually}
                                onCheckedChange={(checked) => onChange({ resetAnnually: checked })}
                            />
                            <span className="text-sm text-neutral-600">
                                {value.resetAnnually
                                    ? 'Back to the start every 1 January'
                                    : 'One unbroken series across years'}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Off keeps counting: #1500 in {new Date().getFullYear()} is followed by
                            #1501 next year.
                        </p>
                    </div>
                </div>

                {startFromIgnored && (
                    <div className="flex items-start gap-2 rounded-md border border-warning-300 bg-warning-50 p-3">
                        <Warning
                            className="mt-0.5 size-4 shrink-0 text-warning-600"
                            weight="fill"
                        />
                        <div className="text-xs text-warning-700">
                            <p className="font-medium">
                                #{value.startFrom} has already been issued, so this start number is
                                ignored.
                            </p>
                            <p className="mt-1">
                                Numbering continues from #{nextSequence}. Numbers are never reused —
                                #{value.startFrom} is on a certificate somebody already holds.
                                Choose a number above #{issued} to move the series forward.
                            </p>
                        </div>
                    </div>
                )}

                {value.resetAnnually && startFrom > 0 && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Info className="mt-0.5 size-3.5 shrink-0" />
                        <span>
                            The count restarts each January, so it will begin at #{value.startFrom}{' '}
                            again next year. Turn the yearly restart off for one continuous series.
                        </span>
                    </div>
                )}

                {value.resetAnnually && !hasYearToken && hasSequence && (
                    <div className="flex items-start gap-2 rounded-md border border-warning-300 bg-warning-50 p-3">
                        <Warning
                            className="mt-0.5 size-4 shrink-0 text-warning-600"
                            weight="fill"
                        />
                        <div className="text-xs text-warning-700">
                            <p className="font-medium">
                                This format has no year in it, but the count restarts each year.
                            </p>
                            <p className="mt-1">
                                January&apos;s first certificate would repeat a number already
                                issued. Add{' '}
                                <span className="font-mono">{'{YYYY}'}</span> to the format, or turn
                                the yearly restart off.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <div className="rounded-md border bg-muted/30 p-3">
                <div className="mb-2 flex items-center gap-2">
                    <Hash className="size-4 text-neutral-500" />
                    <span className="text-sm font-medium text-neutral-700">
                        The next three certificates
                    </span>
                    <span className="text-xs text-muted-foreground">
                        starting at #{nextSequence}
                    </span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {samples.map((sample, index) => (
                        <code
                            key={`${sample}-${index}`}
                            className="rounded bg-white px-2 py-1 font-mono text-xs text-neutral-700 ring-1 ring-neutral-200"
                        >
                            {sample || '—'}
                        </code>
                    ))}
                </div>
                {usingDefault && (
                    <p className="mt-2 text-xs text-muted-foreground">
                        Using the default format,{' '}
                        <span className="font-mono">{DEFAULT_CERTIFICATE_PATTERN}</span>.
                    </p>
                )}
            </div>

            {!hasSequence && (
                <div className="flex items-start gap-2 rounded-md border border-danger-200 bg-danger-50 p-3">
                    <Warning className="mt-0.5 size-4 shrink-0 text-danger-600" weight="fill" />
                    <div className="text-xs text-danger-700">
                        <p className="font-medium">
                            This format has no counter, so every certificate would get the same
                            number.
                        </p>
                        <p className="mt-1">
                            Add <span className="font-mono">{'{SEQ}'}</span> where the number should
                            go — typing digits yourself prints those exact digits every time. Until
                            you do, the counter is added at the end so numbers stay unique.
                        </p>
                    </div>
                </div>
            )}

            <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                <span>
                    Changing the format affects certificates issued from now on. The counter itself
                    only ever moves forward — numbers already issued are never reused, which is why
                    a start number below #{issued || 1} has no effect.
                </span>
            </div>
        </div>
    );
};
