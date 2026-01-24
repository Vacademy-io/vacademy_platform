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

        public StudentAnalysisProcess(String userId, String instituteId, LocalDate startDateIso, LocalDate endDateIso) {
                this.userId = userId;
                this.instituteId = instituteId;
                this.startDateIso = startDateIso;
                this.endDateIso = endDateIso;
                this.status = "PENDING";
        }
}
