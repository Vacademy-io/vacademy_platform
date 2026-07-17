package vacademy.io.notification_service.features.announcements.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.announcements.entity.AnnouncementAppOverlay;

import java.util.List;

@Repository
public interface AnnouncementAppOverlayRepository extends JpaRepository<AnnouncementAppOverlay, String> {

    List<AnnouncementAppOverlay> findByAnnouncementId(String announcementId);

    List<AnnouncementAppOverlay> findByAnnouncementIdAndIsActive(String announcementId, Boolean isActive);

    void deleteByAnnouncementId(String announcementId);
}
