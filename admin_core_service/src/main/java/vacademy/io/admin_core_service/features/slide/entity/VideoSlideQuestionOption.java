package vacademy.io.admin_core_service.features.slide.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.common.entity.RichTextData;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.admin_core_service.features.slide.dto.VideoSlideQuestionOptionDTO;

import java.sql.Timestamp;

@Entity
@Getter
@Setter
@Table(name = "video_slide_question_options")
public class VideoSlideQuestionOption {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "video_slide_question_id", nullable = false)
    private VideoSlideQuestion videoSlideQuestion;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "text_id", referencedColumnName = "id")
    private RichTextData text;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "explanation_text_id", referencedColumnName = "id")
    private RichTextData explanationTextData;

    @Column(name = "media_id")
    private String mediaId;

    @Column(name = "created_on", insertable = false, updatable = false)
    private Timestamp createdOn;

    @Column(name = "updated_on", insertable = false, updatable = false)
    private Timestamp updatedOn;

    public VideoSlideQuestionOption(VideoSlideQuestionOptionDTO dto, VideoSlideQuestion parentQuestion) {
        this.id = dto.getId(); // Only set if present (for update cases)
        this.videoSlideQuestion = parentQuestion;

        if (dto.getText() != null) {
            this.text = new RichTextData(dto.getText());
        }

        if (dto.getExplanationTextData() != null) {
            this.explanationTextData = new RichTextData(dto.getExplanationTextData());
        }

        this.mediaId = dto.getMediaId();
    }

    public VideoSlideQuestionOption() {}

}
