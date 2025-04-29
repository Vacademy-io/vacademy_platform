package vacademy.io.community_service.feature.filter.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import vacademy.io.community_service.feature.content_structure.entity.Levels;
import vacademy.io.community_service.feature.content_structure.entity.Streams;
import vacademy.io.community_service.feature.content_structure.entity.Subjects;
import vacademy.io.community_service.feature.content_structure.entity.Tags;

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

    @ManyToOne
    @JoinColumn(name = "tag_id", insertable = false, updatable = false)
    private Levels level;

    @ManyToOne
    @JoinColumn(name = "tag_id", insertable = false, updatable = false)
    private Subjects subject;

    @ManyToOne
    @JoinColumn(name = "tag_id", insertable = false, updatable = false)
    private Streams stream;

    @ManyToOne
    @JoinColumn(name = "tag_id", insertable = false, updatable = false)
    private Tags tag;

    public EntityTags(EntityTagsId entityTagsId, String tags) {
        this.id = entityTagsId;
        this.tagSource = tags;
    }

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
