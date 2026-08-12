import { useMemo, useState } from 'react';
import { CaretDown, CaretRight } from '@phosphor-icons/react';
import { Checkbox } from '@/components/ui/checkbox';
import { MyButton } from '@/components/design-system/button';
import type { KbTopic } from '../../-types/paper';

interface TopicPickerProps {
    topics: KbTopic[];
    /** Subtopic ids (and ids of topics that have no subtopics) currently chosen. */
    selectedLeafIds: Set<string>;
    onChange: (next: Set<string>) => void;
}

/** Leaves a topic contributes: its subtopics, or itself if it has none. */
const leavesOf = (topic: KbTopic): string[] =>
    topic.subtopics?.length ? topic.subtopics.map((s) => s.id) : [topic.id];

/**
 * Convert the leaf selection into the node ids the planner should see.
 *
 * A fully-selected topic collapses to just its own id — the backend treats a
 * selected topic as implying all of its subtopics, so sending the parent keeps
 * the request small and lets the planner see the topic as one coherent unit
 * rather than a bag of fragments.
 */
export const toSelectedNodeIds = (topics: KbTopic[], selectedLeafIds: Set<string>): string[] => {
    const ids: string[] = [];
    topics.forEach((topic) => {
        const leaves = leavesOf(topic);
        const chosen = leaves.filter((id) => selectedLeafIds.has(id));
        if (chosen.length === 0) return;
        if (chosen.length === leaves.length) ids.push(topic.id);
        else ids.push(...chosen);
    });
    return ids;
};

/**
 * Two-level topic chooser.
 *
 * Replaces a flat list of the per-source summary sections, which on a set of
 * past papers offered things like "…Questions, p. 1-4" and "Answer Keys, p. 13"
 * — page artifacts, not subjects. Ticking a topic selects all its subtopics, so
 * the common case is one click and the detail is there only if wanted.
 */
export const TopicPicker = ({ topics, selectedLeafIds, onChange }: TopicPickerProps) => {
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const allLeaves = useMemo(() => topics.flatMap(leavesOf), [topics]);
    const allSelected = allLeaves.length > 0 && allLeaves.every((id) => selectedLeafIds.has(id));

    const setLeaves = (ids: string[], on: boolean) => {
        const next = new Set(selectedLeafIds);
        ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
        onChange(next);
    };

    const toggleTopic = (topic: KbTopic) => {
        const leaves = leavesOf(topic);
        const fully = leaves.every((id) => selectedLeafIds.has(id));
        setLeaves(leaves, !fully);
        // Reveal the detail the moment a topic is chosen, so it is obvious the
        // subtopics came along and can be narrowed.
        if (!fully && topic.subtopics?.length) {
            setExpanded((prev) => new Set(prev).add(topic.id));
        }
    };

    const toggleExpanded = (topicId: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(topicId)) next.delete(topicId);
            else next.add(topicId);
            return next;
        });
    };

    if (topics.length === 0) return null;

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <p className="text-caption text-neutral-500">
                    {selectedLeafIds.size === 0
                        ? 'Nothing selected — the paper will draw from everything.'
                        : `${selectedLeafIds.size} of ${allLeaves.length} subtopics selected`}
                </p>
                <MyButton
                    buttonType="text"
                    scale="medium"
                    onClick={() => setLeaves(allLeaves, !allSelected)}
                >
                    {allSelected ? 'Clear all' : 'Select all'}
                </MyButton>
            </div>

            <div className="flex max-h-96 flex-col divide-y divide-neutral-100 overflow-y-auto rounded-md border border-neutral-200">
                {topics.map((topic) => {
                    const leaves = leavesOf(topic);
                    const chosen = leaves.filter((id) => selectedLeafIds.has(id));
                    const fully = chosen.length === leaves.length;
                    const partial = chosen.length > 0 && !fully;
                    const isOpen = expanded.has(topic.id);
                    const hasSubs = Boolean(topic.subtopics?.length);

                    return (
                        <div key={topic.id} className="bg-white">
                            <div className="flex items-start gap-2 p-3">
                                <Checkbox
                                    checked={fully ? true : partial ? 'indeterminate' : false}
                                    onCheckedChange={() => toggleTopic(topic)}
                                    aria-label={`Select ${topic.title}`}
                                    className="mt-0.5"
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        hasSubs ? toggleExpanded(topic.id) : toggleTopic(topic)
                                    }
                                    className="flex min-w-0 flex-1 items-start gap-2 text-left"
                                >
                                    {hasSubs &&
                                        (isOpen ? (
                                            <CaretDown className="mt-1 size-3.5 shrink-0 text-neutral-400" />
                                        ) : (
                                            <CaretRight className="mt-1 size-3.5 shrink-0 text-neutral-400" />
                                        ))}
                                    <span className="min-w-0">
                                        <span className="block break-words text-body font-medium text-neutral-700">
                                            {topic.title}
                                        </span>
                                        {topic.summary && (
                                            <span className="mt-0.5 block break-words text-caption text-neutral-500">
                                                {topic.summary}
                                            </span>
                                        )}
                                        {hasSubs && (
                                            <span className="mt-0.5 block text-caption text-neutral-400">
                                                {chosen.length > 0 && !fully
                                                    ? `${chosen.length} of ${leaves.length} subtopics`
                                                    : `${leaves.length} subtopics`}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            </div>

                            {isOpen && hasSubs && (
                                <div className="flex flex-col gap-1 border-t border-neutral-100 bg-neutral-50 px-3 py-2 pl-10">
                                    {topic.subtopics?.map((sub) => (
                                        <label
                                            key={sub.id}
                                            className="flex cursor-pointer items-start gap-2 rounded p-1 hover:bg-white"
                                        >
                                            <Checkbox
                                                checked={selectedLeafIds.has(sub.id)}
                                                onCheckedChange={(on) =>
                                                    setLeaves([sub.id], Boolean(on))
                                                }
                                                className="mt-0.5"
                                            />
                                            <span className="min-w-0">
                                                <span className="block break-words text-body text-neutral-600">
                                                    {sub.title}
                                                </span>
                                                {sub.keywords.length > 0 && (
                                                    <span className="block break-words text-caption text-neutral-400">
                                                        {sub.keywords.slice(0, 6).join(' · ')}
                                                    </span>
                                                )}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
