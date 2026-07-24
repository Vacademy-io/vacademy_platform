package vacademy.io.admin_core_service.features.enroll_invite.util;

import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;

import java.util.Date;

/**
 * Single source of truth for whether an enroll-invite link is currently accepting
 * enrollments, derived from its {@code status} and its optional
 * {@code [start_date, end_date]} window.
 *
 * <p>Used by the learner enroll endpoint ({@code getEnrollInvite}), the catalogue search
 * projection, and the server-side enrollment guard so every surface agrees on one
 * definition. The FE only <em>displays</em> availability (it may show the admin's
 * "unavailable" message); the actual enrollment block uses this on the server clock.
 *
 * <p>Dates are treated at day granularity and the window is <em>inclusive</em> of both the
 * start day and the end day — e.g. {@code start = end = today} means the link is open all
 * of today. {@code null} start/end means that side of the window is open.
 */
public final class EnrollInviteAvailabilityUtil {

    public static final String AVAILABLE = "AVAILABLE";
    public static final String EXPIRED = "EXPIRED";
    public static final String NOT_STARTED = "NOT_STARTED";
    public static final String INACTIVE = "INACTIVE";

    private static final long DAY_MS = 24L * 60 * 60 * 1000;

    private EnrollInviteAvailabilityUtil() {
    }

    public static String compute(String status, Date startDate, Date endDate) {
        // Only an EXPLICITLY non-ACTIVE status counts as deactivated. A null/blank status must not,
        // for two reasons:
        //   1. On the catalogue projection, a null status means the course has no default invite at
        //      all (LEFT JOIN miss) — reporting INACTIVE there would badge every invite-less course
        //      as "Enrollment closed".
        //   2. enroll_invite.status has no DB default and is copied verbatim from the create DTO, so
        //      an unset status historically enrolled fine; the enrollment guard must not start
        //      rejecting it.
        if (status != null && !status.isBlank() && !StatusEnum.ACTIVE.name().equals(status)) {
            return INACTIVE;
        }
        long now = System.currentTimeMillis();
        if (startDate != null && now < startDate.getTime()) {
            return NOT_STARTED;
        }
        // End date is inclusive: the link is only EXPIRED once the whole end day has passed.
        if (endDate != null && now >= endDate.getTime() + DAY_MS) {
            return EXPIRED;
        }
        return AVAILABLE;
    }

    public static String compute(EnrollInvite invite) {
        if (invite == null) {
            return INACTIVE;
        }
        return compute(invite.getStatus(), invite.getStartDate(), invite.getEndDate());
    }

    public static boolean isAvailable(EnrollInvite invite) {
        return AVAILABLE.equals(compute(invite));
    }
}
