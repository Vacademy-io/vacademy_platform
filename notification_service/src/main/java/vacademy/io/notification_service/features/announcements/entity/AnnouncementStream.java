package vacademy.io.notification_service.features.announcements.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.notification_service.features.announcements.enums.StreamType;

import java.time.LocalDateTime;

@Entity
@Table(name = "announcement_streams")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class AnnouncementStream {
    @UuidGenerator
    @Id
    private String id;
    
    @Column(name = "announcement_id", nullable = false)
    private String announcementId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "announcement_id", insertable = false, updatable = false)
    private Announcement announcement;
    
    @Column(name = "package_session_id")
    private String packageSessionId; // specific package session, null = all from recipients
    
    @Enumerated(EnumType.STRING)
    @Column(name = "stream_type", nullable = false)
    private StreamType streamType = StreamType.GENERAL;
    
    @Column(name = "is_pinned_in_stream", nullable = false)
    private Boolean isPinnedInStream = false;
    
    @Column(name = "pin_duration_hours")
    private Integer pinDurationHours;
    
    @Column(name = "allow_reactions", nullable = false)
    private Boolean allowReactions = true;
    
    @Column(name = "allow_comments", nullable = false)
    private Boolean allowComments = true;
    
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}