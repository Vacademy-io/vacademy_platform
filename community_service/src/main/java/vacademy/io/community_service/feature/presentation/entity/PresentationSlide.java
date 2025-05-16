package vacademy.io.community_service.feature.presentation.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Data
@Entity
@Table(name = "presentation_slide", schema = "public")
public class PresentationSlide {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "title", length = 255)
    private String title;

    @Column(name = "status", length = 255)
    private String status;

    @ManyToOne
    @JoinColumn(name = "presentation_id", referencedColumnName = "id")
    private Presentation presentation;

    @Column(name = "source_id", length = 255)
    private String sourceId;

    @Column(name = "source", length = 255)
    private String source;

    @Column(name = "interaction_status", length = 255)
    private String interactionStatus;

    @Column(name = "slide_order")
    private Integer slideOrder;

    @Column(name = "default_time")
    private Integer defaultTime;

    @Column(name = "content", columnDefinition = "text")
    private String content;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}