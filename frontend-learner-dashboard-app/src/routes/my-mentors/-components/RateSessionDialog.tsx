import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "@phosphor-icons/react";
import { toast } from "sonner";
import { MyButton } from "@/components/design-system/button";
import { MyDialog } from "@/components/design-system/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
    submitSessionFeedback,
    type PendingFeedback,
} from "../-services/my-mentors-service";
import { RATING_LABELS, MAX_FEEDBACK_COMMENT } from "../-utils/feedback";

/**
 * Rate one finished mentor session. Stars are real buttons rather than a hover
 * widget so the control works with a keyboard and on touch, where hover doesn't
 * exist. The comment is optional — forcing prose is the fastest way to get no
 * ratings at all.
 */
export function RateSessionDialog({
    session,
    instituteId,
    open,
    onOpenChange,
}: {
    session: PendingFeedback | null;
    instituteId: string | undefined;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const queryClient = useQueryClient();

    useEffect(() => {
        if (open) {
            setRating(0);
            setComment("");
        }
    }, [open, session]);

    const submit = useMutation({
        mutationFn: () =>
            submitSessionFeedback({
                instituteId: instituteId ?? "",
                bookingInstanceId: session?.booking_instance_id ?? "",
                rating,
                comment: comment.trim() || undefined,
            }),
        onSuccess: () => {
            toast.success("Thanks — your feedback helps your mentor");
            queryClient.invalidateQueries({ queryKey: ["GET_PENDING_MENTOR_FEEDBACK"] });
            onOpenChange(false);
        },
        onError: (e: unknown) => {
            const message =
                (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                "Couldn't save your feedback. Please try again.";
            toast.error(message);
        },
    });

    if (!session) return null;

    return (
        <MyDialog
            heading="Rate your session"
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-md"
            footer={
                <div className="flex justify-end gap-2">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => onOpenChange(false)}
                    >
                        Not now
                    </MyButton>
                    <MyButton
                        type="button"
                        buttonType="primary"
                        scale="medium"
                        onClick={() => submit.mutate()}
                        disable={rating === 0 || submit.isPending || !instituteId}
                        title={rating === 0 ? "Pick a star rating first" : undefined}
                    >
                        {submit.isPending ? "Saving…" : "Submit feedback"}
                    </MyButton>
                </div>
            }
        >
            <div className="flex flex-col gap-4 p-1">
                <p className="text-body text-neutral-600">
                    How was <b>{session.session_title || "your session"}</b> with{" "}
                    <b>{session.mentor_name || "your mentor"}</b>?
                </p>

                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1" role="group" aria-label="Star rating">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
                                onClick={() => setRating(star)}
                                aria-label={`${star} star${star === 1 ? "" : "s"}`}
                                aria-pressed={rating === star}
                                className="rounded p-1 transition-transform hover:scale-110"
                            >
                                <Star
                                    size={30}
                                    weight={star <= rating ? "fill" : "regular"}
                                    className={
                                        star <= rating ? "text-warning-500" : "text-neutral-300"
                                    }
                                />
                            </button>
                        ))}
                    </div>
                    <span className="min-h-5 text-caption text-neutral-500">
                        {rating > 0 ? RATING_LABELS[rating] : "Tap a star to rate"}
                    </span>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label
                        htmlFor="session-feedback-comment"
                        className="text-caption font-medium text-neutral-600"
                    >
                        Anything you want to add?
                    </label>
                    <Textarea
                        id="session-feedback-comment"
                        value={comment}
                        maxLength={MAX_FEEDBACK_COMMENT}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="What worked, and what would help next time?"
                        className="min-h-20 resize-none"
                    />
                    <span className="flex items-center justify-between text-caption text-neutral-400">
                        <span>Optional. Shared with your institute, not other learners.</span>
                        <span>
                            {comment.length}/{MAX_FEEDBACK_COMMENT}
                        </span>
                    </span>
                </div>
            </div>
        </MyDialog>
    );
}
