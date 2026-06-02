package vacademy.io.assessment_service.features.assessment.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "copy_check_layout")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CopyCheckLayout {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "evaluation_process_id", length = 36)
    private String evaluationProcessId;

    @Column(name = "attempt_id", length = 36, nullable = false)
    private String attemptId;

    @Column(name = "layout_json", columnDefinition = "TEXT", nullable = false)
    private String layoutJson;

    @Column(name = "annotations_json", columnDefinition = "TEXT")
    private String annotationsJson;

    @Column(name = "pdf_full_res_dims_json", columnDefinition = "TEXT")
    private String pdfFullResDimsJson;

    @Column(name = "layout_map_url", length = 512)
    private String layoutMapUrl;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
