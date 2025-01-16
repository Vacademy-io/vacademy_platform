package vacademy.io.admin_core_service.features.chapter.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.slide.entity.Slide;

import java.sql.Timestamp;

@Entity
@Table(name = "chapter_to_slides")
public class ChapterToSlides {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @ManyToOne
    @JoinColumn(name = "chapter_id", referencedColumnName = "id", nullable = false)
    private Chapter chapter;

    @ManyToOne
    @JoinColumn(name = "slide_id", referencedColumnName = "id", nullable = false)
    private Slide slide;

    @Column(name = "slide_order")
    private Integer slideOrder;

    @Column(name = "status")
    private String status;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
