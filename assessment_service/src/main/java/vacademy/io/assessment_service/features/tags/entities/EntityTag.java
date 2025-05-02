package vacademy.io.assessment_service.features.tags.entities;

import jakarta.persistence.*;
import lombok.Data;

import java.util.Date;

@Entity
@Table(name = "entity_tags")
@Data
public class EntityTag {

    @Id
    @Column(name = "entity_name")
    private String entityName;

    @Id
    @Column(name = "entity_id")
    private String entityId;

    @Id
    @Column(name = "tag_id")
    private String tagId;

    @Id
    @Column(name = "tag_source")
    private String tagSource;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
