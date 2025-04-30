package vacademy.io.admin_core_service.features.slide.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.common.entity.RichTextData;
import vacademy.io.admin_core_service.features.slide.dto.OptionDTO;

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
    @UuidGenerator
    private String id;

    // Link to QuestionSlide (Many Options → One QuestionSlide)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id")
    private QuestionSlide questionSlide;

    // Foreign Keys
    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "text_id", referencedColumnName = "id")
    private RichTextData text;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "explanation_text_id", referencedColumnName = "id")
    private RichTextData explanationTextData;

    // Other Columns
    @Column(name = "media_id")
    private String mediaId;

    // Timestamps
    @Column(name = "created_on", insertable = false, updatable = false)
    private Timestamp createdOn;

    @Column(name = "updated_on", insertable = false, updatable = false)
    private Timestamp updatedOn;

    public Option(OptionDTO optionDTO, QuestionSlide questionSlide) {
        this.id = optionDTO.getId();

        this.text = new RichTextData(optionDTO.getText().getId(), optionDTO.getText().getType(), optionDTO.getText().getContent());

        this.questionSlide = questionSlide;

        this.explanationTextData = new RichTextData(optionDTO.getExplanationTextData().getId(), optionDTO.getExplanationTextData().getType(), optionDTO.getExplanationTextData().getContent());

        this.mediaId = optionDTO.getMediaId();
    }
}
