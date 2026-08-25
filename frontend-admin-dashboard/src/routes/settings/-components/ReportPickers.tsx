import { useEffect, useMemo, useState } from 'react';
import { MyInput } from '@/components/design-system/input';
import { MyButton } from '@/components/design-system/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
    fetchRecipientOptions,
    fetchScopeOptions,
    type RecipientCandidate,
    type ReportScopeType,
    type ScopeOptions,
} from '../-services/scheduled-reports-service';

/**
 * Pickers for the two things a schedule could not previously name: which scopes it
 * covers, and which people receive it.
 *
 * Both are search-first rather than a long list, because the lists are genuinely
 * large — one production institute has 661 batches and 1,042 subject instances, and
 * a plain dropdown of those is unusable. The server caps what it returns and says
 * so, and these components surface that cap rather than quietly showing a slice.
 *
 * Selected items are kept visible as chips even when a search filters them out of
 * the list below, so a narrowing search can never make a selection look lost.
 */

/** Debounce a value so typing does not fire a request per keystroke. */
function useDebounced<T>(value: T, ms = 250): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return debounced;
}

interface ScopePickerProps {
    scopeType: ReportScopeType;
    selected: string[];
    onChange: (ids: string[]) => void;
}

export function ScopePicker({ scopeType, selected, onChange }: ScopePickerProps) {
    const [query, setQuery] = useState('');
    const debounced = useDebounced(query);
    const [data, setData] = useState<ScopeOptions | null>(null);
    const [labels, setLabels] = useState<Record<string, string>>({});
    const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

    useEffect(() => {
        if (scopeType === 'INSTITUTE') return;
        let live = true;
        setState('loading');
        fetchScopeOptions(scopeType, debounced)
            .then((d) => {
                if (!live) return;
                setData(d);
                // Remember labels for ids we have seen, so a selected chip keeps its
                // name after a search stops returning it.
                setLabels((prev) => {
                    const next = { ...prev };
                    d.options.forEach((o) => (next[o.id] = o.label));
                    return next;
                });
                setState('idle');
            })
            .catch(() => live && setState('error'));
        return () => {
            live = false;
        };
    }, [scopeType, debounced]);

    if (scopeType === 'INSTITUTE') return null;

    const noun = scopeType === 'BATCH' ? 'batches' : scopeType === 'SUBJECT' ? 'subjects' : 'faculty';

    const toggle = (id: string, on: boolean) =>
        onChange(on ? [...selected, id] : selected.filter((x) => x !== id));

    return (
        <div className="mb-3 rounded-md border border-border p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-caption font-medium text-neutral-600">
                    Which {noun}?
                </p>
                {selected.length > 0 && (
                    <MyButton buttonType="text" onClick={() => onChange([])}>
                        Clear {selected.length}
                    </MyButton>
                )}
            </div>

            {/* An empty selection is not "none" — the runner reads it as EVERY scope of
                this type, which is what trips the 50-document cap. Say so plainly. */}
            {selected.length === 0 && (
                <p className="mb-2 text-caption text-warning-700">
                    Nothing picked means <b>every</b> one of them, which may exceed the
                    per-run limit. Pick the {noun} you want.
                </p>
            )}

            <MyInput
                inputType="text"
                input={query}
                onChangeFunction={(e) => setQuery(e.target.value)}
                inputPlaceholder={`Search ${noun}…`}
                className="mb-2 w-full"
            />

            {selected.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                    {selected.map((id) => (
                        <Badge key={id} variant="secondary">
                            {labels[id] ?? id}
                        </Badge>
                    ))}
                </div>
            )}

            {state === 'loading' && (
                <p className="text-caption text-neutral-500">Loading…</p>
            )}
            {state === 'error' && (
                <p className="text-caption text-danger-600">
                    Could not load {noun}. Check your connection and try again.
                </p>
            )}
            {state === 'idle' && data && data.options.length === 0 && (
                <p className="text-caption text-neutral-500">
                    {query ? `No ${noun} match “${query}”.` : `This institute has no ${noun}.`}
                </p>
            )}

            {state === 'idle' && data && data.options.length > 0 && (
                <>
                    <div className="max-h-48 overflow-y-auto">
                        {data.options.map((o) => (
                            <label
                                key={o.id}
                                className="flex items-center gap-2 py-1 text-body"
                            >
                                <Checkbox
                                    checked={selected.includes(o.id)}
                                    onCheckedChange={(v) => toggle(o.id, Boolean(v))}
                                />
                                <span className="truncate">{o.label}</span>
                            </label>
                        ))}
                    </div>
                    {data.truncated && (
                        <p className="mt-1 text-caption text-neutral-500">
                            Showing {data.options.length} of {data.total} — search to narrow.
                        </p>
                    )}
                </>
            )}
        </div>
    );
}

