package vacademy.io.community_service.feature.filter.entity;

import jakarta.persistence.*;
import lombok.*;

//
//@Entity
//@Table(name = "entity_tags")
//@Getter
//@Setter
//@NoArgsConstructor
//@AllArgsConstructor
//public class EntityTags {
//    @Id
//    private String entityId;
//    private String entityName;
//    private String tagId;
//    private String tagSource;
//     // Keeping as String to store individual tag, array will be handled differently
//}
//


@Entity
@Table(name = "entity_tags")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class EntityTags {

    @EmbeddedId  // Use the composite key
    private EntityTagsId id;
    @Column(name = "tag_source")
    private String tagSource;

    // If you want to use "entityId", "entityName", or "tagId" directly in the EntityTags class,
    // you can add helper methods like these:
    public String getEntityId() {
        return id != null ? id.getEntityId() : null;
    }

    public String getEntityName() {
        return id != null ? id.getEntityName() : null;
    }

    public String getTagId() {
        return id != null ? id.getTagId() : null;
    }
}
