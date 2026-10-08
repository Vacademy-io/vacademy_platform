package vacademy.io.admin_core_service.features.catalogue_folder.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

/**
 * One node of a folder library: a FOLDER (which may hold children) or a
 * PRODUCT_PAGE leaf whose courses open inside its parent folder.
 */
@Entity
@Table(name = "catalogue_folder_node")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CatalogueFolderNode {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "library_id", nullable = false, length = 36)
    private String libraryId;

    @Column(name = "institute_id", nullable = false, length = 36)
    private String instituteId;

    /** Null = top level of the library. */
    @Column(name = "parent_id", length = 36)
    private String parentId;

    /** FOLDER | PRODUCT_PAGE. */
    @Column(name = "node_type", nullable = false, length = 32)
    private String nodeType;

    @Column(name = "title", length = 255)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "image_url", columnDefinition = "TEXT")
    private String imageUrl;

    @Column(name = "product_page_id", length = 255)
    private String productPageId;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    /** ACTIVE | HIDDEN. */
    @Column(name = "status", nullable = false, length = 32)
    private String status;

    /** JSON object of child-display overrides; null = inherit the section's. */
    @Column(name = "view_json", columnDefinition = "TEXT")
    private String viewJson;

    @Column(name = "created_by", length = 36)
    private String createdBy;

    @Column(name = "updated_by", length = 36)
    private String updatedBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;
}
