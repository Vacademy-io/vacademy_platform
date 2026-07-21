package vacademy.io.notification_service.features.engagement_ledger.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Batched ledger read for the Engagement Engine (admin_core): one call per decision cohort,
 * never one call per member. Subjects are matched by identifier — phone for WhatsApp rows,
 * email for email rows; userId is accepted for forward-compat (in-app receipts) but unused today.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LedgerBatchRequest {

    public static final int MAX_SUBJECTS = 500;

    private String instituteId;

    /** Window for the "recent*" counters, in days. Defaults to 7. */
    private Integer recentWindowDays;

    private List<Subject> subjects;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Subject {
        /** Caller's key for this subject (e.g. engagement_member.id) — echoed back verbatim. */
        private String key;
        private String userId;
        private String phone;
        private String email;
    }
}
