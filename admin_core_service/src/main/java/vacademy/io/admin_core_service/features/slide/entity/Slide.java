package vacademy.io.admin_core_service.features.slide.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.admin_core_service.features.slide.dto.AddDocumentSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.AddVideoSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.AddHtmlVideoSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.AddScormSlideDTO;
import vacademy.io.admin_core_service.features.slide.entity.HtmlVideoSlide;
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

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id", referencedColumnName = "id", insertable = false, updatable = false)
    private HtmlVideoSlide htmlVideoSlide;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    @Column(name = "parent_id")
    private String parentId;

    @Column(name = "created_by_user_id")
    private String createdByUserId;

    @Column(name = "drip_condition_json", columnDefinition = "TEXT")
    private String dripConditionJson;

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

    public Slide(AddHtmlVideoSlideDTO addHtmlVideoSlideDTO, String sourceId, String sourceType, String status) {
        this.sourceId = sourceId;
        this.sourceType = sourceType;
        this.title = addHtmlVideoSlideDTO.getTitle();
        this.imageFileId = addHtmlVideoSlideDTO.getImageFileId();
        this.description = addHtmlVideoSlideDTO.getDescription();
        this.status = status;
        this.id = addHtmlVideoSlideDTO.getId();
    }

    public Slide(AddScormSlideDTO addScormSlideDTO, String sourceId, String sourceType, String status) {
        this.sourceId = sourceId;
        this.sourceType = sourceType;
        this.title = addScormSlideDTO.getTitle();
        this.imageFileId = addScormSlideDTO.getImageFileId();
        this.description = addScormSlideDTO.getDescription();
        this.status = status;
        this.id = addScormSlideDTO.getId();
    }

    public Slide() {
    }
}
