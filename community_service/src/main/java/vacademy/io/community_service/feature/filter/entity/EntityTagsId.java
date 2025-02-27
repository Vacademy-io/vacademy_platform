package vacademy.io.community_service.feature.filter.entity;

import jakarta.persistence.Access;
import jakarta.persistence.AccessType;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
@EqualsAndHashCode
@Embeddable
@Access(AccessType.FIELD)
public class EntityTagsId implements Serializable {
    @Column(name = "entity_id")
    private String entityId;

    @Column(name = "entity_name")
    private String entityName;

    @Column(name = "tag_id")
    private String tagId;

    // Constructor with parameters
    public EntityTagsId(String entityId, String entityName, String tagId) {
        this.entityId = entityId;
        this.entityName = entityName;
        this.tagId = tagId;
    }

    // Getters and Setters (Optional, Lombok can generate these)
}

