package vacademy.io.admin_core_service.features.product_page.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "product_page")
public class ProductPage {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "code", nullable = false, unique = true)
    private String code;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "status", nullable = false)
    private String status;

    /** Visual layout JSON (same pattern as course_catalogue.catalogue_json). */
    @Column(name = "page_json", columnDefinition = "TEXT")
    private String pageJson;

    /** Behavioural settings: defaultStep, allowCourseDeselection, GTM, TnC, invoice. */
    @Column(name = "settings_json", columnDefinition = "TEXT")
    private String settingsJson;

    @Column(name = "short_url")
    private String shortUrl;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;
}
