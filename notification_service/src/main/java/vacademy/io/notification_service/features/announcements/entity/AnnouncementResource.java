package vacademy.io.notification_service.features.announcements.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.notification_service.features.announcements.enums.AccessLevel;
import vacademy.io.notification_service.features.announcements.enums.ResourceType;

import java.time.LocalDateTime;

@Entity
@Table(name = "announcement_resources")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class AnnouncementResource {
    @UuidGenerator
    @Id
    private String id;
    
    @Column(name = "announcement_id", nullable = false)
    private String announcementId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "announcement_id", insertable = false, updatable = false)
    private Announcement announcement;
    
    @Column(name = "folder_name", nullable = false)
    private String folderName;
    
    @Column(length = 100)
    private String category; // study_material, assignments, notes, tips, etc.
    
    @Column(length = 100)
    private String subcategory;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "resource_type", nullable = false)
    private ResourceType resourceType = ResourceType.ANNOUNCEMENT;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "access_level", nullable = false)
    private AccessLevel accessLevel = AccessLevel.ALL;
    
    @Column(name = "is_downloadable", nullable = false)
    private Boolean isDownloadable = false;
    
    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;
    
    @Column(name = "is_featured", nullable = false)
    private Boolean isFeatured = false;
    
    @Column(name = "expires_at")
    private LocalDateTime expiresAt;
    
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}