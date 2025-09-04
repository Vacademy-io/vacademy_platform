package vacademy.io.admin_core_service.features.tag_management.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.tag_management.enums.TagStatus;

import java.sql.Timestamp;

@Entity
@Table(name = "tags")
@Getter
@Setter
@NoArgsConstructor
public class Tag {
    
    @Id
    @UuidGenerator
    private String id;
    
    @Column(name = "tag_name", nullable = false)
    private String tagName;
    
    @Column(name = "institute_id")
    private String instituteId; // NULL for default/system tags
    
    @Column(name = "description")
    private String description;
    
    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;
    
    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
    
    @Column(name = "created_by_user_id")
    private String createdByUserId;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private TagStatus status = TagStatus.ACTIVE;
    
    public Tag(String tagName, String instituteId, String description, String createdByUserId) {
        this.tagName = tagName;
        this.instituteId = instituteId;
        this.description = description;
        this.createdByUserId = createdByUserId;
        this.status = TagStatus.ACTIVE;
    }
    
    public boolean isDefaultTag() {
        return this.instituteId == null;
    }
    
    public boolean isActive() {
        return this.status == TagStatus.ACTIVE;
    }
}
