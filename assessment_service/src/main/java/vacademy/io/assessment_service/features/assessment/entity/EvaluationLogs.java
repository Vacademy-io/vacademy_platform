package vacademy.io.assessment_service.features.assessment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Builder;
import lombok.Data;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "evaluation_logs")
@Data
@Builder
public class EvaluationLogs {
    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "source")
    private String source;

    @Column(name = "source_id")
    private String sourceId;

    @Column(name = "type")
    private String type;

    @Column(name = "learner_id")
    private String learnerId;

    @Column(name = "data_json")
    private String dataJson;

    @Column(name = "author_id")
    private String authorId;

    @Column(name = "date_and_time")
    private Date dateAndTime;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
