package vacademy.io.admin_core_service.features.slide.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.admin_core_service.features.slide.dto.HtmlVideoSlideDTO;

import java.sql.Timestamp;

@Entity
@Getter
@Setter
@Table(name = "html_video_slide")
public class HtmlVideoSlide {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @Column(name = "ai_gen_video_id")
    private String aiGenVideoId;

    @Column(name = "url", length = 255)
    private String url;

    @Column(name = "video_length")
    private Long videoLengthInMillis;

    @Column(name = "created_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private Timestamp updatedAt;

    public HtmlVideoSlide() {
    }

    public HtmlVideoSlide(HtmlVideoSlideDTO dto) {
        this.id = dto.getId();
        this.aiGenVideoId = dto.getAiGenVideoId();
        this.url = dto.getUrl();
        this.videoLengthInMillis = dto.getVideoLengthInMillis();
    }
}
