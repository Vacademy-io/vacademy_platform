package vacademy.io.admin_core_service.features.course_catalogue.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Table(name = "course_catalogue")
@Entity
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Data
public class CourseCatalogue {
    @UuidGenerator
    @Id
    @Column(name = "id")
    private String id;

    @Column(name = "catalogue_json", columnDefinition = "TEXT")
    private String catalogueJson;

    @Column(name = "tag_name")
    private String tagName;

    @Column(name = "status")
    private String status;

    @Column(name = "created_at", updatable = false, insertable = false)
    private Date createdAt;

    @Column(name = "updated_at", updatable = false,insertable = false)
    private Date updatedAt;
}
