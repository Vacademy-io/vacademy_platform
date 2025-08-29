package vacademy.io.admin_core_service.features.tag_management.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.tag_management.enums.TagStatus;

import java.sql.Timestamp;

@Entity
@Table(name = "user_tags")
@Getter
@Setter
@NoArgsConstructor
public class UserTag {
    
    @Id
    @UuidGenerator
    private String id;
    
    @Column(name = "user_id", nullable = false)
    private String userId;
    
    @Column(name = "tag_id", nullable = false)
    private String tagId;
    
    @Column(name = "institute_id", nullable = false)
    private String instituteId;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private TagStatus status = TagStatus.ACTIVE;
    
    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;
    
    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
    
    @Column(name = "created_by_user_id")
    private String createdByUserId;
    
    // JPA relationship to Tag entity
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tag_id", insertable = false, updatable = false)
    private Tag tag;
    
    public UserTag(String userId, String tagId, String instituteId, String createdByUserId) {
        this.userId = userId;
        this.tagId = tagId;
        this.instituteId = instituteId;
        this.createdByUserId = createdByUserId;
        this.status = TagStatus.ACTIVE;
    }
    
    public boolean isActive() {
        return this.status == TagStatus.ACTIVE;
    }
    
    public void activate() {
        this.status = TagStatus.ACTIVE;
    }
    
    public void deactivate() {
        this.status = TagStatus.INACTIVE;
    }
}
