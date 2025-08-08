package vacademy.io.notification_service.features.announcements.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.announcements.entity.AnnouncementTask;
import vacademy.io.notification_service.features.announcements.enums.TaskStatus;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface AnnouncementTaskRepository extends JpaRepository<AnnouncementTask, String> {
    
    List<AnnouncementTask> findByAnnouncementId(String announcementId);
    
    List<AnnouncementTask> findByAnnouncementIdAndIsActive(String announcementId, Boolean isActive);
    
    Optional<AnnouncementTask> findByAnnouncementIdAndIsActiveAndId(String announcementId, Boolean isActive, String id);
    
    List<AnnouncementTask> findByStatus(TaskStatus status);
    
    List<AnnouncementTask> findByStatusAndIsActive(TaskStatus status, Boolean isActive);
    
    // Find tasks that should go live (status = SCHEDULED and goLiveDateTime <= now)
    @Query("SELECT at FROM AnnouncementTask at WHERE at.status = 'SCHEDULED' AND at.goLiveDateTime <= :currentTime AND at.isActive = true")
    List<AnnouncementTask> findTasksToGoLive(@Param("currentTime") LocalDateTime currentTime);
    
    // Find tasks that are overdue (status = LIVE and deadlineDateTime < now)
    @Query("SELECT at FROM AnnouncementTask at WHERE at.status = 'LIVE' AND at.deadlineDateTime < :currentTime AND at.isActive = true")
    List<AnnouncementTask> findOverdueTasks(@Param("currentTime") LocalDateTime currentTime);
    
    // Find tasks that need reminders (status = LIVE and deadline approaching)
    @Query("SELECT at FROM AnnouncementTask at WHERE at.status = 'LIVE' AND at.reminderBeforeMinutes IS NOT NULL AND at.deadlineDateTime <= :reminderTime AND at.deadlineDateTime > :currentTime AND at.isActive = true")
    List<AnnouncementTask> findTasksNeedingReminder(@Param("currentTime") LocalDateTime currentTime, @Param("reminderTime") LocalDateTime reminderTime);
    
    // Find tasks by slide ID
    @Query(value = "SELECT * FROM announcement_tasks at WHERE at.slide_ids::text LIKE CONCAT('%\"', ?1, '\"%') AND at.is_active = true", nativeQuery = true)
    List<AnnouncementTask> findBySlideId(String slideId);
    
    // Find tasks within a date range
    @Query("SELECT at FROM AnnouncementTask at WHERE at.goLiveDateTime >= :startDate AND at.deadlineDateTime <= :endDate AND at.isActive = true")
    List<AnnouncementTask> findTasksInDateRange(@Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);
    
    // Update task status
    @Modifying
    @Query("UPDATE AnnouncementTask at SET at.status = :status, at.updatedAt = :updatedAt WHERE at.id = :taskId")
    int updateTaskStatus(@Param("taskId") String taskId, @Param("status") TaskStatus status, @Param("updatedAt") LocalDateTime updatedAt);
    
    // Bulk update tasks to LIVE status
    @Modifying
    @Query("UPDATE AnnouncementTask at SET at.status = 'LIVE', at.updatedAt = :updatedAt WHERE at.status = 'SCHEDULED' AND at.goLiveDateTime <= :currentTime AND at.isActive = true")
    int bulkUpdateTasksToLive(@Param("currentTime") LocalDateTime currentTime, @Param("updatedAt") LocalDateTime updatedAt);
    
    // Bulk update tasks to OVERDUE status
    @Modifying
    @Query("UPDATE AnnouncementTask at SET at.status = 'OVERDUE', at.updatedAt = :updatedAt WHERE at.status = 'LIVE' AND at.deadlineDateTime < :currentTime AND at.isActive = true")
    int bulkUpdateTasksToOverdue(@Param("currentTime") LocalDateTime currentTime, @Param("updatedAt") LocalDateTime updatedAt);
    
    // Count tasks by status
    long countByStatusAndIsActive(TaskStatus status, Boolean isActive);
    
    // Count tasks for an announcement
    long countByAnnouncementIdAndIsActive(String announcementId, Boolean isActive);
}