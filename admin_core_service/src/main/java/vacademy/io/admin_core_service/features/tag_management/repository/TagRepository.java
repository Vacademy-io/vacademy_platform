package vacademy.io.admin_core_service.features.tag_management.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.tag_management.entity.Tag;
import vacademy.io.admin_core_service.features.tag_management.enums.TagStatus;

import java.util.List;
import java.util.Optional;

@Repository
public interface TagRepository extends JpaRepository<Tag, String> {
    
    // Find all active tags for an institute (including default tags)
    @Query("SELECT t FROM Tag t WHERE t.status = :status AND (t.instituteId = :instituteId OR t.instituteId IS NULL) ORDER BY t.tagName")
    List<Tag> findActiveTagsByInstituteId(@Param("instituteId") String instituteId, @Param("status") TagStatus status);
    
    // Find only default tags (system-wide)
    @Query("SELECT t FROM Tag t WHERE t.status = :status AND t.instituteId IS NULL ORDER BY t.tagName")
    List<Tag> findActiveDefaultTags(@Param("status") TagStatus status);
    
    // Find only institute-specific tags
    @Query("SELECT t FROM Tag t WHERE t.status = :status AND t.instituteId = :instituteId ORDER BY t.tagName")
    List<Tag> findActiveInstituteSpecificTags(@Param("instituteId") String instituteId, @Param("status") TagStatus status);
    
    // Find tag by name and institute (including default tags)
    @Query("SELECT t FROM Tag t WHERE t.tagName = :tagName AND t.status = :status AND (t.instituteId = :instituteId OR t.instituteId IS NULL)")
    List<Tag> findByTagNameAndInstituteId(@Param("tagName") String tagName, @Param("instituteId") String instituteId, @Param("status") TagStatus status);
    
    // Check if tag name exists for institute (including default tags)
    @Query("SELECT COUNT(t) > 0 FROM Tag t WHERE t.tagName = :tagName AND t.status = 'ACTIVE' AND (t.instituteId = :instituteId OR t.instituteId IS NULL)")
    boolean existsByTagNameAndInstituteId(@Param("tagName") String tagName, @Param("instituteId") String instituteId);
    
    // Find tag by ID and ensure it belongs to institute or is default
    @Query("SELECT t FROM Tag t WHERE t.id = :tagId AND t.status = 'ACTIVE' AND (t.instituteId = :instituteId OR t.instituteId IS NULL)")
    Optional<Tag> findActiveTagByIdAndInstituteId(@Param("tagId") String tagId, @Param("instituteId") String instituteId);
    
    // Find multiple tags by IDs for an institute
    @Query("SELECT t FROM Tag t WHERE t.id IN :tagIds AND t.status = 'ACTIVE' AND (t.instituteId = :instituteId OR t.instituteId IS NULL)")
    List<Tag> findActiveTagsByIdsAndInstituteId(@Param("tagIds") List<String> tagIds, @Param("instituteId") String instituteId);
    
    // Find all tags by institute (for admin view, including inactive)
    @Query("SELECT t FROM Tag t WHERE t.instituteId = :instituteId ORDER BY t.status, t.tagName")
    List<Tag> findAllTagsByInstituteId(@Param("instituteId") String instituteId);
    
    // Count active tags for institute
    @Query("SELECT COUNT(t) FROM Tag t WHERE t.status = 'ACTIVE' AND (t.instituteId = :instituteId OR t.instituteId IS NULL)")
    long countActiveTagsByInstituteId(@Param("instituteId") String instituteId);
}
