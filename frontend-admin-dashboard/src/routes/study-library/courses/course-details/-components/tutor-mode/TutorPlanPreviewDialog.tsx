import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { CircleNotch } from '@phosphor-icons/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { getTutorSlidePlan, type TutorPlanView } from '@/services/tutor';

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
                if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the plan');
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
                            <span className="text-sm font-normal text-neutral-500">{slideTitle}</span>
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
                            <p className="rounded-md bg-danger-50 p-3 text-sm text-danger-700">{plan.error}</p>
                        )}
                        {plan.objectives.length > 0 && (
                            <section>
                                <h4 className="mb-1 text-sm font-semibold text-neutral-800">Objectives</h4>
                                <ul className="list-disc space-y-0.5 pl-5 text-sm text-neutral-700">
                                    {plan.objectives.map((o, i) => (
                                        <li key={i}>{o}</li>
                                    ))}
                                </ul>
                            </section>
                        )}
                        {plan.topics.map((topic) => (
                            <section key={topic.id} className="rounded-lg border border-neutral-200 p-4">
                                <h4 className="mb-3 text-base font-semibold text-neutral-900">
                                    Board {topic.order}: {topic.title}
                                    {topic.estimated_seconds ? (
                                        <span className="ml-2 text-xs font-normal text-neutral-500">
                                            ~{Math.round(topic.estimated_seconds / 60)} min
                                        </span>
                                    ) : null}
                                </h4>
                                <div className="space-y-4">
                                    {topic.concepts.map((c) => (
                                        <div
                                            key={c.id}
                                            className="grid grid-cols-1 gap-3 md:grid-cols-2"
                                        >
                                            <div className="rounded-md border border-neutral-100 bg-neutral-50 p-3">
                                                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                                                    Board after concept {c.order}: {c.title}
                                                </p>
                                                <div
                                                    className="tutor-board-preview prose prose-sm max-w-none"
                                                    dangerouslySetInnerHTML={{
                                                        __html: DOMPurify.sanitize(c.board_html, {
                                                            USE_PROFILES: { html: true, svg: true },
                                                        }),
                                                    }}
                                                />
                                            </div>
                                            <div className="space-y-2 text-sm">
                                                <p>
                                                    <span className="font-medium text-neutral-800">Teacher says: </span>
                                                    <span className="text-neutral-700">{c.say}</span>
                                                </p>
                                                {Object.entries(c.say_i18n || {}).map(([lang, text]) => (
                                                    <p key={lang} className="text-neutral-500">
                                                        <span className="font-medium uppercase">{lang}: </span>
                                                        {text}
                                                    </p>
                                                ))}
                                                {c.check && c.check.type !== 'none' && (
                                                    <div className="rounded-md border border-primary-100 bg-primary-50 p-2">
                                                        <p className="text-xs font-medium uppercase text-primary-700">
                                                            Check · {String(c.check.type)}
                                                        </p>
                                                        <p className="text-neutral-800">{String(c.check.prompt ?? '')}</p>
                                                        {Array.isArray(c.check.options) && c.check.options.length > 0 && (
                                                            <ul className="mt-1 list-disc pl-5 text-neutral-700">
                                                                {(c.check.options as string[]).map((o, i) => (
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
