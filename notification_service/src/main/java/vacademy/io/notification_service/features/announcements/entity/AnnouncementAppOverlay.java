package vacademy.io.notification_service.features.announcements.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;

/**
 * APP_OVERLAY mode: a full-screen, vertically scrollable HTML overlay shown to a
 * learner the next time they open the app. Dismiss-once semantics — a DISMISSED
 * message_interaction permanently hides the overlay for that user.
 */
@Entity
@Table(name = "announcement_app_overlays")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class AnnouncementAppOverlay {
    @UuidGenerator
    @Id
    private String id;

    @Column(name = "announcement_id", nullable = false)
    private String announcementId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "announcement_id", insertable = false, updatable = false)
    private Announcement announcement;

    @Column(nullable = false)
    private Integer priority = 1; // Higher number = shown first when multiple overlays are active

    // After this instant the overlay stops appearing even if never dismissed. Null = no expiry.
    @Column(name = "show_until")
    private LocalDateTime showUntil;

    @Column(name = "is_dismissible", nullable = false)
    private Boolean isDismissible = true;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
