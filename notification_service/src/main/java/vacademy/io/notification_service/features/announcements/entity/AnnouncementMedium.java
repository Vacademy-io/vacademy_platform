package vacademy.io.notification_service.features.announcements.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;
import vacademy.io.notification_service.features.announcements.enums.MediumType;

import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "announcement_mediums")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class AnnouncementMedium {
    @UuidGenerator
    @Id
    private String id;
    
    @Column(name = "announcement_id", nullable = false)
    private String announcementId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "announcement_id", insertable = false, updatable = false)
    private Announcement announcement;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "medium_type", nullable = false)
    private MediumType mediumType;
    
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "medium_config")
    private Map<String, Object> mediumConfig;
    
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}