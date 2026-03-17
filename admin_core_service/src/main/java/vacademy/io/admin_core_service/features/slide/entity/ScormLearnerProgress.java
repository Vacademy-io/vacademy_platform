package vacademy.io.admin_core_service.features.slide.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.sql.Timestamp;

@Entity
@Getter
@Setter
@Table(name = "scorm_learner_progress")
public class ScormLearnerProgress {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "slide_id", nullable = false)
    private String slideId;

    @Column(name = "attempt_number")
    private Integer attemptNumber;

    @Column(name = "completion_status")
    private String completionStatus;

    @Column(name = "success_status")
    private String successStatus;

    @Column(name = "score_raw")
    private Double scoreRaw;

    @Column(name = "score_min")
    private Double scoreMin;

    @Column(name = "score_max")
    private Double scoreMax;

    @Column(name = "total_time")
    private String totalTime;

    @Column(name = "cmi_suspend_data", columnDefinition = "TEXT")
    private String cmiSuspendData;

    @Column(name = "cmi_location")
    private String cmiLocation;

    @Column(name = "cmi_exit")
    private String cmiExit;

    @Column(name = "cmi_json", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String cmiJson;

    @Column(name = "created_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private Timestamp updatedAt;
}
