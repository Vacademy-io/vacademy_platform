package vacademy.io.assessment_service.features.question_core.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import vacademy.io.assessment_service.features.rich_text.entity.AssessmentRichTextData;

import java.sql.Timestamp;

@Entity
@Table(name = "option")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class Option {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @ManyToOne
    @JoinColumn(name = "question_id", nullable = true)
    private Question question; // Reference to the Question entity

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "text_id", referencedColumnName = "id", insertable = true, updatable = true)
    private AssessmentRichTextData text;

    @Column(name = "media_id")
    private String mediaId;

    @Column(name = "created_on", insertable = false, updatable = false)
    private Timestamp createdOn;

    @Column(name = "updated_on", insertable = false, updatable = false)
    private Timestamp updatedOn;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "explanation_text_id", referencedColumnName = "id", insertable = true, updatable = true)
    private AssessmentRichTextData explanationTextData;

}