interface RecipientPickerProps {
    selected: string[];
    onChange: (ids: string[]) => void;
}

export function RecipientPicker({ selected, onChange }: RecipientPickerProps) {
    const [query, setQuery] = useState('');
    const debounced = useDebounced(query);
    const [people, setPeople] = useState<RecipientCandidate[]>([]);
    const [known, setKnown] = useState<Record<string, string>>({});
    const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

    useEffect(() => {
        let live = true;
        setState('loading');
        fetchRecipientOptions(debounced)
            .then((list) => {
                if (!live) return;
                setPeople(list);
                setKnown((prev) => {
                    const next = { ...prev };
                    list.forEach(
                        (p) => (next[p.userId] = p.name || p.email || p.userId)
                    );
                    return next;
                });
                setState('idle');
            })
            .catch(() => live && setState('error'));
        return () => {
            live = false;
        };
    }, [debounced]);

    const toggle = (id: string, on: boolean) =>
        onChange(on ? [...selected, id] : selected.filter((x) => x !== id));

    const noEmail = useMemo(
        () => people.filter((p) => selected.includes(p.userId) && !p.email),
        [people, selected]
    );

    return (
        <div className="mb-3 rounded-md border border-border p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-caption font-medium text-neutral-600">
                    Or pick specific people
                </p>
                {selected.length > 0 && (
                    <MyButton buttonType="text" onClick={() => onChange([])}>
                        Clear {selected.length}
                    </MyButton>
                )}
            </div>

            <MyInput
                inputType="text"
                input={query}
                onChangeFunction={(e) => setQuery(e.target.value)}
                inputPlaceholder="Search by name or email…"
                className="mb-2 w-full"
            />

            {selected.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                    {selected.map((id) => (
                        <Badge key={id} variant="secondary">
                            {known[id] ?? id}
                        </Badge>
                    ))}
                </div>
            )}

            {/* A recipient with no address is silently skipped at send time, which
                looks like a delivery bug. Better to say it while it can be fixed. */}
            {noEmail.length > 0 && (
                <p className="mb-2 text-caption text-warning-700">
                    {noEmail.length} selected {noEmail.length === 1 ? 'person has' : 'people have'}{' '}
                    no email on file and will not receive anything.
                </p>
            )}

            {state === 'loading' && <p className="text-caption text-neutral-500">Loading…</p>}
            {state === 'error' && (
                <p className="text-caption text-danger-600">Could not load people.</p>
            )}
            {state === 'idle' && people.length === 0 && (
                <p className="text-caption text-neutral-500">
                    {query ? `Nobody matches “${query}”.` : 'No eligible recipients found.'}
                </p>
            )}
            {state === 'idle' && people.length > 0 && (
                <div className="max-h-48 overflow-y-auto">
                    {people.map((p) => (
                        <label key={p.userId} className="flex items-center gap-2 py-1 text-body">
                            <Checkbox
                                checked={selected.includes(p.userId)}
                                onCheckedChange={(v) => toggle(p.userId, Boolean(v))}
                            />
                            <span className="truncate">
                                {p.name || '(unnamed)'}
                                <span className="text-neutral-500"> · {p.email || 'no email'}</span>
                            </span>
                            <span className="ml-auto shrink-0 text-caption text-neutral-500">
                                {p.roles.join('/')}
                            </span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}
