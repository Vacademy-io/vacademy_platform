package vacademy.io.admin_core_service.features.course_catalogue.entity;


import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.common.institute.entity.Institute;

import java.util.Date;

@Table(name = "catalogue_institute_mapping")
@Entity
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Data
public class CatalogueInstituteMapping {

    @UuidGenerator
    @Column(name = "id")
    @Id
    private String id;

    @ManyToOne
    @JoinColumn(name = "course_catalogue")
    private CourseCatalogue courseCatalogue;

    @ManyToOne
    @JoinColumn(name = "institute_id")
    private Institute institute;

    @Column(name = "source")
    private String source;

    @Column(name = "source_id")
    private String sourceId;

    @Column(name = "status")
    private String status;

    @Column(name = "is_default")
    private Boolean isDefault;

    @Column(name = "created_at", updatable = false, insertable = false)
    private Date createdAt;

    @Column(name = "updated_at", updatable = false,insertable = false)
    private Date updatedAt;
}
