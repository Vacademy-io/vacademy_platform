package vacademy.io.admin_core_service.features.course.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.institute.entity.PackageEntity;

import java.sql.Timestamp;
import java.util.Date; // Added import for Date
import java.util.Map; // Added import

/**
 * DTO for detailed teacher course information including relationship metadata
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeacherCourseDetailDTO {
    
    /**
     * The package/course entity
     */
    private PackageEntity packageEntity;
    
    /**
     * Type of relationship between teacher and course
     * Values: "CREATOR", "FACULTY_ASSIGNED", "BOTH"
     */
    private String relationshipType;
    
    /**
     * Number of faculty assignments for this teacher in this course
     */
    private Integer facultyAssignmentCount;
    
    /**
     * Comma-separated list of subjects the teacher is assigned to in this course
     */
    private String assignedSubjects;
    
    /**
     * Additional metadata
     */
    private boolean isCreator;
    private boolean isFacultyAssigned;
    
    /**
     * Course basic information (extracted for convenience)
     */
    private String courseId;
    private String courseName;
    private String courseStatus;
    private Timestamp createdAt;
    private Timestamp updatedAt;
    
    /**
     * Session Details
     */
    private SessionInfo sessionInfo;
    
    /**
     * Level Details
     */
    private LevelInfo levelInfo;
    
    /**
     * Package Session Details
     */
    private PackageSessionInfo packageSessionInfo;
    
    /**
     * Session information
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SessionInfo {
        private String sessionId;
        private String sessionName;
        private String sessionStatus;
        private Date sessionStartDate;
    }
    
    /**
     * Level information
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LevelInfo {
        private String levelId;
        private String levelName;
        private Integer durationInDays;
        private String levelStatus;
        private String levelThumbnailFileId;
        private Date levelCreatedAt;
        private Date levelUpdatedAt;
    }
    
    /**
     * Package Session information
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PackageSessionInfo {
        private String packageSessionIds; // Comma-separated list
        private Integer packageSessionCount;
        private String packageSessionStatuses; // Comma-separated list
    }

    /**
     * Factory method to create DTO from database result
     */
    public static TeacherCourseDetailDTO fromDatabaseResult(java.util.Map<String, Object> result) {
        String relationshipType = (String) result.get("teacher_relationship_type");
        Integer assignmentCount = result.get("faculty_assignment_count") != null ? 
            ((Number) result.get("faculty_assignment_count")).intValue() : 0;
        String assignedSubjects = (String) result.get("assigned_subjects");
        
        // Extract package entity fields and create PackageEntity
        String packageId = (String) result.get("id");
        String packageName = (String) result.get("package_name");
        String status = (String) result.get("status");
        Timestamp createdAt = (Timestamp) result.get("created_at");
        Timestamp updatedAt = (Timestamp) result.get("updated_at");
        String createdByUserId = (String) result.get("created_by_user_id");
        
        // Create PackageEntity object
        PackageEntity packageEntity = new PackageEntity();
        packageEntity.setId(packageId);
        packageEntity.setPackageName(packageName);
        packageEntity.setStatus(status);
        // Convert Timestamp to Date for PackageEntity
        packageEntity.setCreatedAt(createdAt != null ? new Date(createdAt.getTime()) : null);
        packageEntity.setUpdatedAt(updatedAt != null ? new Date(updatedAt.getTime()) : null);
        packageEntity.setCreatedByUserId(createdByUserId);
        
        // Extract session details
        SessionInfo sessionInfo = SessionInfo.builder()
            .sessionId((String) result.get("session_id"))
            .sessionName((String) result.get("session_name"))
            .sessionStatus((String) result.get("session_status"))
            .sessionStartDate((Date) result.get("session_start_date"))
            .build();
        
        // Extract level details
        LevelInfo levelInfo = LevelInfo.builder()
            .levelId((String) result.get("level_id"))
            .levelName((String) result.get("level_name"))
            .durationInDays(result.get("duration_in_days") != null ? 
                ((Number) result.get("duration_in_days")).intValue() : null)
            .levelStatus((String) result.get("level_status"))
            .levelThumbnailFileId((String) result.get("level_thumbnail_file_id"))
            .levelCreatedAt((Date) result.get("level_created_at"))
            .levelUpdatedAt((Date) result.get("level_updated_at"))
            .build();
        
        // Extract package session details
        PackageSessionInfo packageSessionInfo = PackageSessionInfo.builder()
            .packageSessionIds((String) result.get("package_session_ids"))
            .packageSessionCount(result.get("package_session_count") != null ? 
                ((Number) result.get("package_session_count")).intValue() : 0)
            .packageSessionStatuses((String) result.get("package_session_statuses"))
            .build();
        
        boolean isCreator = "CREATOR".equals(relationshipType) || "BOTH".equals(relationshipType);
        boolean isFacultyAssigned = assignmentCount > 0;
        
        return TeacherCourseDetailDTO.builder()
            .packageEntity(packageEntity)
            .relationshipType(relationshipType)
            .facultyAssignmentCount(assignmentCount)
            .assignedSubjects(assignedSubjects)
            .isCreator(isCreator)
            .isFacultyAssigned(isFacultyAssigned)
            .courseId(packageId)
            .courseName(packageName)
            .courseStatus(status)
            .createdAt(createdAt)
            .updatedAt(updatedAt)
            .sessionInfo(sessionInfo)
            .levelInfo(levelInfo)
            .packageSessionInfo(packageSessionInfo)
            .build();
    }
} 