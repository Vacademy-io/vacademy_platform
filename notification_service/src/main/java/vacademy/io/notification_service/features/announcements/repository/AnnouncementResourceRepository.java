package vacademy.io.notification_service.features.announcements.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.announcements.entity.AnnouncementResource;
import vacademy.io.notification_service.features.announcements.enums.AccessLevel;
import vacademy.io.notification_service.features.announcements.enums.ResourceType;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AnnouncementResourceRepository extends JpaRepository<AnnouncementResource, String> {
    
    List<AnnouncementResource> findByAnnouncementId(String announcementId);
    
    List<AnnouncementResource> findByAnnouncementIdAndIsActive(String announcementId, Boolean isActive);
    
    Page<AnnouncementResource> findByFolderNameAndIsActiveOrderBySortOrderAscCreatedAtDesc(String folderName, Boolean isActive, Pageable pageable);
    
    Page<AnnouncementResource> findByCategoryAndIsActiveOrderBySortOrderAscCreatedAtDesc(String category, Boolean isActive, Pageable pageable);
    
    Page<AnnouncementResource> findByFolderNameAndCategoryAndIsActiveOrderBySortOrderAscCreatedAtDesc(String folderName, String category, Boolean isActive, Pageable pageable);
    
    List<AnnouncementResource> findByIsFeaturedAndIsActiveOrderBySortOrderAscCreatedAtDesc(Boolean isFeatured, Boolean isActive);
    
    List<AnnouncementResource> findByResourceTypeAndIsActiveOrderBySortOrderAscCreatedAtDesc(ResourceType resourceType, Boolean isActive);
    
    List<AnnouncementResource> findByAccessLevelAndIsActiveOrderBySortOrderAscCreatedAtDesc(AccessLevel accessLevel, Boolean isActive);
    
    @Query("SELECT ar FROM AnnouncementResource ar WHERE ar.isActive = true AND (ar.expiresAt IS NULL OR ar.expiresAt > :currentTime) ORDER BY ar.sortOrder ASC, ar.createdAt DESC")
    List<AnnouncementResource> findActiveNonExpiredResources(@Param("currentTime") LocalDateTime currentTime);
    
    @Query("SELECT ar FROM AnnouncementResource ar WHERE ar.folderName = :folderName AND ar.isActive = true AND (ar.expiresAt IS NULL OR ar.expiresAt > :currentTime) ORDER BY ar.sortOrder ASC, ar.createdAt DESC")
    List<AnnouncementResource> findByFolderNameAndNotExpired(@Param("folderName") String folderName, @Param("currentTime") LocalDateTime currentTime);
    
    @Query("SELECT DISTINCT ar.folderName FROM AnnouncementResource ar WHERE ar.isActive = true ORDER BY ar.folderName")
    List<String> findDistinctActiveFolderNames();
    
    @Query("SELECT DISTINCT ar.category FROM AnnouncementResource ar WHERE ar.isActive = true AND ar.category IS NOT NULL ORDER BY ar.category")
    List<String> findDistinctActiveCategories();
    
    void deleteByAnnouncementId(String announcementId);
}