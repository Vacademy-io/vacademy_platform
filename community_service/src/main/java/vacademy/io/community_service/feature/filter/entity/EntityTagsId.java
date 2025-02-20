package vacademy.io.community_service.feature.filter.entity;

import jakarta.persistence.Embeddable;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
@Embeddable
public class EntityTagsId implements Serializable {
    private String entityId;
    private String entityName;
    private String tagId;

    // Default constructor
    public EntityTagsId() {}

    // Constructor with parameters
    public EntityTagsId(String entityId, String entityName, String tagId) {
        this.entityId = entityId;
        this.entityName = entityName;
        this.tagId = tagId;
    }

    // Getters and Setters (Optional, Lombok can generate these)
}

