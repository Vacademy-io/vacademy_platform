package vacademy.io.admin_core_service.features.slide.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

@Entity
@Table(name = "slide")
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

}
