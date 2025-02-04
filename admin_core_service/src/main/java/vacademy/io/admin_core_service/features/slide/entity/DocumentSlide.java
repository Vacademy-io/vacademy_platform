package vacademy.io.admin_core_service.features.slide.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.slide.dto.AddDocumentSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.DocumentSlideDTO;

import java.sql.Timestamp;

@Entity
@Table(name = "document_slide")
@Getter
@Setter
public class DocumentSlide {

    @Id
    @Column(name = "id")
    private String id;

    @Column(name = "type")
    private String type;

    @Column(name = "data")
    private String data;

    @Column(name = "title")
    private String title;

    @Column(name = "cover_file_id")
    private String coverFileId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    public DocumentSlide() {}

    public DocumentSlide(DocumentSlideDTO documentSlideDTO){
        this.type = documentSlideDTO.getType();
        this.data = documentSlideDTO.getData();
        this.title = documentSlideDTO.getTitle();
        this.coverFileId =documentSlideDTO.getCoverFileId();
        this.id = documentSlideDTO.getId();
    }
}
