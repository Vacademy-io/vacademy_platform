package vacademy.io.assessment_service.features.tags.entities;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.Date;

@Entity
@Table(name = "entity_tags")
@Data
@EqualsAndHashCode(of = {"entityName", "entityId", "tag"})
public class EntityTag {

    @Id
    @Column(name = "entity_name")
    private String entityName;

    @Id
    @Column(name = "entity_id")
    private String entityId;

    @Id
    @ManyToOne
    @JoinColumn(name = "tag_id")
    private Tag tag;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
