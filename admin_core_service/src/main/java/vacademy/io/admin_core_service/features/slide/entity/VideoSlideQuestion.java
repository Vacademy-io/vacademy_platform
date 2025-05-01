package vacademy.io.admin_core_service.features.slide.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.common.entity.RichTextData;
import vacademy.io.admin_core_service.features.slide.dto.VideoSlideQuestionDTO;

import java.sql.Timestamp;
import java.util.List;

@Entity
@Getter
@Setter
public class VideoSlideQuestion {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false)
    private String id;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "parent_rich_text_id", referencedColumnName = "id")
    private RichTextData parentRichText;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "text_id", referencedColumnName = "id")
    private RichTextData textData;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "explanation_text_id", referencedColumnName = "id")
    private RichTextData explanationTextData;

    @Column(name = "media_id")
    private String mediaId;

    @Column(name = "question_response_type", nullable = false)
    private String questionResponseType;

    @Column(name = "question_type", nullable = false)
    private String questionType;

    @Column(name = "access_level", nullable = false)
    private String accessLevel;

    @Column(name = "auto_evaluation_json")
    private String autoEvaluationJson;

    @Column(name = "evaluation_type")
    private String evaluationType;

    @Column(name = "question_order")
    private Integer questionOrder;

    @Column(name = "question_time_in_millis")
    private Long questionTimeInMillis;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "video_slide_id")
    private VideoSlide videoSlide;

    @Column(name = "status")
    private String status;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    @OneToMany(mappedBy = "videoSlideQuestion", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<VideoSlideQuestionOption> options;

    public VideoSlideQuestion(VideoSlideQuestionDTO dto, VideoSlide videoSlide) {
        this.parentRichText = new RichTextData(dto.getParentRichText());
        this.textData = new RichTextData(dto.getTextData());
        this.explanationTextData = new RichTextData(dto.getExplanationTextData());
        this.mediaId = dto.getMediaId();
        this.questionResponseType = dto.getQuestionResponseType();
        this.questionType = dto.getQuestionType();
        this.accessLevel = dto.getAccessLevel();
        this.autoEvaluationJson = dto.getAutoEvaluationJson();
        this.evaluationType = dto.getEvaluationType();
        this.questionOrder = dto.getQuestionOrder();
        this.questionTimeInMillis = dto.getQuestionTimeInMillis();
        this.videoSlide = videoSlide;
        this.status = dto.getStatus();
        if (dto.getOptions() != null) {
            this.options = dto.getOptions().stream()
                    .map(optDto -> new VideoSlideQuestionOption(optDto, this))
                    .toList();
        }
    }

}

