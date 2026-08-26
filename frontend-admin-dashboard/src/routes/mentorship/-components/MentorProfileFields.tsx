import { useState } from 'react';
import { Info, X } from '@phosphor-icons/react';
import { MyInput } from '@/components/design-system/input';
import { Switch } from '@/components/ui/switch';

/** Common starting points so an admin isn't staring at an empty tag box. */
const TAG_SUGGESTIONS = [
    'Career guidance',
    'Exam strategy',
    'Doubt solving',
    'Interview prep',
    'Study planning',
];

export interface MentorProfileValues {
    expertiseTags: string[];
    maxMentees: string; // kept as text so the field can be left blank for "unlimited"
    isDiscoverable: boolean;
}

/**
 * The three attributes that turn a mentor row into something learners can be
 * matched to: what they mentor on, how many mentees they can carry, and whether
 * they're listed in the learner-facing directory.
 *
 * Shared by the add and edit dialogs so both stay in step.
 */
export function MentorProfileFields({
    values,
    onChange,
    assignedCount,
}: {
    values: MentorProfileValues;
    onChange: (next: MentorProfileValues) => void;
    /** Current mentee count — shown when editing so a cap below it is obvious. */
    assignedCount?: number | null;
}) {
    const set = <K extends keyof MentorProfileValues>(key: K, value: MentorProfileValues[K]) =>
        onChange({ ...values, [key]: value });

    const cap = Number(values.maxMentees);
    const capBelowCurrent =
        values.maxMentees.trim() !== '' &&
        Number.isFinite(cap) &&
        cap > 0 &&
        typeof assignedCount === 'number' &&
        cap < assignedCount;

    return (
        <>
            <ExpertiseTagsInput
                tags={values.expertiseTags}
                onChange={(tags) => set('expertiseTags', tags)}
            />

            <div className="flex flex-col gap-1">
                <MyInput
                    input={values.maxMentees}
                    onChangeFunction={(e: React.ChangeEvent<HTMLInputElement>) =>
                        // Digits only — the field means "how many", and a stray letter would
                        // silently become an unlimited cap on the server.
                        set('maxMentees', e.target.value.replace(/[^0-9]/g, ''))
                    }
                    inputType="text"
                    inputPlaceholder="Leave blank for no limit"
                    label="Max mentees"
                    className="sm:w-full"
                />
                <span className="text-caption text-neutral-400">
                    Assignment and round-robin stop adding students once a mentor hits this number.
                    Blank means no limit.
                </span>
                {capBelowCurrent && (
                    <span className="flex items-center gap-1 text-caption text-warning-600">
                        <Info size={12} weight="fill" />
                        They already have {assignedCount} mentees — existing ones stay, but no new
                        students can be assigned.
                    </span>
                )}
            </div>

            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-neutral-200 p-3">
                <span className="flex flex-col">
                    <span className="text-body font-medium text-neutral-700">
                        List in Find a mentor
                    </span>
                    <span className="text-caption text-neutral-500">
                        Learners can see this mentor&apos;s profile and request them. Requests come
                        to you for approval — nobody is paired automatically.
                    </span>
                </span>
                <Switch
                    checked={values.isDiscoverable}
                    onCheckedChange={(checked) => set('isDiscoverable', checked)}
                    aria-label="List this mentor in Find a mentor"
                />
            </label>
        </>
    );
}

/**
 * Free-text expertise tags. Enter or comma commits, so pasting
 * "Physics, Career guidance" lands as two tags rather than one long one.
 */
function ExpertiseTagsInput({
    tags,
    onChange,
}: {
    tags: string[];
    onChange: (tags: string[]) => void;
}) {
    const [draft, setDraft] = useState('');

    const commit = (raw: string) => {
        const added = raw
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .filter((t) => !tags.some((existing) => existing.toLowerCase() === t.toLowerCase()));
        if (added.length) onChange([...tags, ...added]);
        setDraft('');
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit(draft);
        } else if (e.key === 'Backspace' && !draft && tags.length) {
            onChange(tags.slice(0, -1));
        }
    };

    const unusedSuggestions = TAG_SUGGESTIONS.filter(
        (s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase())
    );

    return (
        <div className="flex flex-col gap-1.5">
            <MyInput
                input={draft}
                onChangeFunction={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setDraft(e.target.value)
                }
                onKeyDown={onKeyDown}
                onBlur={() => commit(draft)}
                inputType="text"
                inputPlaceholder="e.g. JEE Physics — press Enter to add"
                label="Expertise"
                className="sm:w-full"
            />
            <span className="text-caption text-neutral-400">
                What this mentor helps with. Learners search the directory by these.
            </span>

            {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {tags.map((tag) => (
                        <span
                            key={tag}
                            className="flex items-center gap-1 rounded-full bg-primary-50 py-1 pl-2.5 pr-1 text-caption text-primary-600"
                        >
                            {tag}
                            <button
                                type="button"
                                aria-label={`Remove ${tag}`}
                                onClick={() => onChange(tags.filter((t) => t !== tag))}
                                className="rounded-full p-0.5 hover:bg-primary-100"
                            >
                                <X size={11} weight="bold" />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {tags.length === 0 && unusedSuggestions.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-caption text-neutral-400">Try:</span>
                    {unusedSuggestions.map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => onChange([...tags, s])}
                            className="rounded-full border border-neutral-200 px-2.5 py-1 text-caption text-neutral-500 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-600"
                        >
                            + {s}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
