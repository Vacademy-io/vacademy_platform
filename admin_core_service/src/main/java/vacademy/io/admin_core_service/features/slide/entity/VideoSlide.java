package vacademy.io.admin_core_service.features.slide.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.slide.dto.AddVideoSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.VideoSlideDTO;

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

    @Column(name = "created_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private Timestamp updatedAt;

    public VideoSlide(VideoSlideDTO addVideoSlideDTO) {
        this.description = addVideoSlideDTO.getDescription();
        this.title = addVideoSlideDTO.getTitle();
        this.url = addVideoSlideDTO.getUrl();
        this.id = addVideoSlideDTO.getId();
    }
    public VideoSlide() {}
}
