package vacademy.io.community_service.feature.addFilterToEntity.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "entity_tags")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class EntityTags {
    @Id
    private String entityId;
//    @Id
    private String entityName;
//    @Id
    private String tagSource;
    private String tagId; // Keeping as String to store individual tag, array will be handled differently
}
