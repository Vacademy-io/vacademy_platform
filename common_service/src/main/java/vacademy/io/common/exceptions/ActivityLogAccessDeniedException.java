package vacademy.io.common.exceptions;

/**
 * Thrown when a caller sends an activity-log id that resolves to a row owned by
 * a different learner.
 *
 * Activity ids are generated client-side and sent back on every flush, so the
 * id in a request is untrusted input: without this check a learner could pass
 * someone else's id and rewrite their start/end time and percentage watched,
 * which feed engaged time and the leaderboard. Extends {@link ForbiddenException}
 * so it maps to HTTP 403 through the existing handler while still naming the
 * specific failure in logs and responses.
 */
public class ActivityLogAccessDeniedException extends ForbiddenException {

    public ActivityLogAccessDeniedException(String activityId) {
        super("Activity log " + activityId + " does not belong to this user");
    }
}
