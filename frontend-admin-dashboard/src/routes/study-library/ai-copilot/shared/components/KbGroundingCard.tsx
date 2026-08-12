import { useEffect, useState } from 'react';
import { BookOpenText, CaretDown, CaretUp, Sparkle } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useKnowledgeBases } from '@/routes/knowledge-base/-hooks';
import { getTopics } from '@/routes/knowledge-base/-services/paper-service';
import {
    TopicPicker,
    toSelectedNodeIds,
} from '@/routes/knowledge-base/-components/paper/TopicPicker';
import type { KbTopic } from '@/routes/knowledge-base/-types/paper';

export type KbGroundingMode = 'STRICT' | 'BLENDED';

export interface KbGroundingValue {
    knowledge_base_id: string;
    node_ids: string[];
    mode: KbGroundingMode;
}

interface KbGroundingCardProps {
    value: KbGroundingValue | null;
    onChange: (value: KbGroundingValue | null) => void;
    /**
     * Fired when the chosen topics imply a course shape, so chapter and slide
     * counts can stop being arbitrary numbers and follow the material instead.
     */
    onStructureSuggested?: (chapters: number, slidesPerChapter: number) => void;
}

const MODES: Array<{ value: KbGroundingMode; label: string; help: string }> = [
    {
        value: 'STRICT',
        label: 'Only this material',
        help: 'Slides the material does not cover are flagged instead of being written from general knowledge.',
    },
    {
        value: 'BLENDED',
        label: 'Fill the gaps',
        help: 'Where the material is thin, the AI adds its own explanation to keep the course complete.',
    },
];

/**
 * Build a course from material the institute already owns.
 *
 * This is a course setting rather than an "additional option": it changes what
 * the course IS. With it, the outline follows the material's real topic
 * structure and every slide is written from the pages about its own subject —
 * instead of the model's general knowledge with the institute's diagrams
 * pasted on top.
 */
export const KbGroundingCard = ({
    value,
    onChange,
    onStructureSuggested,
}: KbGroundingCardProps) => {
    const { data: bases, isLoading } = useKnowledgeBases();
    const [topics, setTopics] = useState<KbTopic[] | null>(null);
    const [selectedLeafIds, setSelectedLeafIds] = useState<Set<string>>(new Set());
    const [showTopics, setShowTopics] = useState(false);

    const kbId = value?.knowledge_base_id ?? '';
    const mode = value?.mode ?? 'STRICT';

    // Load topics whenever the chosen knowledge base changes, and start with
    // everything ticked so the teacher narrows down rather than opting in to a
    // whole syllabus before anything happens.
    useEffect(() => {
        if (!kbId) {
            setTopics(null);
            setSelectedLeafIds(new Set());
            return undefined;
        }
        let cancelled = false;
        setTopics(null);
        getTopics(kbId)
            .then((list) => {
                if (cancelled) return;
                setTopics(list);
                const leaves = new Set<string>();
                list.forEach((topic) => {
                    if (topic.subtopics?.length) {
                        topic.subtopics.forEach((s) => leaves.add(s.id));
                    } else {
                        leaves.add(topic.id);
                    }
                });
                setSelectedLeafIds(leaves);
            })
            .catch(() => !cancelled && setTopics([]));
        return () => {
            cancelled = true;
        };
    }, [kbId]);

    // Push the selection upward, and let the course shape follow the material.
    useEffect(() => {
        if (!kbId || topics === null) return;
        const nodeIds = toSelectedNodeIds(topics, selectedLeafIds);
        onChange({ knowledge_base_id: kbId, node_ids: nodeIds, mode });

        const chosenTopics = topics.filter((t) =>
            t.subtopics?.length
                ? t.subtopics.some((s) => selectedLeafIds.has(s.id))
                : selectedLeafIds.has(t.id)
        );
        if (chosenTopics.length > 0 && onStructureSuggested) {
            const subtopicCounts = chosenTopics.map(
                (t) => t.subtopics?.filter((s) => selectedLeafIds.has(s.id)).length || 1
            );
            const avg = Math.round(
                subtopicCounts.reduce((a, b) => a + b, 0) / subtopicCounts.length
            );
            onStructureSuggested(chosenTopics.length, Math.max(1, avg));
        }
        // onChange/onStructureSuggested are recreated each render by the parent;
        // depending on them would loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kbId, topics, selectedLeafIds, mode]);

    const selectedCount = topics
        ? topics.filter((t) =>
              t.subtopics?.length
                  ? t.subtopics.some((s) => selectedLeafIds.has(s.id))
                  : selectedLeafIds.has(t.id)
          ).length
        : 0;

    if (isLoading) return <Skeleton className="h-12 w-full rounded-lg" />;
    if (!bases || bases.length === 0) return null;

    return (
        <div className="mb-3 flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
                <BookOpenText className="size-4 shrink-0 text-primary-500" />
                <span className="text-caption font-medium text-neutral-700">Build from</span>

                <Select
                    value={kbId || 'none'}
                    onValueChange={(next) =>
                        next === 'none'
                            ? onChange(null)
                            : onChange({ knowledge_base_id: next, node_ids: [], mode })
                    }
                >
                    <SelectTrigger className="h-8 w-auto min-w-48 rounded-full border-neutral-200 bg-white px-3 text-caption">
                        <SelectValue placeholder="My own material" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">Don&apos;t use my material</SelectItem>
                        {bases.map((kb) => (
                            <SelectItem key={kb.id} value={kb.id}>
                                {kb.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {kbId && topics !== null && topics.length > 0 && (
                    <MyButton
                        buttonType="text"
                        scale="small"
                        onClick={() => setShowTopics((s) => !s)}
                    >
                        {selectedCount} of {topics.length} topics
                        {showTopics ? (
                            <CaretUp className="ml-1 size-3.5" />
                        ) : (
                            <CaretDown className="ml-1 size-3.5" />
                        )}
                    </MyButton>
                )}
            </div>

            {kbId && (
                <>
                    <div className="flex flex-wrap gap-2">
                        {MODES.map((m) => (
                            <button
                                key={m.value}
                                type="button"
                                onClick={() =>
                                    onChange({
                                        knowledge_base_id: kbId,
                                        node_ids: topics
                                            ? toSelectedNodeIds(topics, selectedLeafIds)
                                            : [],
                                        mode: m.value,
                                    })
                                }
                                className={cn(
                                    'rounded-full border px-3 py-1 text-caption transition-colors',
                                    mode === m.value
                                        ? 'border-primary-500 bg-primary-50 font-medium text-primary-500'
                                        : 'border-neutral-200 text-neutral-600 hover:border-primary-300'
                                )}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                    <p className="text-caption text-neutral-500">
                        {MODES.find((m) => m.value === mode)?.help}
                    </p>

                    {topics === null && <Skeleton className="h-24 w-full rounded-lg" />}

                    {topics !== null && topics.length === 0 && (
                        <p className="text-caption text-neutral-400">
                            This knowledge base has no topics yet, so the whole of it will be used.
                        </p>
                    )}

                    {showTopics && topics !== null && topics.length > 0 && (
                        <TopicPicker
                            topics={topics}
                            selectedLeafIds={selectedLeafIds}
                            onChange={setSelectedLeafIds}
                        />
                    )}

                    <p className="flex items-start gap-1.5 text-caption text-neutral-400">
                        <Sparkle className="mt-0.5 size-3.5 shrink-0" />
                        Every slide will be written from the pages about its own topic, and will
                        show which page it came from.
                    </p>
                </>
            )}
        </div>
    );
};
