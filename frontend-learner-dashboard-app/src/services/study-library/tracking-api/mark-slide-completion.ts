import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { MARK_SLIDE_COMPLETION } from "@/constants/urls";

/**
 * Explicit learner-driven completion for a slide — the "Mark as complete"
 * control every mainstream course player puts beside a lesson.
 *
 * This is a sibling of the automatic add-*-activity calls, not a replacement:
 * consumption tracking still drives completion on its own. It writes the same
 * learner_operation the automatic path writes, so chapter / module / course
 * progress, drip unlocks and certificate thresholds all move together.
 *
 * Reversible — pass completed=false and the backend recomputes the slide's real
 * percentage from its activity logs rather than zeroing it, so un-marking a
 * half-watched video leaves it half-watched.
 */
export async function markSlideCompletion(params: {
  slideId: string;
  slideType: string;
  chapterId?: string;
  moduleId?: string;
  subjectId?: string;
  packageSessionId?: string;
  completed: boolean;
}): Promise<boolean> {
  const { completed, ...rest } = params;
  const query = new URLSearchParams({ completed: String(completed) });
  Object.entries(rest).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const res = await authenticatedAxiosInstance.post(
    `${MARK_SLIDE_COMPLETION}?${query.toString()}`
  );
  return res?.data === true || res?.data?.data === true;
}
