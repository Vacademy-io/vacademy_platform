package vacademy.io.admin_core_service.features.planning_logs.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.sql.Timestamp;

@Entity
@Table(name = "teacher_planning_logs")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeacherPlanningLog {

        @Id
        @Column(name = "id", nullable = false)
        private String id;

        @Column(name = "created_by_user_id", nullable = false)
        private String createdByUserId;

        @Column(name = "log_type", nullable = false, length = 20)
        private String logType;

        @Column(name = "entity", nullable = false, length = 50)
        private String entity;

        @Column(name = "entity_id", nullable = false)
        private String entityId;

        @Column(name = "interval_type", nullable = false, length = 20)
        private String intervalType;

        @Column(name = "interval_type_id", nullable = false, length = 50)
        private String intervalTypeId;

        @Column(name = "title", nullable = false)
        private String title;

        @Column(name = "description", columnDefinition = "TEXT")
        private String description;

        @Column(name = "content", nullable = false, columnDefinition = "TEXT")
        private String content;

        @Column(name = "subject_id", nullable = false)
        private String subjectId;

        @Column(name = "comma_separated_file_ids", columnDefinition = "TEXT")
        private String commaSeparatedFileIds;

        @Column(name = "status", nullable = false, length = 20)
        private String status;

        @Column(name = "institute_id", nullable = false)
        private String instituteId;

        @Column(name = "is_shared_with_student", nullable = false)
        private Boolean isSharedWithStudent;

        @CreationTimestamp
        @Column(name = "created_at", nullable = false, updatable = false)
        private Timestamp createdAt;

        @UpdateTimestamp
        @Column(name = "updated_at", nullable = false)
        private Timestamp updatedAt;
}
