package vacademy.io.assessment_service.features.assessment.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Type;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;
import org.hibernate.usertype.UserType;

import java.util.Date;
import java.util.Map;

@Entity
@Table(name = "student_attempt")
@Data
@EqualsAndHashCode(of = "id")
public class StudentAttempt {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @ManyToOne
    @JoinColumn(name = "registration_id")
    private AssessmentUserRegistration registration;

    @Column(name = "attempt_number", nullable = false)
    private Integer attemptNumber;

    @Column(name = "start_time", nullable = false)
    private Date startTime;

    @Column(name = "submit_time")
    private Date submitTime;

    @Column(name = "preview_start_time")
    private Date previewStartTime;

    @Column(name = "max_time", nullable = false)
    private Integer maxTime;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "attempt_data")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> attemptData;

    @Column(name = "submit_data")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> submitData;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}