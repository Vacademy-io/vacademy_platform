package vacademy.io.admin_core_service.features.student_analysis.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;
import java.time.LocalDate;

@Entity
@Table(name = "student_analysis_process")
@Getter
@Setter
@NoArgsConstructor
public class StudentAnalysisProcess {

        @Id
        @UuidGenerator
        private String id;

        @Column(name = "user_id", nullable = false)
        private String userId;

        @Column(name = "institute_id", nullable = false)
        private String instituteId;

        @Column(name = "start_date_iso", nullable = false)
        private LocalDate startDateIso; // ISO 8601 format: YYYY-MM-DD

        @Column(name = "end_date_iso", nullable = false)
        private LocalDate endDateIso; // ISO 8601 format: YYYY-MM-DD

        @Column(name = "status", nullable = false)
        private String status; // PENDING, PROCESSING, COMPLETED, FAILED

        @Column(name = "report_json", columnDefinition = "TEXT")
        private String reportJson;

        @Column(name = "error_message", columnDefinition = "TEXT")
        private String errorMessage;

        @Column(name = "created_at", insertable = false, updatable = false)
        private Timestamp createdAt;

        @Column(name = "updated_at", insertable = false, updatable = false)
        private Timestamp updatedAt;

        // ── v2 extension columns (all nullable, additive) ──────────────────────
        /** 'v1' for legacy rows, 'v2' for the comprehensive report. */
        @Column(name = "report_version", length = 20)
        private String reportVersion;

        /** Admin-given report name (auto-generated from the date range if not provided). */
        @Column(name = "name", length = 255)
        private String name;

        /** Email the learner on completion (default true / opt-out). Push + in-app alert always fire. */
        @Column(name = "send_email")
        private Boolean sendEmail;

        /** File ID of the rendered PDF in media_service. */
        @Column(name = "pdf_file_id", length = 255)
        private String pdfFileId;

        /** Batch (package_session) scope for attendance/progress collectors. */
        @Column(name = "batch_id", length = 255)
        private String batchId;

        /** Package session scope (alias for batch_id, kept for API symmetry). */
        @Column(name = "package_session_id", length = 255)
        private String packageSessionId;

        /** CSV of report modules to include (v2 only). Null → all modules. */
        @Column(name = "included_modules", columnDefinition = "TEXT")
        private String includedModules;

        public StudentAnalysisProcess(String userId, String instituteId, LocalDate startDateIso, LocalDate endDateIso) {
                this.userId = userId;
                this.instituteId = instituteId;
                this.startDateIso = startDateIso;
                this.endDateIso = endDateIso;
                this.status = "PENDING";
                this.reportVersion = "v1";
        }
}
