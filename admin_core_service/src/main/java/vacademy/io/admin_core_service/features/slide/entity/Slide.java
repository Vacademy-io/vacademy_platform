package vacademy.io.admin_core_service.features.slide.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.admin_core_service.features.slide.dto.AddDocumentSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.AddVideoSlideDTO;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;

import java.sql.Timestamp;

@Entity
@Table(name = "slide")
@Getter
@Setter
public class Slide {

    @Id
    @Column(name = "id")
    private String id;

    @Column(name = "source_id")
    private String sourceId;

    @Column(name = "source_type")
    private String sourceType;

    @Column(name = "title")
    private String title;

    @Column(name = "image_file_id")
    private String imageFileId;

    @Column(name = "description")
    private String description;

    @Column(name = "status")
    private String status;

    @Column(name = "last_sync_date")
    private Timestamp lastSyncDate;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id", referencedColumnName = "id", insertable = false, updatable = false)
    private DocumentSlide documentSlide;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id", referencedColumnName = "id", insertable = false, updatable = false)
    private VideoSlide videoSlide;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    public Slide(AddDocumentSlideDTO addDocumentSlideDTO, String sourceId, String sourceType, String status) {
        this.sourceId = sourceId;
        this.sourceType = sourceType;
        this.title = addDocumentSlideDTO.getTitle();
        this.imageFileId = addDocumentSlideDTO.getImageFileId();
        this.description = addDocumentSlideDTO.getDescription();
        this.status = status;
        this.id = addDocumentSlideDTO.getId();
    }

    public Slide(AddVideoSlideDTO addVideoSlideDTO, String sourceId, String sourceType, String status) {
        this.sourceId = sourceId;
        this.sourceType = sourceType;
        this.title = addVideoSlideDTO.getTitle();
        this.imageFileId = addVideoSlideDTO.getImageFileId();
        this.description = addVideoSlideDTO.getDescription();
        this.status = status;
        this.id = addVideoSlideDTO.getId();
        if (status.equals(SlideStatus.PUBLISHED.name())) {
            this.lastSyncDate = new Timestamp(System.currentTimeMillis());
        }
    }

    public Slide() {
    }
}
