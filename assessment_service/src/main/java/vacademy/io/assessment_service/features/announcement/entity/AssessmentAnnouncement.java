package vacademy.io.assessment_service.features.annoucement.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.rich_text.entity.AssessmentRichTextData;

import java.util.Date;

@Entity
@Table(name = "assessment_announcement")
@Data
@Builder
public class AssessmentAnnouncement {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @ManyToOne
    @JoinColumn(name = "assessment_id")
    @JsonIgnore
    private Assessment assessment;

    @ManyToOne
    @JoinColumn(name = "rich_text_id")
    @JsonIgnore
    private AssessmentRichTextData assessmentRichTextData;

    @ManyToOne
    @JoinColumn(name = "attempt_id")
    @JsonIgnore
    private StudentAttempt studentAttempt;

    @Column(name = "sent_time")
    private Date sentTime;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
