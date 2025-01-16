package vacademy.io.admin_core_service.features.slide.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

@Entity
@Table(name = "document_slide")
public class DocumentSlide {

    @Id
    @UuidGenerator
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
}
