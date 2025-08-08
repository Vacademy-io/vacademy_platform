package vacademy.io.notification_service.features.announcements.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.announcements.entity.Announcement;
import vacademy.io.notification_service.features.announcements.enums.AnnouncementStatus;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AnnouncementRepository extends JpaRepository<Announcement, String> {
    
    Page<Announcement> findByInstituteIdOrderByCreatedAtDesc(String instituteId, Pageable pageable);
    
    Page<Announcement> findByInstituteIdAndStatusOrderByCreatedAtDesc(String instituteId, AnnouncementStatus status, Pageable pageable);
    
    List<Announcement> findByInstituteIdAndCreatedByOrderByCreatedAtDesc(String instituteId, String createdBy);
    
    @Query("SELECT a FROM Announcement a WHERE a.instituteId = :instituteId AND a.createdAt BETWEEN :startDate AND :endDate ORDER BY a.createdAt DESC")
    List<Announcement> findByInstituteIdAndDateRange(@Param("instituteId") String instituteId, 
                                                   @Param("startDate") LocalDateTime startDate, 
                                                   @Param("endDate") LocalDateTime endDate);
    
    long countByInstituteIdAndStatus(String instituteId, AnnouncementStatus status);
    
    @Query("SELECT a FROM Announcement a JOIN a.scheduledMessages sm WHERE sm.isActive = true AND sm.nextRunTime <= :currentTime")
    List<Announcement> findScheduledAnnouncementsToProcess(@Param("currentTime") LocalDateTime currentTime);
}