import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, MagicWand, Plus, Trash } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type {
    CourseFinderGroup,
    CourseFinderSettings,
    MappingRow,
} from '../-types/product-page-types';

/**
 * Authors the "choose your class" screen learners see before the course grid.
 *
 * Every button's membership is picked from this page's OWN courses and stored
 * as package_session_ids. Nothing here groups by name at run time: Shiksha
 * Nation's nine scholarship tests all sit under one level called "Scholarship
 * Test" with the class only in the course name, so a name-derived rule would
 * put all nine behind every button. The auto-fill below is a one-off
 * convenience that writes ids — what it guesses is editable, and wrong guesses
 * cost a rename, not a broken page.
 */

interface Props {
    value: CourseFinderSettings;
    courses: MappingRow[];
    onChange: (next: CourseFinderSettings) => void;
}

const newId = () =>
    // randomUUID is unavailable over plain http on a LAN address, which is how
    // the admin app is sometimes opened for testing.
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? `cf-${crypto.randomUUID().slice(0, 8)}`
        : `cf-${Math.random().toString(36).slice(2, 10)}`;

const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/**
 * The shared opening of every course name, cut back to the last separator
 * inside it.
 *
 * Nine courses called "UnlockX Scholarship Test - Class 6 … - Class 12 NEET"
 * share the prefix "UnlockX Scholarship Test - Class ", and trimming exactly
 * that leaves buttons reading "6" and "12 NEET". Cutting at the last " - "
 * instead leaves "Class 6" and "Class 12 NEET", which is what the labels are
 * for. Where the names share no separator-terminated prefix, the whole name is
 * the honest label.
 */
export const stripSharedPrefix = (names: string[]): ((name: string) => string) => {
    const usable = names.filter((n) => n.trim().length > 0);
    if (usable.length < 2) return (name) => name.trim();

    let prefix = usable[0]!;
    for (const name of usable.slice(1)) {
        let i = 0;
        while (i < prefix.length && i < name.length && prefix[i] === name[i]) i += 1;
        prefix = prefix.slice(0, i);
        if (!prefix) break;
    }

    const cut = Math.max(
        prefix.lastIndexOf(' - '),
        prefix.lastIndexOf(': '),
        prefix.lastIndexOf(' | '),
        prefix.lastIndexOf(' – ')
    );
    if (cut < 0) return (name) => name.trim();
    const shared = prefix.slice(0, cut + 3);
    return (name) => (name.startsWith(shared) ? name.slice(shared.length).trim() : name.trim());
};

