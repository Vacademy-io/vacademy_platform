package vacademy.io.admin_core_service.features.tag_management.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.admin_core_service.features.tag_management.dto.*;
import vacademy.io.admin_core_service.features.tag_management.service.CsvTagService;
import vacademy.io.admin_core_service.features.tag_management.service.TagService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin-core-service/tag-management")
@RequiredArgsConstructor
@Slf4j
public class TagController {
    
    private final TagService tagService;
    private final CsvTagService csvTagService;
    
    // ========== TAG MANAGEMENT APIs ==========
    
    /**
     * Create a new tag for institute
     */
    @PostMapping("/institutes/{instituteId}/tags")
    public ResponseEntity<TagDTO> createTag(
            @PathVariable String instituteId,
            @Valid @RequestBody CreateTagDTO createTagDTO,
            @RequestAttribute("user") CustomUserDetails user) {
        
        TagDTO createdTag = tagService.createTag(createTagDTO, instituteId, user.getUserId());
        
        log.info("Created tag: {} for institute: {} by user: {}", 
                createdTag.getTagName(), instituteId, user.getUserId());
        
        return ResponseEntity.ok(createdTag);
    }
    
    /**
     * Get all tags for institute (including default tags)
     */
    @GetMapping("/institutes/{instituteId}/tags")
    public ResponseEntity<List<TagDTO>> getAllTags(
            @PathVariable String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        
        List<TagDTO> tags = tagService.getAllTagsForInstitute(instituteId);
        
        return ResponseEntity.ok(tags);
    }
    
    /**
     * Get only default tags
     */
    @GetMapping("/tags/default")
    public ResponseEntity<List<TagDTO>> getDefaultTags(
            @RequestAttribute("user") CustomUserDetails user) {
        
        List<TagDTO> defaultTags = tagService.getDefaultTags();
        return ResponseEntity.ok(defaultTags);
    }
    
    /**
     * Get only institute-specific tags
     */
    @GetMapping("/institutes/{instituteId}/tags/institute")
    public ResponseEntity<List<TagDTO>> getInstituteTags(
            @PathVariable String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        
        List<TagDTO> instituteTags = tagService.getInstituteSpecificTags(instituteId);
        
        return ResponseEntity.ok(instituteTags);
    }
    
    /**
     * Delete a tag (mark as inactive) - only non-default tags
     */
    @DeleteMapping("/institutes/{instituteId}/tags/{tagId}")
    public ResponseEntity<String> deleteTag(
            @PathVariable String instituteId,
            @PathVariable String tagId,
            @RequestAttribute("user") CustomUserDetails user) {
        
        tagService.deleteTag(tagId, instituteId);
        
        log.info("Deleted tag: {} for institute: {} by user: {}", tagId, instituteId, user.getUserId());
        
        return ResponseEntity.ok("Tag deleted successfully");
    }
    
    /**
     * Get tag statistics for institute
     */
    @GetMapping("/institutes/{instituteId}/tags/statistics")
    public ResponseEntity<List<Map<String, Object>>> getTagStatistics(
            @PathVariable String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        
        List<Map<String, Object>> statistics = tagService.getTagStatistics(instituteId);
        
        return ResponseEntity.ok(statistics);
    }
    
    // ========== USER TAG MANAGEMENT APIs ==========
    
    /**
     * Get all tags for a specific user
     */
    @GetMapping("/institutes/{instituteId}/users/{userId}/tags")
    public ResponseEntity<UserTagsResponseDTO> getUserTags(
            @PathVariable String instituteId,
            @PathVariable String userId,
            @RequestAttribute("user") CustomUserDetails user) {
        
        UserTagsResponseDTO userTags = tagService.getUserTags(userId, instituteId);
        
        return ResponseEntity.ok(userTags);
    }
    
    /**
     * Get active tags for a specific user
     */
    @GetMapping("/institutes/{instituteId}/users/{userId}/tags/active")
    public ResponseEntity<List<TagDTO>> getActiveUserTags(
            @PathVariable String instituteId,
            @PathVariable String userId,
            @RequestAttribute("user") CustomUserDetails user) {
        
        List<TagDTO> activeTags = tagService.getActiveUserTags(userId, instituteId);
        
        return ResponseEntity.ok(activeTags);
    }
    
