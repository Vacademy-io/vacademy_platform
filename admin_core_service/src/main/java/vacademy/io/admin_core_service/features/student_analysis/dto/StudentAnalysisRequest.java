package vacademy.io.admin_core_service.features.student_analysis.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StudentAnalysisRequest {
        private String userId;
        private String instituteId;
        private LocalDate startDateIso; // ISO 8601 format: YYYY-MM-DD
        private LocalDate endDateIso;   // ISO 8601 format: YYYY-MM-DD

        /** Optional admin-given report name. Blank/null → auto-generated from the date range. */
        private String name;

        /** Email the learner when the report is ready. Default true (opt-out). Push + in-app alert are always sent. */
        private Boolean sendEmail;

        // ── v2 extension fields (optional; null → defaults to "v1") ──────────
        /** "v1" (default) or "v2" (comprehensive report). */
        @Builder.Default
        private String reportVersion = "v1";

        /** Batch (package_session) id to scope attendance/progress collectors. */
        private String batchId;

        /** Package session id — same as batchId, kept for API symmetry. */
        private String packageSessionId;

        /**
         * v2 only: which report modules to include (e.g. ["attendance","academics","progress"]).
         * Valid keys: attendance, live_classes, academics, activity, progress, certificates,
         * assignments, doubts, login. Null/empty → all modules. Only the selected modules are queried.
         */
        private List<String> includeModules;
}
