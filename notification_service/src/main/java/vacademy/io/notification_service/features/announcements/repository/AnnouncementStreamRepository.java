package vacademy.io.notification_service.features.announcements.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.announcements.entity.AnnouncementStream;
import vacademy.io.notification_service.features.announcements.enums.StreamType;

import java.util.List;

@Repository
public interface AnnouncementStreamRepository extends JpaRepository<AnnouncementStream, String> {
    
    List<AnnouncementStream> findByAnnouncementId(String announcementId);
    
    List<AnnouncementStream> findByAnnouncementIdAndIsActive(String announcementId, Boolean isActive);
    
    Page<AnnouncementStream> findByPackageSessionIdAndIsActiveOrderByIsPinnedInStreamDescCreatedAtDesc(String packageSessionId, Boolean isActive, Pageable pageable);
    
    Page<AnnouncementStream> findByStreamTypeAndIsActiveOrderByIsPinnedInStreamDescCreatedAtDesc(StreamType streamType, Boolean isActive, Pageable pageable);
    
    Page<AnnouncementStream> findByPackageSessionIdAndStreamTypeAndIsActiveOrderByIsPinnedInStreamDescCreatedAtDesc(String packageSessionId, StreamType streamType, Boolean isActive, Pageable pageable);
    
    List<AnnouncementStream> findByIsPinnedInStreamAndIsActiveOrderByCreatedAtDesc(Boolean isPinnedInStream, Boolean isActive);
    
    List<AnnouncementStream> findByPackageSessionIdAndIsPinnedInStreamAndIsActiveOrderByCreatedAtDesc(String packageSessionId, Boolean isPinnedInStream, Boolean isActive);
    
    void deleteByAnnouncementId(String announcementId);
}