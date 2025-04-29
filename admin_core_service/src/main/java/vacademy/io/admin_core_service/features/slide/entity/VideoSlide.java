package vacademy.io.admin_core_service.features.slide.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.admin_core_service.features.slide.dto.VideoSlideDTO;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;

import java.sql.Timestamp;

@Entity
@Getter
@Setter
@Table(name = "video")
public class VideoSlide {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @Column(name = "description", length = 255)
    private String description;

    @Column(name = "title", length = 255)  // Assuming there is a title column (not included in your original code)
    private String title;

    @Column(name = "url", length = 255)
    private String url;

    @Column(name = "video_length")
    private Long videoLengthInMillis;

    @Column(name = "published_url", length = 255)
    private String publishedUrl;

    @Column(name = "source_type", length = 255)
    private String sourceType;//YOUTUBE,DRIVE

    @Column(name = "published_video_length")
    private Long publishedVideoLengthInMillis;

    @Column(name = "created_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private Timestamp updatedAt;

    public VideoSlide(VideoSlideDTO addVideoSlideDTO, String status) {
        this.description = addVideoSlideDTO.getDescription();
        this.title = addVideoSlideDTO.getTitle();
        this.url = addVideoSlideDTO.getUrl();
        this.id = addVideoSlideDTO.getId();
        if (addVideoSlideDTO.getVideoLengthInMillis() != null) {
            this.videoLengthInMillis = addVideoSlideDTO.getVideoLengthInMillis();
        }
        if (status.equalsIgnoreCase(SlideStatus.PUBLISHED.name())) {
            if (addVideoSlideDTO.getPublishedUrl() != null) {
                this.publishedUrl = addVideoSlideDTO.getPublishedUrl();
            }
            if (addVideoSlideDTO.getPublishedVideoLengthInMillis() != null) {
                this.publishedVideoLengthInMillis = addVideoSlideDTO.getPublishedVideoLengthInMillis();
            }
        }
        this.setSourceType(addVideoSlideDTO.getSourceType());
    }

    public VideoSlide() {
    }
}
