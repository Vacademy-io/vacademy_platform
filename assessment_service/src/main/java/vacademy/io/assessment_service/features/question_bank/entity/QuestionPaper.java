package vacademy.io.assessment_service.features.question_bank.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.assessment_service.features.rich_text.entity.AssessmentRichTextData;

import java.sql.Timestamp;

@Entity
@Table(name = "question_paper")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class QuestionPaper {

    @Id
    @Column(name = "id", nullable = false)
    @UuidGenerator
    private String id;
    @Column(name = "title", nullable = false)
    private String title;
    @Column(name = "access")
    private String access;
    @Column(name = "difficulty")
    private String difficulty;
    @Column(name = "chapter_ids")
    private String communityChapterIds;
    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "description_id", referencedColumnName = "id", insertable = true, updatable = true)
    private AssessmentRichTextData description;
    @Column(name = "created_on", insertable = false, updatable = false)
    private Timestamp createdOn;
    @Column(name = "updated_on", insertable = false, updatable = false)
    private Timestamp updatedOn;
    @Column(name = "created_by_user_id", nullable = false)
    private String createdByUserId;

}
