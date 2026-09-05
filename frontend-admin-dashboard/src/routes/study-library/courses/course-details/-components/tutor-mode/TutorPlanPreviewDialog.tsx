import { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { CircleNotch, Play } from '@phosphor-icons/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { getTutorSlidePlan, type TutorConceptView, type TutorPlanView } from '@/services/tutor';
import { animateBoard } from '@/components/common/tutor/animateBoard';
import '@/styles/tutor-board.css';

/**
 * One stored board with a Play button that animates it the way the learner
 * sees it (elements write in, diagrams draw on, stepped parts appear in
 * order). `ops` is the topic's cumulative ops up to this concept.
 */
const AnimatedBoard: React.FC<{
    html: string;
    ops: Array<Record<string, unknown>>;
    autoPlay?: boolean;
}> = ({ html, ops, autoPlay }) => {
    const ref = useRef<HTMLDivElement>(null);
    const timers = useRef<number[]>([]);
    const play = () => {
        timers.current.forEach((t) => window.clearTimeout(t));
        if (ref.current)
            timers.current = animateBoard(
                ref.current,
                ops as Array<{ op?: unknown; parts?: Array<{ id?: unknown; step?: unknown }> }>
            );
    };
    useEffect(() => {
        if (autoPlay) play();
        return () => timers.current.forEach((t) => window.clearTimeout(t));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [html]);
    return (
        <div className="relative">
            <div
                ref={ref}
                className="tutor-board-preview max-w-none"
                dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(html, { USE_PROFILES: { html: true, svg: true } }),
                }}
            />
            <button
                type="button"
                title="Play this board as the learner sees it"
                onClick={play}
                className="absolute end-2 top-2 inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 shadow-sm hover:bg-neutral-50"
            >
                <Play className="size-3" weight="fill" /> Play
            </button>
        </div>
    );
};

/** The topic's ops up to and including this concept (parts carry the steps). */
const cumulativeOps = (
    concepts: TutorConceptView[],
    upTo: number
): Array<Record<string, unknown>> => concepts.slice(0, upTo + 1).flatMap((c) => c.board_ops);

interface TutorPlanPreviewDialogProps {
    slideId: string | null;
    slideTitle?: string | null;
    onClose: () => void;
}

/**
 * Read-only preview of a slide's compiled teaching plan: each topic is one
 * whiteboard, each concept shows its board (server-materialized HTML), what
 * the teacher says, and the check it asks. The HTML was sanitized when the
 * plan was stored; DOMPurify here is belt and braces.
 */
export const TutorPlanPreviewDialog: React.FC<TutorPlanPreviewDialogProps> = ({
    slideId,
    slideTitle,
    onClose,
}) => {
    const [plan, setPlan] = useState<TutorPlanView | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!slideId) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        setPlan(null);
        getTutorSlidePlan(slideId)
            .then((p) => {
                if (!cancelled) setPlan(p);
            })
            .catch((e: unknown) => {
                if (!cancelled)
                    setError(e instanceof Error ? e.message : 'Could not load the plan');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [slideId]);

    return (
        <Dialog open={!!slideId} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-screen w-full max-w-4xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex flex-wrap items-center gap-2">
                        <span>Teaching plan</span>
                        {slideTitle && (
                            <span className="text-sm font-normal text-neutral-500">
                                {slideTitle}
                            </span>
                        )}
                        {plan && (
                            <Badge variant="outline" className="ml-auto">
                                v{plan.version} · {plan.status} · {plan.language}
                            </Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>

                {loading && (
                    <div className="flex items-center gap-2 p-6 text-sm text-neutral-500">
                        <CircleNotch className="size-4 animate-spin" /> Loading plan…
                    </div>
                )}
                {error && <p className="p-4 text-sm text-danger-600">{error}</p>}

                {plan && (
                    <div className="space-y-6">
                        {plan.error && (
                            <p className="rounded-md bg-danger-50 p-3 text-sm text-danger-700">
                                {plan.error}
                            </p>
                        )}
                        {plan.objectives.length > 0 && (
                            <section>
                                <h4 className="mb-1 text-sm font-semibold text-neutral-800">
                                    Objectives
                                </h4>
                                <ul className="list-disc space-y-0.5 ps-5 text-sm text-neutral-700">
                                    {plan.objectives.map((o, i) => (
                                        <li key={i}>{o}</li>
                                    ))}
                                </ul>
                            </section>
                        )}
                        {plan.topics.map((topic) => (
                            <section
                                key={topic.id}
                                className="rounded-lg border border-neutral-200 p-4"
                            >
                                <h4 className="mb-3 text-base font-semibold text-neutral-900">
                                    Board {topic.order}: {topic.title}
                                    {topic.estimated_seconds ? (
                                        <span className="ml-2 text-xs font-normal text-neutral-500">
                                            ~{Math.round(topic.estimated_seconds / 60)} min
                                        </span>
                                    ) : null}
                                </h4>
                                <div className="space-y-4">
                                    {topic.concepts.map((c, ci) => (
                                        <div
                                            key={c.id}
                                            className="grid grid-cols-1 gap-3 md:grid-cols-2"
                                        >
                                            <div className="rounded-md border border-neutral-100 bg-neutral-50 p-3">
                                                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                                                    Board after concept {c.order}: {c.title}
                                                </p>
                                                <AnimatedBoard
                                                    html={c.board_html}
                                                    ops={cumulativeOps(topic.concepts, ci)}
                                                    autoPlay={ci === 0}
                                                />
                                            </div>
                                            <div className="space-y-2 text-sm">
                                                <p>
                                                    <span className="font-medium text-neutral-800">
                                                        Teacher says:{' '}
                                                    </span>
                                                    <span className="text-neutral-700">
                                                        {c.say}
                                                    </span>
                                                </p>
                                                {Object.entries(c.say_i18n || {}).map(
                                                    ([lang, text]) => (
                                                        <p key={lang} className="text-neutral-500">
                                                            <span className="font-medium uppercase">
                                                                {lang}:{' '}
                                                            </span>
                                                            {text}
                                                        </p>
                                                    )
                                                )}
                                                {c.check && c.check.type !== 'none' && (
                                                    <div className="rounded-md border border-primary-100 bg-primary-50 p-2">
                                                        <p className="text-xs font-medium uppercase text-primary-700">
                                                            Check · {String(c.check.type)}
                                                        </p>
                                                        <p className="text-neutral-800">
                                                            {String(c.check.prompt ?? '')}
                                                        </p>
                                                        {Array.isArray(c.check.options) &&
                                                            c.check.options.length > 0 && (
                                                                <ul className="mt-1 list-disc ps-5 text-neutral-700">
                                                                    {(
                                                                        c.check.options as string[]
                                                                    ).map((o, i) => (
                                                                        <li key={i}>{o}</li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        {c.check.expected ? (
                                                            <p className="mt-1 text-xs text-neutral-600">
                                                                Expected: {String(c.check.expected)}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                )}
                                                {c.teach_notes && (
                                                    <p className="text-xs text-neutral-500">
                                                        <span className="font-medium">Notes: </span>
                                                        {c.teach_notes}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
