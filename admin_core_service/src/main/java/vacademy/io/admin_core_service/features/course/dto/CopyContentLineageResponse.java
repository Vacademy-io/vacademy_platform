package vacademy.io.admin_core_service.features.course.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Content-copy lineage for a single batch (package_session).
 *
 * - {@code copiedBy} / {@code copiedFrom} describe the upstream relationship:
 *   "this batch was seeded from that batch using this mode" (null when the
 *   batch was created from scratch).
 * - {@code copiedTo} is the downstream fan-out: every batch that has been
 *   seeded from this one, with the mode each child used.
 *
 * Mode values mirror the audit column: "VALUE" (separate copy / deep clone)
 * or "REFERENCE" (linked copy / shared rows).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CopyContentLineageResponse {

    private String packageSessionId;
    private String copiedBy;
    private BatchRef copiedFrom;
    private List<BatchRef> copiedTo;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BatchRef {
        private String packageSessionId;
        private String courseId;
        private String courseName;
        private String sessionName;
        private String levelName;
        /** Mode the child used when copying. Null on the {@code copiedFrom} side. */
        private String copiedBy;
    }
}
