package vacademy.io.assessment_service.features.assessment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.assessment_service.features.assessment.dto.EvaluationLogDto;

import java.util.Date;

@Entity
@Table(name = "evaluation_logs")
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
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


    public EvaluationLogDto getEvaluationDto(){
        return EvaluationLogDto.builder()
                .id(this.id)
                .sourceId(this.source)
                .sourceId(this.sourceId)
                .type(this.type)
                .learnerId(this.learnerId)
                .dataJson(this.dataJson)
                .authorId(this.authorId)
                .dateAndTime(this.dateAndTime)
                .build();
    }
}