export const CourseFinderEditor = ({ value, courses, onChange }: Props) => {
    const [openGroup, setOpenGroup] = useState<number | null>(null);

    const groups = value.groups ?? [];
    const set = (patch: Partial<CourseFinderSettings>) => onChange({ ...value, ...patch });
    const setGroup = (index: number, patch: Partial<CourseFinderGroup>) =>
        set({ groups: groups.map((g, i) => (i === index ? { ...g, ...patch } : g)) });

    /** Courses on the page, deduped by package session — the pickable universe. */
    const pickable = useMemo(() => {
        const seen = new Set<string>();
        return courses.filter((c) => {
            if (!c.packageSessionId || seen.has(c.packageSessionId)) return false;
            seen.add(c.packageSessionId);
            return true;
        });
    }, [courses]);

    const nameOf = (row: MappingRow) =>
        row.packageName?.trim() || row.inviteName?.trim() || row.packageSessionId;

    /** Which button a course already sits on — a course on two is a real mistake. */
    const assignment = useMemo(() => {
        const map = new Map<string, string[]>();
        for (const g of groups) {
            for (const id of g.packageSessionIds ?? []) {
                map.set(id, [...(map.get(id) ?? []), g.label || 'Untitled']);
            }
        }
        return map;
    }, [groups]);

    const unassigned = pickable.filter((c) => !assignment.has(c.packageSessionId));

    const autoFill = () => {
        // Replaces every button, including hand-authored ones — a class grouped
        // by hand ("Class 11 JEE + NEET") is gone with one click, and the page
        // it configures is live. Same guard the rest of the admin uses for
        // discarding work.
        if (
            groups.length > 0 &&
            !window.confirm(
                `Replace all ${groups.length} button${groups.length === 1 ? '' : 's'} with one per course? Your current grouping will be lost.`
            )
        ) {
            return;
        }
        const label = stripSharedPrefix(pickable.map(nameOf));
        set({
            groups: pickable.map((c) => ({
                id: newId(),
                label: label(nameOf(c)) || nameOf(c),
                packageSessionIds: [c.packageSessionId],
            })),
        });
        setOpenGroup(null);
    };

    return (
        <div className="space-y-3 bg-neutral-50/60 px-5 py-4 ps-14">
            <p className="text-2xs text-neutral-500">
                Learners pick one button before they see any course, and the catalogue is then
                limited to that button&apos;s courses. Use it when a visitor only ever wants the one
                course meant for them — a class, a stream, a city.
            </p>

            {/* ── Copy ───────────────────────────────────────────────────────── */}
            <div className="grid gap-2 sm:grid-cols-2">
                <div>
                    <Label className="text-xs">Heading</Label>
                    <Input
                        value={value.heading ?? ''}
                        onChange={(e) => set({ heading: e.target.value })}
                        placeholder="Select your class"
                        className="h-8"
                    />
                    <p className="mt-1 text-2xs text-neutral-400">
                        Falls back to the page name when empty.
                    </p>
                </div>
                <div>
                    <Label className="text-xs">Sub-heading</Label>
                    <Input
                        value={value.subheading ?? ''}
                        onChange={(e) => set({ subheading: e.target.value })}
                        placeholder="Pick yours to see the courses available for you"
                        className="h-8"
                    />
                </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
                <div>
                    <Label className="text-xs">&ldquo;Change&rdquo; link wording</Label>
                    <Input
                        value={value.changeLabel ?? ''}
                        onChange={(e) => set({ changeLabel: e.target.value })}
                        placeholder="Change class"
                        className="h-8"
                    />
                    <p className="mt-1 text-2xs text-neutral-400">
                        Shown above the catalogue so a learner can go back and choose again.
                    </p>
                </div>
                <div>
                    <label className="flex items-center gap-2 pt-5 text-xs text-neutral-700">
                        <input
                            type="checkbox"
                            checked={value.allowSkip ?? false}
                            onChange={() => set({ allowSkip: !(value.allowSkip ?? false) })}
                            className="size-3.5 rounded border-neutral-300 accent-primary-500"
                        />
                        Let learners skip and browse everything
                    </label>
                    {value.allowSkip && (
                        <Input
                            value={value.skipLabel ?? ''}
                            onChange={(e) => set({ skipLabel: e.target.value })}
                            placeholder="Show all courses"
                            className="mt-1 h-8"
                        />
                    )}
                </div>
            </div>

            {/* ── Buttons ────────────────────────────────────────────────────── */}
            <div className="space-y-2 border-t border-neutral-200 pt-3">
                <div className="flex items-center justify-between">
                    <Label className="text-xs">Buttons</Label>
                    {pickable.length > 0 && (
                        <button
                            type="button"
                            onClick={autoFill}
                            className="inline-flex items-center gap-1 text-2xs font-semibold text-primary-500"
                        >
                            <MagicWand className="size-3.5" />{' '}
                            {groups.length > 0 ? 'Rebuild: one per course' : 'One button per course'}
                        </button>
                    )}
                </div>
                <p className="text-2xs text-neutral-400">
                    At least two are needed — a screen with one button asks the learner to confirm
                    the only thing on offer, so the finder is skipped entirely below that.
                </p>

                {groups.map((group, index) => {
                    const open = openGroup === index;
                    const picked = group.packageSessionIds ?? [];
                    return (
                        <div key={group.id} className="rounded border border-neutral-200 bg-white p-2">
                            <div className="flex items-center gap-1">
                                <Input
                                    value={group.label}
                                    onChange={(e) => setGroup(index, { label: e.target.value })}
                                    placeholder="Class 6"
                                    className="h-8"
                                />
                                <button
                                    type="button"
                                    aria-label={`Move ${group.label || 'button'} up`}
                                    disabled={index === 0}
                                    onClick={() => {
                                        const next = [...groups];
                                        const [row] = next.splice(index, 1);
                                        if (row) next.splice(index - 1, 0, row);
                                        set({ groups: next });
                                    }}
                                    className="rounded p-1 text-neutral-400 disabled:opacity-30"
                                >
                                    <ArrowUp className="size-3.5" />
                                </button>
                                <button
                                    type="button"
                                    aria-label={`Move ${group.label || 'button'} down`}
                                    disabled={index === groups.length - 1}
                                    onClick={() => {
                                        const next = [...groups];
                                        const [row] = next.splice(index, 1);
                                        if (row) next.splice(index + 1, 0, row);
                                        set({ groups: next });
                                    }}
                                    className="rounded p-1 text-neutral-400 disabled:opacity-30"
                                >
                                    <ArrowDown className="size-3.5" />
                                </button>
                                <button
                                    type="button"
                                    aria-label={`Remove ${group.label || 'button'}`}
                                    onClick={() =>
                                        set({ groups: groups.filter((_, i) => i !== index) })
                                    }
                                    className="rounded p-1 text-neutral-400 hover:text-danger-500"
                                >
                                    <Trash className="size-3.5" />
                                </button>
                            </div>

                            <Input
                                value={group.description ?? ''}
                                onChange={(e) => setGroup(index, { description: e.target.value })}
                                placeholder="Optional line under the label"
                                className="mt-1 h-7 text-xs"
                            />

                            <button
                                type="button"
                                onClick={() => setOpenGroup(open ? null : index)}
                                className="mt-1 text-2xs text-neutral-500"
                            >
                                {picked.length} course{picked.length === 1 ? '' : 's'} ·{' '}
                                {open ? 'hide' : 'choose'}
                            </button>
                            {picked.length === 0 && (
                                <span className="ms-2 text-2xs text-warning-600">
                                    empty — this button will be hidden from learners
                                </span>
                            )}

                            {open && (
                                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto border-t pt-2">
                                    {pickable.length === 0 && (
                                        <p className="text-2xs text-neutral-400">
                                            No courses on this page yet — add them in the Courses
                                            tab.
                                        </p>
                                    )}
                                    {pickable.map((course) => {
                                        const elsewhere = (
                                            assignment.get(course.packageSessionId) ?? []
                                        ).filter((l) => l !== (group.label || 'Untitled'));
                                        return (
                                            <label
                                                key={course.packageSessionId}
                                                className="flex items-center gap-2 text-2xs text-neutral-700"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={picked.includes(course.packageSessionId)}
                                                    onChange={() =>
                                                        setGroup(index, {
                                                            packageSessionIds: toggleIn(
                                                                picked,
                                                                course.packageSessionId
                                                            ),
                                                        })
                                                    }
                                                    className="size-3.5 rounded border-neutral-300 accent-primary-500"
                                                />
                                                <span className="truncate">{nameOf(course)}</span>
                                                {course.levelName && (
                                                    <span className="shrink-0 text-neutral-400">
                                                        {course.levelName}
                                                    </span>
                                                )}
                                                {!picked.includes(course.packageSessionId) &&
                                                    elsewhere.length > 0 && (
                                                        <span className="shrink-0 text-neutral-400">
                                                            on {elsewhere.join(', ')}
                                                        </span>
                                                    )}
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}

                <button
                    type="button"
                    onClick={() => {
                        set({
                            groups: [
                                ...groups,
                                { id: newId(), label: '', packageSessionIds: [] },
                            ],
                        });
                        setOpenGroup(groups.length);
                    }}
                    className="inline-flex items-center gap-1 text-2xs font-semibold text-primary-500"
                >
                    <Plus className="size-3.5" /> Add button
                </button>

                {unassigned.length > 0 && groups.length > 0 && (
                    <p className="text-2xs text-warning-600">
                        {unassigned.length} course{unassigned.length === 1 ? '' : 's'} on no button
                        {unassigned.length === 1 ? '' : 's'} — learners cannot reach{' '}
                        {unassigned.length === 1 ? 'it' : 'them'} unless skipping is allowed.
                    </p>
                )}
            </div>
        </div>
    );
};
