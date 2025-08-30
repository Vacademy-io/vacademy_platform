package vacademy.io.admin_core_service.features.tag_management.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.tag_management.entity.UserTag;


import java.util.List;
import java.util.Optional;

@Repository
public interface UserTagRepository extends JpaRepository<UserTag, String> {
    
    // Find all active user tags for a user in an institute
    @Query("SELECT ut FROM UserTag ut JOIN FETCH ut.tag t WHERE ut.userId = :userId AND ut.instituteId = :instituteId AND ut.status = 'ACTIVE' ORDER BY t.tagName")
    List<UserTag> findActiveUserTagsByUserIdAndInstituteId(@Param("userId") String userId, @Param("instituteId") String instituteId);
    
    // Find all user tags (including inactive) for a user in an institute
    @Query("SELECT ut FROM UserTag ut JOIN FETCH ut.tag t WHERE ut.userId = :userId AND ut.instituteId = :instituteId ORDER BY ut.status, t.tagName")
    List<UserTag> findAllUserTagsByUserIdAndInstituteId(@Param("userId") String userId, @Param("instituteId") String instituteId);
    
    // Find active user tags for multiple users
    @Query("SELECT ut FROM UserTag ut JOIN FETCH ut.tag t WHERE ut.userId IN :userIds AND ut.instituteId = :instituteId AND ut.status = 'ACTIVE' ORDER BY ut.userId, t.tagName")
    List<UserTag> findActiveUserTagsByUserIdsAndInstituteId(@Param("userIds") List<String> userIds, @Param("instituteId") String instituteId);
    
    // Check if user has a specific tag (active or inactive)
    @Query("SELECT ut FROM UserTag ut WHERE ut.userId = :userId AND ut.tagId = :tagId AND ut.instituteId = :instituteId")
    Optional<UserTag> findUserTagByUserIdAndTagIdAndInstituteId(@Param("userId") String userId, @Param("tagId") String tagId, @Param("instituteId") String instituteId);
    
    // Check if user has an active tag
    @Query("SELECT ut FROM UserTag ut WHERE ut.userId = :userId AND ut.tagId = :tagId AND ut.instituteId = :instituteId AND ut.status = 'ACTIVE'")
    Optional<UserTag> findActiveUserTagByUserIdAndTagIdAndInstituteId(@Param("userId") String userId, @Param("tagId") String tagId, @Param("instituteId") String instituteId);
    
    // Count active tags for a user
    @Query("SELECT COUNT(ut) FROM UserTag ut WHERE ut.userId = :userId AND ut.instituteId = :instituteId AND ut.status = 'ACTIVE'")
    long countActiveUserTagsByUserIdAndInstituteId(@Param("userId") String userId, @Param("instituteId") String instituteId);
    
    // Find all users with a specific tag
    @Query("SELECT DISTINCT ut.userId FROM UserTag ut WHERE ut.tagId = :tagId AND ut.instituteId = :instituteId AND ut.status = 'ACTIVE'")
    List<String> findUserIdsByTagIdAndInstituteId(@Param("tagId") String tagId, @Param("instituteId") String instituteId);
    
    // Find all users with any of the specified tags
    @Query("SELECT DISTINCT ut.userId FROM UserTag ut WHERE ut.tagId IN :tagIds AND ut.instituteId = :instituteId AND ut.status = 'ACTIVE'")
    List<String> findUserIdsByTagIdsAndInstituteId(@Param("tagIds") List<String> tagIds, @Param("instituteId") String instituteId);
    
    // Update user tag status to INACTIVE
    @Modifying
    @Transactional
    @Query("UPDATE UserTag ut SET ut.status = 'INACTIVE' WHERE ut.userId = :userId AND ut.tagId = :tagId AND ut.instituteId = :instituteId")
    int deactivateUserTag(@Param("userId") String userId, @Param("tagId") String tagId, @Param("instituteId") String instituteId);
    
    // Update multiple user tags status to INACTIVE
    @Modifying
    @Transactional
    @Query("UPDATE UserTag ut SET ut.status = 'INACTIVE' WHERE ut.userId IN :userIds AND ut.tagId = :tagId AND ut.instituteId = :instituteId")
    int deactivateUserTagsForUsers(@Param("userIds") List<String> userIds, @Param("tagId") String tagId, @Param("instituteId") String instituteId);
    
    // Update user tag status to ACTIVE
    @Modifying
    @Transactional
    @Query("UPDATE UserTag ut SET ut.status = 'ACTIVE' WHERE ut.userId = :userId AND ut.tagId = :tagId AND ut.instituteId = :instituteId")
    int activateUserTag(@Param("userId") String userId, @Param("tagId") String tagId, @Param("instituteId") String instituteId);
    
    // Delete user tags when a tag is deleted (for cleanup)
    @Modifying
    @Transactional
    @Query("DELETE FROM UserTag ut WHERE ut.tagId = :tagId")
    int deleteUserTagsByTagId(@Param("tagId") String tagId);
    
    // Get statistics - count of users per tag for an institute
    @Query("SELECT ut.tagId, t.tagName, COUNT(DISTINCT ut.userId) as userCount FROM UserTag ut JOIN ut.tag t WHERE ut.instituteId = :instituteId AND ut.status = 'ACTIVE' GROUP BY ut.tagId, t.tagName ORDER BY t.tagName")
    List<Object[]> getUserCountPerTagByInstituteId(@Param("instituteId") String instituteId);
    
    // Find user tags by multiple criteria for bulk operations
    @Query("SELECT ut FROM UserTag ut WHERE ut.userId IN :userIds AND ut.tagId IN :tagIds AND ut.instituteId = :instituteId")
    List<UserTag> findUserTagsByUserIdsAndTagIdsAndInstituteId(@Param("userIds") List<String> userIds, @Param("tagIds") List<String> tagIds, @Param("instituteId") String instituteId);
    
    // Get user count per tag for specific tags
    @Query("SELECT ut.tagId, t.tagName, COUNT(DISTINCT ut.userId) as userCount FROM UserTag ut JOIN ut.tag t WHERE ut.tagId IN :tagIds AND ut.instituteId = :instituteId AND ut.status = 'ACTIVE' GROUP BY ut.tagId, t.tagName ORDER BY t.tagName")
    List<Object[]> getUserCountPerSpecificTags(@Param("tagIds") List<String> tagIds, @Param("instituteId") String instituteId);
}
