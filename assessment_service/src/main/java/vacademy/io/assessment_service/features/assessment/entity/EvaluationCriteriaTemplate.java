package vacademy.io.assessment_service.features.assessment.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "evaluation_criteria_template")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EvaluationCriteriaTemplate {

        @Id
        @UuidGenerator
        @Column(name = "id")
        private String id;

        @Column(name = "name", nullable = false)
        private String name;

        @Column(name = "subject", length = 100)
        private String subject;

        @Column(name = "question_type", length = 50)
        private String questionType;

        @Column(name = "criteria_json", nullable = false, columnDefinition = "TEXT")
        private String criteriaJson;

        @Column(name = "description", columnDefinition = "TEXT")
        private String description;

        @Column(name = "is_active")
        private Boolean isActive;

        @Column(name = "created_by", length = 36)
        private String createdBy;

        @Column(name = "created_at", insertable = false, updatable = false)
        private Date createdAt;

        @Column(name = "updated_at", insertable = false, updatable = false)
        private Date updatedAt;
}
