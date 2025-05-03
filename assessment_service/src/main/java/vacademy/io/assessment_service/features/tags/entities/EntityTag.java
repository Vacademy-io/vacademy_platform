package vacademy.io.assessment_service.features.tags.entities;

import jakarta.persistence.*;
import lombok.Data;

import java.util.Date;

@Entity
@Table(name = "entity_tags")
@Data
public class EntityTag {

    @EmbeddedId
    private EntityTagsId id;

    @Column(name = "tag_source")
    private String tagSource;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
