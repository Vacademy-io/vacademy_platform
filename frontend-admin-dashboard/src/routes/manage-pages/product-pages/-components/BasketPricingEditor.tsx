import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type {
    BasketPricingCombo,
    BasketPricingGroup,
    BasketPricingSettings,
    MappingRow,
} from '../-types/product-page-types';

/**
 * Authors a whole-basket price: "any 3 subjects for ₹799, ₹150 each after".
 *
 * Every list here is filled from the page's OWN courses — real level and course
 * names, never typed by hand and never a class parsed out of a name. Level
 * names in the wild drift ("Cyber AI- Class 6", "Social Science Class - 5") and
 * some courses sit under another subject's level, so anything derived from
 * their shape would quietly mis-price a basket.
 */

interface Props {
    value: BasketPricingSettings;
    courses: MappingRow[];
    onChange: (next: BasketPricingSettings) => void;
}

const num = (v: string, fallback = 0) => {
    const parsed = Number(v);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const BasketPricingEditor = ({ value, courses, onChange }: Props) => {
    const [openGroup, setOpenGroup] = useState<number | null>(null);
    const [openCombo, setOpenCombo] = useState<number | null>(null);

    const levelNames = useMemo(
        () =>
            [...new Set(courses.map((c) => c.levelName ?? '').filter(Boolean))].sort((a, b) =>
                a.localeCompare(b, undefined, { numeric: true })
            ),
        [courses]
    );
    const courseNames = useMemo(
        () => [...new Set(courses.map((c) => c.packageName ?? '').filter(Boolean))].sort(),
        [courses]
    );

    const set = (patch: Partial<BasketPricingSettings>) => onChange({ ...value, ...patch });
    const prices = value.ladder?.prices ?? [];
    const groups = value.groups ?? [];
    const combos = value.combos ?? [];
    const packs = value.wholeGroupPrices ?? {};

    /** What the ladder charges for a basket of n — mirrors the pricing engine. */
    const ladderAt = (n: number) =>
        n <= prices.length
            ? (prices[n - 1] ?? 0)
            : (prices[prices.length - 1] ?? 0) + (value.ladder?.perExtra ?? 0) * (n - prices.length);

    const setPrice = (index: number, price: number) =>
        set({
            ladder: {
                ...value.ladder,
                prices: prices.map((p, i) => (i === index ? price : p)),
            },
        });

    const setGroup = (index: number, patch: Partial<BasketPricingGroup>) =>
        set({ groups: groups.map((g, i) => (i === index ? { ...g, ...patch } : g)) });

    const setCombo = (index: number, patch: Partial<BasketPricingCombo>) =>
        set({ combos: combos.map((c, i) => (i === index ? { ...c, ...patch } : c)) });

    const toggleIn = (list: string[], item: string) =>
        list.includes(item) ? list.filter((v) => v !== item) : [...list, item];

    return (
        <div className="space-y-4 bg-neutral-50/60 px-5 py-4 ps-14">
            <p className="text-2xs text-neutral-500">
                The basket is priced as a whole and this <strong>replaces</strong> the courses&apos;
                own prices — which is the point on a page where each course is ₹0. The cheapest
                applicable rule always wins, so a bigger basket never costs more.
            </p>

            {/* ── Ladder ─────────────────────────────────────────────────────── */}
            <div className="space-y-2">
                <Label className="text-xs">Price by number of subjects</Label>
                {prices.map((price, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 text-2xs text-neutral-500">
                            {index + 1} subject{index === 0 ? '' : 's'}
                        </span>
                        <Input
                            type="number"
                            min={0}
                            value={price}
                            onChange={(e) => setPrice(index, num(e.target.value))}
                            className="h-8 w-24"
                        />
                        {index === prices.length - 1 && prices.length > 1 && (
                            <button
                                type="button"
                                aria-label={`Remove the ${index + 1}-subject price`}
                                onClick={() =>
                                    set({ ladder: { ...value.ladder, prices: prices.slice(0, -1) } })
                                }
                                className="rounded p-1 text-neutral-400 hover:text-danger-500"
                            >
                                <Trash className="size-3.5" />
                            </button>
                        )}
                    </div>
                ))}
                <button
                    type="button"
                    onClick={() =>
                        set({
                            ladder: {
                                ...value.ladder,
                                prices: [...prices, ladderAt(prices.length + 1)],
                            },
                        })
                    }
                    className="inline-flex items-center gap-1 text-2xs font-semibold text-primary-500"
                >
                    <Plus className="size-3.5" /> Add a step
                </button>

                <div className="flex items-center gap-2 pt-1">
                    <span className="w-24 shrink-0 text-2xs text-neutral-500">Each extra</span>
                    <Input
                        type="number"
                        min={0}
                        value={value.ladder?.perExtra ?? 0}
                        onChange={(e) =>
                            set({ ladder: { ...value.ladder, perExtra: num(e.target.value) } })
                        }
                        className="h-8 w-24"
                    />
                    <span className="text-2xs text-neutral-400">
                        beyond {prices.length} — e.g. {prices.length + 2} subjects ={' '}
                        {ladderAt(prices.length + 2)}
                    </span>
                </div>
            </div>

            {/* ── Ladder scope ───────────────────────────────────────────────── */}
            <div className="space-y-2 border-t border-neutral-200 pt-3">
                <Label className="text-xs">When subjects are for different classes</Label>
                {(
                    [
                        [
                            'GROUP',
                            'Price each class separately',
                            'One subject for a Class 6 child and one for a Class 8 child = two single-subject prices. No accidental sibling discount.',
                        ],
                        [
                            'BASKET',
                            'Count the whole basket together',
                            'Those same two subjects reach the two-subject price, whoever they are for.',
                        ],
                    ] as const
                ).map(([scope, label, hint]) => {
                    const active = (value.ladderScope ?? 'GROUP') === scope;
                    return (
                        <button
                            key={scope}
                            type="button"
                            onClick={() => set({ ladderScope: scope })}
                            className={`w-full rounded border p-2 text-start ${
                                active
                                    ? 'border-primary-400 bg-primary-50'
                                    : 'border-neutral-200 bg-white'
                            }`}
                        >
                            <p
                                className={`text-2xs font-semibold ${
                                    active ? 'text-primary-600' : 'text-neutral-700'
                                }`}
                            >
                                {label}
                            </p>
                            <p className="mt-0.5 text-2xs text-neutral-500">{hint}</p>
                        </button>
                    );
                })}
                <p className="text-2xs text-neutral-400">
                    Full packs and combos always stay per class — a &ldquo;full grade pack&rdquo;
                    only means something within one grade.
                </p>
            </div>

            {/* ── Full-pack prices ───────────────────────────────────────────── */}
            <div className="space-y-2 border-t border-neutral-200 pt-3">
                <Label className="text-xs">Full pack price</Label>
                <p className="text-2xs text-neutral-400">
                    Charged only when a visitor picks <em>every</em> subject in their group. Keyed
                    by how many that is.
                </p>
                {Object.entries(packs).map(([count, price]) => (
                    <div key={count} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 text-2xs text-neutral-500">
                            all {count} subjects
                        </span>
                        <Input
                            type="number"
                            min={0}
                            value={price}
                            onChange={(e) =>
                                set({ wholeGroupPrices: { ...packs, [count]: num(e.target.value) } })
                            }
                            className="h-8 w-24"
                        />
                        <span className="text-2xs text-neutral-400">
                            ladder would be {ladderAt(Number(count))}
                        </span>
                        <button
                            type="button"
                            aria-label={`Remove the ${count}-subject pack price`}
                            onClick={() => {
                                const next = { ...packs };
                                delete next[count];
                                set({ wholeGroupPrices: next });
                            }}
                            className="rounded p-1 text-neutral-400 hover:text-danger-500"
                        >
                            <Trash className="size-3.5" />
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    onClick={() => {
                        // Next unused count, so repeated clicks add distinct rows.
                        let n = 2;
                        while (packs[String(n)] !== undefined) n += 1;
                        set({ wholeGroupPrices: { ...packs, [String(n)]: ladderAt(n) } });
                    }}
                    className="inline-flex items-center gap-1 text-2xs font-semibold text-primary-500"
                >
                    <Plus className="size-3.5" /> Add a pack price
                </button>
            </div>

            {/* ── Groups ─────────────────────────────────────────────────────── */}
            <div className="space-y-2 border-t border-neutral-200 pt-3">
                <Label className="text-xs">Groups</Label>
                <p className="text-2xs text-neutral-400">
                    Usually one per class. The basket is split by group and each priced on its own,
                    so a parent buying for two children pays for two children. Leave empty to price
                    the whole basket together.
                </p>

                {groups.map((group, index) => {
                    const open = openGroup === index;
                    return (
                        <div key={index} className="rounded border border-neutral-200 bg-white p-2">
                            <div className="flex items-center gap-1">
                                <Input
                                    value={group.label}
                                    onChange={(e) => setGroup(index, { label: e.target.value })}
                                    placeholder="Class 6"
                                    className="h-8"
                                />
                                <button
                                    type="button"
                                    aria-label={`Move ${group.label || 'group'} up`}
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
                                    aria-label={`Move ${group.label || 'group'} down`}
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
                                    aria-label={`Remove ${group.label || 'group'}`}
                                    onClick={() =>
                                        set({ groups: groups.filter((_, i) => i !== index) })
                                    }
                                    className="rounded p-1 text-neutral-400 hover:text-danger-500"
                                >
                                    <Trash className="size-3.5" />
                                </button>
                            </div>

                            <div className="mt-1 flex items-center gap-2">
                                <span className="text-2xs text-neutral-500">Full pack price</span>
                                <Input
                                    type="number"
                                    min={0}
                                    value={group.packPrice ?? ''}
                                    placeholder="use the count table"
                                    onChange={(e) =>
                                        setGroup(index, {
                                            packPrice: e.target.value ? num(e.target.value) : undefined,
                                        })
                                    }
                                    className="h-7 w-24"
                                />
                                <span className="text-2xs text-neutral-400">
                                    charged when all {group.levels?.length || 0} are taken
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={() => setOpenGroup(open ? null : index)}
                                className="mt-1 text-2xs text-neutral-500"
                            >
                                {group.levels?.length || 0} level
                                {group.levels?.length === 1 ? '' : 's'} · {open ? 'hide' : 'choose'}
                            </button>

                            {open && (
                                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto border-t pt-2">
                                    {levelNames.length === 0 && (
                                        <p className="text-2xs text-neutral-400">
                                            No courses on this page yet — add them in the Courses tab.
                                        </p>
                                    )}
                                    {levelNames.map((level) => (
                                        <label
                                            key={level}
                                            className="flex items-center gap-2 text-2xs text-neutral-700"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={(group.levels ?? []).includes(level)}
                                                onChange={() =>
                                                    setGroup(index, {
                                                        levels: toggleIn(group.levels ?? [], level),
                                                    })
                                                }
                                                className="size-3.5 rounded border-neutral-300 accent-primary-500"
                                            />
                                            {level}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                <button
                    type="button"
                    onClick={() => {
                        set({ groups: [...groups, { label: `Group ${groups.length + 1}`, levels: [] }] });
                        setOpenGroup(groups.length);
                    }}
                    className="inline-flex items-center gap-1 text-2xs font-semibold text-primary-500"
                >
                    <Plus className="size-3.5" /> Add group
                </button>
            </div>

            {/* ── Combos ─────────────────────────────────────────────────────── */}
            <div className="space-y-2 border-t border-neutral-200 pt-3">
                <Label className="text-xs">Combos</Label>
                <p className="text-2xs text-neutral-400">
                    A fixed price for one exact set of courses, matched inside a group. Chosen by
                    course rather than level, so a single combo covers every class.
                </p>

                {combos.map((combo, index) => {
                    const open = openCombo === index;
                    return (
                        <div key={index} className="rounded border border-neutral-200 bg-white p-2">
                            <div className="flex items-center gap-1">
                                <Input
                                    value={combo.label}
                                    onChange={(e) => setCombo(index, { label: e.target.value })}
                                    placeholder="EMS combo"
                                    className="h-8"
                                />
                                <Input
                                    type="number"
                                    min={0}
                                    value={combo.price}
                                    onChange={(e) => setCombo(index, { price: num(e.target.value) })}
                                    className="h-8 w-24"
                                />
                                <button
                                    type="button"
                                    aria-label={`Remove ${combo.label || 'combo'}`}
                                    onClick={() =>
                                        set({ combos: combos.filter((_, i) => i !== index) })
                                    }
                                    className="rounded p-1 text-neutral-400 hover:text-danger-500"
                                >
                                    <Trash className="size-3.5" />
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => setOpenCombo(open ? null : index)}
                                className="mt-1 text-2xs text-neutral-500"
                            >
                                {combo.packages?.length || 0} course
                                {combo.packages?.length === 1 ? '' : 's'} ·{' '}
                                {open ? 'hide' : 'choose'}
                            </button>

                            {open && (
                                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto border-t pt-2">
                                    {courseNames.map((name) => (
                                        <label
                                            key={name}
                                            className="flex items-center gap-2 text-2xs text-neutral-700"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={(combo.packages ?? []).includes(name)}
                                                onChange={() =>
                                                    setCombo(index, {
                                                        packages: toggleIn(combo.packages ?? [], name),
                                                    })
                                                }
                                                className="size-3.5 rounded border-neutral-300 accent-primary-500"
                                            />
                                            {name}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                <button
                    type="button"
                    onClick={() => {
                        set({
                            combos: [
                                ...combos,
                                { label: 'Combo', packages: [], price: ladderAt(3) },
                            ],
                        });
                        setOpenCombo(combos.length);
                    }}
                    className="inline-flex items-center gap-1 text-2xs font-semibold text-primary-500"
                >
                    <Plus className="size-3.5" /> Add combo
                </button>
            </div>
        </div>
    );
};
