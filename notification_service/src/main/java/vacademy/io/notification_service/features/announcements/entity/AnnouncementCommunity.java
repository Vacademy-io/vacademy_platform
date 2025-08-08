package vacademy.io.notification_service.features.announcements.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.notification_service.features.announcements.enums.CommunityType;

import java.time.LocalDateTime;

@Entity
@Table(name = "announcement_community")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class AnnouncementCommunity {
    @UuidGenerator
    @Id
    private String id;
    
    @Column(name = "announcement_id", nullable = false)
    private String announcementId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "announcement_id", insertable = false, updatable = false)
    private Announcement announcement;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "community_type", nullable = false)
    private CommunityType communityType = CommunityType.GENERAL;
    
    @Column(name = "is_pinned", nullable = false)
    private Boolean isPinned = false;
    
    @Column(name = "pin_duration_hours")
    private Integer pinDurationHours;
    
    @Column(name = "allow_reactions", nullable = false)
    private Boolean allowReactions = true;
    
    @Column(name = "allow_comments", nullable = false)
    private Boolean allowComments = true;
    
    @Column(name = "allow_sharing", nullable = false)
    private Boolean allowSharing = true;
    
    @Column(name = "is_anonymous_allowed", nullable = false)
    private Boolean isAnonymousAllowed = false;
    
    @Column(name = "moderation_required", nullable = false)
    private Boolean moderationRequired = false;
    
    @Column(columnDefinition = "TEXT")
    private String tags; // comma separated tags for filtering
    
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}