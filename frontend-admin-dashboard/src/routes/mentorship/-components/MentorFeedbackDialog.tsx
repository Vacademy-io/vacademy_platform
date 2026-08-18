import { Star } from '@phosphor-icons/react';
import { MyDialog } from '@/components/design-system/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useMentorFeedback } from '../-hooks/use-mentorship';
import type { MentorDTO } from '../-types/mentorship-types';

function fmtDate(v?: number | null): string {
    if (!v) return '';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

/** Five stars with `filled` of them lit — the same shape learners rate with. */
function Stars({ filled, size = 14 }: { filled: number; size?: number }) {
    return (
        <span className="flex items-center gap-0.5" aria-label={`${filled} out of 5`}>
            {[1, 2, 3, 4, 5].map((star) => (
                <Star
                    key={star}
                    size={size}
                    weight={star <= filled ? 'fill' : 'regular'}
                    className={star <= filled ? 'text-warning-500' : 'text-neutral-300'}
                />
            ))}
        </span>
    );
}

/**
 * What learners actually said about a mentor's sessions. Read-only on purpose —
 * an admin editing or deleting learner feedback would make the average meaningless.
 */
export function MentorFeedbackDialog({
    mentor,
    instituteId,
    open,
    onOpenChange,
}: {
    mentor: MentorDTO | null;
    instituteId: string | undefined;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { data, isLoading, isError } = useMentorFeedback(
        open ? mentor?.id : undefined,
        open ? instituteId : undefined
    );
    const feedback = data ?? [];

    if (!mentor) return null;

    return (
        <MyDialog
            heading={`Session feedback — ${mentor.display_name || mentor.name || 'mentor'}`}
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-lg"
        >
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3">
                    {mentor.average_rating != null ? (
                        <>
                            <span className="text-h2 font-semibold tabular-nums text-neutral-700">
                                {mentor.average_rating.toFixed(1)}
                            </span>
                            <div className="flex flex-col">
                                <Stars filled={Math.round(mentor.average_rating)} size={16} />
                                <span className="text-caption text-neutral-500">
                                    from {mentor.rating_count ?? 0} rated{' '}
                                    {(mentor.rating_count ?? 0) === 1 ? 'session' : 'sessions'}
                                </span>
                            </div>
                        </>
                    ) : (
                        <span className="text-body text-neutral-500">
                            No sessions rated yet. Learners are asked to rate a session once it has
                            taken place.
                        </span>
                    )}
                </div>

                {isLoading ? (
                    <div className="flex flex-col gap-2">
                        {[1, 2].map((i) => (
                            <Skeleton key={i} className="h-16 w-full rounded-md" />
                        ))}
                    </div>
                ) : isError ? (
                    <p className="text-body text-danger-600">Couldn&apos;t load feedback.</p>
                ) : feedback.length === 0 ? (
                    <p className="text-caption text-neutral-400">
                        Nothing to show yet — ratings appear here as learners submit them.
                    </p>
                ) : (
                    <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
                        {feedback.map((f) => (
                            <div key={f.id} className="rounded-md border border-neutral-100 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <Stars filled={f.rating} />
                                    <span className="text-caption text-neutral-400">
                                        {f.student_name ? `${f.student_name} · ` : ''}
                                        {fmtDate(f.created_at)}
                                    </span>
                                </div>
                                {f.comment && (
                                    <p className="mt-1.5 text-caption text-neutral-600">
                                        {f.comment}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </MyDialog>
    );
}
