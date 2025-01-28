package vacademy.io.admin_core_service.features.slide.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
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
    @UuidGenerator
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

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    public Slide(AddDocumentSlideDTO addDocumentSlideDTO,String sourceId,String sourceType,String status) {
        this.sourceId = sourceId;
        this.sourceType = sourceType;
        this.title = addDocumentSlideDTO.getTitle();
        this.imageFileId = addDocumentSlideDTO.getImageFileId();
        this.description = addDocumentSlideDTO.getDescription();
        this.status = status;
    }

    public Slide(AddVideoSlideDTO addVideoSlideDTO, String sourceId, String sourceType,String status) {
        this.sourceId = sourceId;
        this.sourceType = sourceType;
        this.title = addVideoSlideDTO.getTitle();
        this.imageFileId = addVideoSlideDTO.getImageFileId();
        this.description = addVideoSlideDTO.getDescription();
        this.status = status;
    }

}
