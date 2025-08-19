package vacademy.io.notification_service.features.announcements.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.announcements.entity.AnnouncementCommunity;
import vacademy.io.notification_service.features.announcements.enums.CommunityType;

import java.util.List;

@Repository
public interface AnnouncementCommunityRepository extends JpaRepository<AnnouncementCommunity, String> {
    
    List<AnnouncementCommunity> findByAnnouncementId(String announcementId);
    
    List<AnnouncementCommunity> findByAnnouncementIdAndIsActive(String announcementId, Boolean isActive);
    
    Page<AnnouncementCommunity> findByCommunityTypeAndIsActiveOrderByIsPinnedDescCreatedAtDesc(CommunityType communityType, Boolean isActive, Pageable pageable);
    
    Page<AnnouncementCommunity> findByIsActiveOrderByIsPinnedDescCreatedAtDesc(Boolean isActive, Pageable pageable);
    
    List<AnnouncementCommunity> findByIsPinnedAndIsActiveOrderByCreatedAtDesc(Boolean isPinned, Boolean isActive);
    
    @Query("SELECT ac FROM AnnouncementCommunity ac WHERE ac.isActive = true AND ac.tags LIKE %:tag% ORDER BY ac.isPinned DESC, ac.createdAt DESC")
    List<AnnouncementCommunity> findByTagContaining(@Param("tag") String tag);
    
    @Query("SELECT ac FROM AnnouncementCommunity ac WHERE ac.isActive = true AND ac.moderationRequired = false ORDER BY ac.isPinned DESC, ac.createdAt DESC")
    List<AnnouncementCommunity> findPublicPosts();
    
    void deleteByAnnouncementId(String announcementId);
}