    /**
     * Get active tags for multiple users
     */
    @PostMapping("/institutes/{instituteId}/users/tags/active")
    public ResponseEntity<Map<String, List<TagDTO>>> getActiveUserTagsForMultipleUsers(
            @PathVariable String instituteId,
            @RequestBody List<String> userIds,
            @RequestAttribute("user") CustomUserDetails user) {
        
        Map<String, List<TagDTO>> userTags = tagService.getActiveUserTagsForMultipleUsers(userIds, instituteId);
        
        return ResponseEntity.ok(userTags);
    }
    
    /**
     * Add tags to users
     */
    @PostMapping("/institutes/{instituteId}/users/tags/add")
    public ResponseEntity<BulkUserTagOperationResultDTO> addTagsToUsers(
            @PathVariable String instituteId,
            @Valid @RequestBody AddTagsToUsersDTO request,
            @RequestAttribute("user") CustomUserDetails user) {
        
        BulkUserTagOperationResultDTO result = tagService.addTagsToUsers(request, instituteId, user.getUserId());
        
        log.info("Bulk add tags operation completed - Success: {}, Skip: {}, Error: {}", 
                result.getSuccessCount(), result.getSkipCount(), result.getErrorCount());
        
        return ResponseEntity.ok(result);
    }
    
    /**
     * Add single tag to multiple users
     */
    @PostMapping("/institutes/{instituteId}/tags/{tagId}/users/add")
    public ResponseEntity<BulkUserTagOperationResultDTO> addTagToUsers(
            @PathVariable String instituteId,
            @PathVariable String tagId,
            @RequestBody List<String> userIds,
            @RequestAttribute("user") CustomUserDetails user) {
        
        BulkUserTagOperationResultDTO result = tagService.addTagToUsers(userIds, tagId, instituteId, user.getUserId());
        
        log.info("Add tag {} to users operation completed - Success: {}, Skip: {}, Error: {}", 
                tagId, result.getSuccessCount(), result.getSkipCount(), result.getErrorCount());
        
        return ResponseEntity.ok(result);
    }
    
    /**
     * Deactivate user tags for specific users
     */
    @PostMapping("/institutes/{instituteId}/users/tags/deactivate")
    public ResponseEntity<BulkUserTagOperationResultDTO> deactivateUserTags(
            @PathVariable String instituteId,
            @RequestParam List<String> userIds,
            @RequestParam List<String> tagIds,
            @RequestAttribute("user") CustomUserDetails user) {
        
        BulkUserTagOperationResultDTO result = tagService.deactivateUserTags(userIds, tagIds, instituteId);
        
        log.info("Bulk deactivate tags operation completed - Success: {}, Skip: {}, Error: {}", 
                result.getSuccessCount(), result.getSkipCount(), result.getErrorCount());
        
        return ResponseEntity.ok(result);
    }
    
    // ========== CSV UPLOAD APIs ==========
    
    /**
     * Upload CSV file and add tag to all users in the file
     */
    @PostMapping("/institutes/{instituteId}/tags/{tagId}/users/csv-upload")
    public ResponseEntity<BulkUserTagOperationResultDTO> uploadCsvAndAddTag(
            @PathVariable String instituteId,
            @PathVariable String tagId,
            @RequestParam("file") MultipartFile csvFile,
            @RequestAttribute("user") CustomUserDetails user) {
        
        BulkUserTagOperationResultDTO result = csvTagService.processCsvAndAddTag(csvFile, tagId, instituteId, user.getUserId());
        
        log.info("CSV upload operation completed for tag {} - Success: {}, Skip: {}, Error: {}", 
                tagId, result.getSuccessCount(), result.getSkipCount(), result.getErrorCount());
        
        return ResponseEntity.ok(result);
    }
    
    /**
     * Validate CSV file format
     */
    @PostMapping("/csv/validate")
    public ResponseEntity<String> validateCsvFile(
            @RequestParam("file") MultipartFile csvFile,
            @RequestAttribute("user") CustomUserDetails user) {
        
        csvTagService.validateCsvFormat(csvFile);
        return ResponseEntity.ok("CSV file format is valid");
    }
    
    /**
     * Download CSV template
     */
    @GetMapping("/csv/template")
    public ResponseEntity<String> downloadCsvTemplate(@RequestAttribute("user") CustomUserDetails user) {
        String template = csvTagService.generateCsvTemplate();
        
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"user_tags_template.csv\"")
                .contentType(MediaType.TEXT_PLAIN)
                .body(template);
    }
    
    // ========== HEALTH CHECK ==========
    
    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> healthCheck() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "Tag Management Service",
                "timestamp", String.valueOf(System.currentTimeMillis())
        ));
    }
}
