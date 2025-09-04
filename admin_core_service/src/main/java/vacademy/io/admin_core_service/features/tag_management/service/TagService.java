package vacademy.io.admin_core_service.features.tag_management.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.tag_management.dto.*;
import vacademy.io.admin_core_service.features.tag_management.entity.Tag;
import vacademy.io.admin_core_service.features.tag_management.entity.UserTag;
import vacademy.io.admin_core_service.features.tag_management.enums.TagStatus;
import vacademy.io.admin_core_service.features.tag_management.repository.TagRepository;
import vacademy.io.admin_core_service.features.tag_management.repository.UserTagRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TagService {
    
    private final TagRepository tagRepository;
    private final UserTagRepository userTagRepository;
    private final InstituteStudentRepository studentRepository;
    
    /**
     * Create a new tag for an institute
     */
    @Transactional
    public TagDTO createTag(CreateTagDTO createTagDTO, String instituteId, String createdByUserId) {
        // Check if tag name already exists for this institute
        if (tagRepository.existsByTagNameAndInstituteId(createTagDTO.getTagName().trim(), instituteId)) {
            throw new IllegalArgumentException("Tag with name '" + createTagDTO.getTagName() + "' already exists for this institute");
        }
        
        Tag tag = new Tag(
            createTagDTO.getTagName().trim(),
            instituteId,
            createTagDTO.getDescription(),
            createdByUserId
        );
        
        Tag savedTag = tagRepository.save(tag);
        log.info("Created new tag: {} for institute: {}", savedTag.getTagName(), instituteId);
        
        return TagDTO.fromEntity(savedTag);
    }
    
    /**
     * Get all tags for an institute (including default tags)
     */
    public List<TagDTO> getAllTagsForInstitute(String instituteId) {
        List<Tag> tags = tagRepository.findActiveTagsByInstituteId(instituteId, TagStatus.ACTIVE);
        return tags.stream()
                .map(TagDTO::fromEntity)
                .collect(Collectors.toList());
    }
    
    /**
     * Get only default tags (system-wide)
     */
    public List<TagDTO> getDefaultTags() {
        List<Tag> defaultTags = tagRepository.findActiveDefaultTags(TagStatus.ACTIVE);
        return defaultTags.stream()
                .map(TagDTO::fromEntity)
                .collect(Collectors.toList());
    }
    
    /**
     * Get only institute-specific tags
     */
    public List<TagDTO> getInstituteSpecificTags(String instituteId) {
        List<Tag> instituteTags = tagRepository.findActiveInstituteSpecificTags(instituteId, TagStatus.ACTIVE);
        return instituteTags.stream()
                .map(TagDTO::fromEntity)
                .collect(Collectors.toList());
    }
    
    /**
     * Delete a tag (mark as inactive) - only non-default tags
     */
    @Transactional
    public void deleteTag(String tagId, String instituteId) {
        Tag tag = tagRepository.findActiveTagByIdAndInstituteId(tagId, instituteId)
                .orElseThrow(() -> new IllegalArgumentException("Tag not found or not accessible"));
        
        if (tag.isDefaultTag()) {
            throw new IllegalArgumentException("Default tags cannot be deleted");
        }
        
        tag.setStatus(TagStatus.INACTIVE);
        tagRepository.save(tag);
        
        log.info("Marked tag as inactive: {} for institute: {}", tag.getTagName(), instituteId);
    }
    
    /**
     * Get all tags for a specific user
     */
    public UserTagsResponseDTO getUserTags(String userId, String instituteId) {
        List<UserTag> userTags = userTagRepository.findAllUserTagsByUserIdAndInstituteId(userId, instituteId);
        
        List<TagDTO> activeTags = new ArrayList<>();
        List<TagDTO> inactiveTags = new ArrayList<>();
        
        for (UserTag userTag : userTags) {
            TagDTO tagDTO = TagDTO.fromEntity(userTag.getTag());
            if (userTag.isActive()) {
                activeTags.add(tagDTO);
            } else {
                inactiveTags.add(tagDTO);
            }
        }
        
        UserTagsResponseDTO response = new UserTagsResponseDTO();
        response.setUserId(userId);
        response.setActiveTags(activeTags);
        response.setInactiveTags(inactiveTags);
        response.setTotalTagCount(activeTags.size() + inactiveTags.size());
        
        return response;
    }
    
    /**
     * Get active tags for a specific user
     */
    public List<TagDTO> getActiveUserTags(String userId, String instituteId) {
        List<UserTag> userTags = userTagRepository.findActiveUserTagsByUserIdAndInstituteId(userId, instituteId);
        return userTags.stream()
                .map(userTag -> TagDTO.fromEntity(userTag.getTag()))
                .collect(Collectors.toList());
    }
    
    /**
     * Get active tags for multiple users
     */
    public Map<String, List<TagDTO>> getActiveUserTagsForMultipleUsers(List<String> userIds, String instituteId) {
        List<UserTag> userTags = userTagRepository.findActiveUserTagsByUserIdsAndInstituteId(userIds, instituteId);
        
        Map<String, List<TagDTO>> result = new HashMap<>();
        
        // Initialize empty lists for all users
        for (String userId : userIds) {
            result.put(userId, new ArrayList<>());
        }
        
        // Group tags by user
        for (UserTag userTag : userTags) {
            result.get(userTag.getUserId()).add(TagDTO.fromEntity(userTag.getTag()));
        }
        
        return result;
    }
    
    /**
     * Add tags to users
     */
    @Transactional
    public BulkUserTagOperationResultDTO addTagsToUsers(AddTagsToUsersDTO request, String instituteId, String createdByUserId) {
        // Validate and auto-create tags if they don't exist
        validateAndCreateTagsIfNeeded(request.getTagIds(), instituteId, createdByUserId);
        
        int totalProcessed = request.getUserIds().size() * request.getTagIds().size();
        int successCount = 0;
        int skipCount = 0;
        int errorCount = 0;
        List<String> errors = new ArrayList<>();
        Map<String, String> userErrors = new HashMap<>();
        
        for (String userId : request.getUserIds()) {
            for (String tagId : request.getTagIds()) {
                try {
                    // Check if user already has this tag
                    Optional<UserTag> existingUserTag = userTagRepository.findUserTagByUserIdAndTagIdAndInstituteId(userId, tagId, instituteId);
                    
                    if (existingUserTag.isPresent()) {
                        UserTag userTag = existingUserTag.get();
                        if (userTag.isActive()) {
                            // User already has active tag, skip
                            skipCount++;
                        } else {
                            // User has inactive tag, activate it
                            userTag.activate();
                            userTagRepository.save(userTag);
                            successCount++;
                        }
                    } else {
                        // Create new user tag
                        UserTag newUserTag = new UserTag(userId, tagId, instituteId, createdByUserId);
                        userTagRepository.save(newUserTag);
                        successCount++;
                    }
                } catch (Exception e) {
                    errorCount++;
                    String error = "Failed to add tag " + tagId + " to user " + userId + ": " + e.getMessage();
                    errors.add(error);
                    userErrors.put(userId, error);
                    log.error("Error adding tag to user", e);
                }
            }
        }
        
        BulkUserTagOperationResultDTO result = new BulkUserTagOperationResultDTO(totalProcessed, successCount, skipCount, errorCount);
        result.setErrors(errors);
        result.setUserErrors(userErrors);
        
        log.info("Bulk tag operation completed - Total: {}, Success: {}, Skip: {}, Error: {}", 
                totalProcessed, successCount, skipCount, errorCount);
        
        return result;
    }
    
    /**
     * Add single tag to multiple users (for CSV upload)
     */
    @Transactional
    public BulkUserTagOperationResultDTO addTagToUsers(List<String> userIds, String tagId, String instituteId, String createdByUserId) {
        // Validate and auto-create tag if it doesn't exist
        validateAndCreateTagIfNeeded(tagId, instituteId, createdByUserId);
        
        int totalProcessed = userIds.size();
        int successCount = 0;
        int skipCount = 0;
        int errorCount = 0;
        List<String> errors = new ArrayList<>();
        Map<String, String> userErrors = new HashMap<>();
        
        for (String userId : userIds) {
            try {
                // Check if user already has this tag
                Optional<UserTag> existingUserTag = userTagRepository.findUserTagByUserIdAndTagIdAndInstituteId(userId, tagId, instituteId);
                
                if (existingUserTag.isPresent()) {
                    UserTag userTag = existingUserTag.get();
                    if (userTag.isActive()) {
                        // User already has active tag, skip
                        skipCount++;
                    } else {
                        // User has inactive tag, activate it
                        userTag.activate();
                        userTagRepository.save(userTag);
                        successCount++;
                    }
                } else {
                    // Create new user tag
                    UserTag newUserTag = new UserTag(userId, tagId, instituteId, createdByUserId);
                    userTagRepository.save(newUserTag);
                    successCount++;
                }
            } catch (Exception e) {
                errorCount++;
                String error = "Failed to add tag to user " + userId + ": " + e.getMessage();
                errors.add(error);
                userErrors.put(userId, error);
                log.error("Error adding tag to user", e);
            }
        }
        
        BulkUserTagOperationResultDTO result = new BulkUserTagOperationResultDTO(totalProcessed, successCount, skipCount, errorCount);
        result.setErrors(errors);
        result.setUserErrors(userErrors);
        
        log.info("Bulk tag operation for single tag completed - Total: {}, Success: {}, Skip: {}, Error: {}", 
                totalProcessed, successCount, skipCount, errorCount);
        
        return result;
    }
    
    /**
     * Make user tags inactive for specific users
     */
    @Transactional
    public BulkUserTagOperationResultDTO deactivateUserTags(List<String> userIds, List<String> tagIds, String instituteId) {
        int totalProcessed = userIds.size() * tagIds.size();
        int successCount = 0;
        int skipCount = 0;
        int errorCount = 0;
        List<String> errors = new ArrayList<>();
        Map<String, String> userErrors = new HashMap<>();
        
        for (String tagId : tagIds) {
            try {
                int updatedCount = userTagRepository.deactivateUserTagsForUsers(userIds, tagId, instituteId);
                successCount += updatedCount;
                skipCount += (userIds.size() - updatedCount); // Records that were already inactive or didn't exist
            } catch (Exception e) {
                errorCount += userIds.size();
                String error = "Failed to deactivate tag " + tagId + " for users: " + e.getMessage();
                errors.add(error);
                log.error("Error deactivating user tags", e);
            }
        }
        
        BulkUserTagOperationResultDTO result = new BulkUserTagOperationResultDTO(totalProcessed, successCount, skipCount, errorCount);
        result.setErrors(errors);
        result.setUserErrors(userErrors);
        
        log.info("Bulk deactivate operation completed - Total: {}, Success: {}, Skip: {}, Error: {}", 
                totalProcessed, successCount, skipCount, errorCount);
        
        return result;
    }
    
    /**
     * Add tag by name to multiple users (auto-creates tag if it doesn't exist)
     */
    @Transactional
    public BulkUserTagOperationResultDTO addTagByNameToUsers(List<String> userIds, String tagName, String instituteId, String createdByUserId) {
        // Find or create tag by name
        Tag tag = findOrCreateTagByName(tagName, instituteId, createdByUserId);
        
        // Use the existing addTagToUsers method with the tag ID
        return addTagToUsers(userIds, tag.getId(), instituteId, createdByUserId);
    }
    
    /**
     * Get tag statistics for an institute
     */
    public List<Map<String, Object>> getTagStatistics(String instituteId) {
        List<Object[]> stats = userTagRepository.getUserCountPerTagByInstituteId(instituteId);
        
        return stats.stream()
                .map(stat -> {
                    Map<String, Object> result = new HashMap<>();
                    result.put("tagId", stat[0]);
                    result.put("tagName", stat[1]);
                    result.put("userCount", stat[2]);
                    return result;
                })
                .collect(Collectors.toList());
    }
    
    /**
     * Get all user IDs that have a specific tag
     */
    public List<String> getUserIdsByTag(String tagId, String instituteId) {
        // Validate that tag exists and is accessible
        tagRepository.findActiveTagByIdAndInstituteId(tagId, instituteId)
                .orElseThrow(() -> new IllegalArgumentException("Tag not found or not accessible"));
        
        return userTagRepository.findUserIdsByTagIdAndInstituteId(tagId, instituteId);
    }
    
    /**
     * Get all user IDs that have any of the specified tags
     */
    public List<String> getUserIdsByTags(List<String> tagIds, String instituteId) {
        // Validate that all tags exist and are accessible
        List<Tag> tags = tagRepository.findActiveTagsByIdsAndInstituteId(tagIds, instituteId);
        if (tags.size() != tagIds.size()) {
            throw new IllegalArgumentException("Some tags not found or not accessible");
        }
        
        return userTagRepository.findUserIdsByTagIdsAndInstituteId(tagIds, instituteId);
    }
    
    /**
     * Get detailed user information for users that have any of the specified tags
     */
    public List<Map<String, Object>> getUserDetailsByTags(List<String> tagIds, String instituteId) {
        // Validate that all tags exist and are accessible
        List<Tag> tags = tagRepository.findActiveTagsByIdsAndInstituteId(tagIds, instituteId);
        if (tags.size() != tagIds.size()) {
            throw new IllegalArgumentException("Some tags not found or not accessible");
        }
        
        // Get user IDs
        List<String> userIds = userTagRepository.findUserIdsByTagIdsAndInstituteId(tagIds, instituteId);
        
        if (userIds.isEmpty()) {
            return new ArrayList<>();
        }
        
        // Get student details for these user IDs
        List<Map<String, Object>> userDetails = studentRepository.findStudentDetailsByUserIds(userIds);
        
        log.info("Retrieved detailed information for {} users with tags {} in institute {}", 
                userDetails.size(), tagIds, instituteId);
        
        return userDetails;
    }
    
    /**
     * Get user counts for multiple tags
     */
    public Map<String, Object> getUserCountsByTags(List<String> tagIds, String instituteId) {
        // Validate that all tags exist and are accessible
        List<Tag> tags = tagRepository.findActiveTagsByIdsAndInstituteId(tagIds, instituteId);
        Map<String, String> tagIdToNameMap = tags.stream()
                .collect(Collectors.toMap(Tag::getId, Tag::getTagName));
        
        // Get user counts per tag
        List<Object[]> counts = userTagRepository.getUserCountPerSpecificTags(tagIds, instituteId);
        
        Map<String, Object> result = new HashMap<>();
        Map<String, Long> tagCounts = new HashMap<>();
        
        // Process the counts
        for (Object[] count : counts) {
            String tagId = (String) count[0];
            String tagName = (String) count[1];
            Long userCount = (Long) count[2];
            
            tagCounts.put(tagName, userCount);
        }
        
        // Add zero counts for tags that have no users
        for (Tag tag : tags) {
            if (!tagCounts.containsKey(tag.getTagName())) {
                tagCounts.put(tag.getTagName(), 0L);
            }
        }
        
        result.put("tagCounts", tagCounts);
        result.put("totalTags", tagIds.size());
        result.put("totalUsers", tagCounts.values().stream().mapToLong(Long::longValue).sum());
        
        log.info("Retrieved user counts for {} tags in institute {}: {}", 
                tagIds.size(), instituteId, tagCounts);
        
        return result;
    }
    
    /**
     * Validate and auto-create multiple tags if they don't exist for the institute
     */
    private List<Tag> validateAndCreateTagsIfNeeded(List<String> tagIds, String instituteId, String createdByUserId) {
        List<Tag> existingTags = tagRepository.findActiveTagsByIdsAndInstituteId(tagIds, instituteId);
        Set<String> existingTagIds = existingTags.stream()
                .map(Tag::getId)
                .collect(Collectors.toSet());
        
        // Find missing tag IDs
        List<String> missingTagIds = tagIds.stream()
                .filter(tagId -> !existingTagIds.contains(tagId))
                .collect(Collectors.toList());
        
        // Auto-create missing tags
        List<Tag> newTags = new ArrayList<>();
        for (String missingTagId : missingTagIds) {
            try {
                Tag newTag = autoCreateTagForInstitute(missingTagId, instituteId, createdByUserId);
                if (newTag != null) {
                    newTags.add(newTag);
                    log.info("Auto-created tag: {} for institute: {}", newTag.getTagName(), instituteId);
                }
            } catch (Exception e) {
                log.warn("Failed to auto-create tag with ID: {} for institute: {}. Error: {}", 
                        missingTagId, instituteId, e.getMessage());
            }
        }
        
        // Combine existing and new tags
        List<Tag> allTags = new ArrayList<>(existingTags);
        allTags.addAll(newTags);
        
        return allTags;
    }
    
    /**
     * Validate and auto-create single tag if it doesn't exist for the institute
     */
    private Tag validateAndCreateTagIfNeeded(String tagId, String instituteId, String createdByUserId) {
        Optional<Tag> existingTag = tagRepository.findActiveTagByIdAndInstituteId(tagId, instituteId);
        
        if (existingTag.isPresent()) {
            return existingTag.get();
        }
        
        // Try to auto-create the tag
        try {
            Tag newTag = autoCreateTagForInstitute(tagId, instituteId, createdByUserId);
            if (newTag != null) {
                log.info("Auto-created tag: {} for institute: {}", newTag.getTagName(), instituteId);
                return newTag;
            }
        } catch (Exception e) {
            log.warn("Failed to auto-create tag with ID: {} for institute: {}. Error: {}", 
                    tagId, instituteId, e.getMessage());
        }
        
        throw new IllegalArgumentException("Tag with ID '" + tagId + "' not found and could not be auto-created for institute");
    }
    
    /**
     * Auto-create a tag for an institute by looking up an existing tag with the same ID
     * This could be a default tag or a tag from another institute that we want to replicate
     */
    private Tag autoCreateTagForInstitute(String sourceTagId, String instituteId, String createdByUserId) {
        // First, try to find the source tag (could be default or from another institute)
        Optional<Tag> sourceTag = tagRepository.findById(sourceTagId);
        
        if (sourceTag.isPresent()) {
            Tag original = sourceTag.get();
            
            // If it's a default tag, we don't need to create a copy - it's already accessible
            if (original.isDefaultTag()) {
                return original;
            }
            
            // If it's from another institute, create a copy for this institute
            // Check if tag name already exists for this institute to avoid duplicates
            if (tagRepository.existsByTagNameAndInstituteId(original.getTagName(), instituteId)) {
                log.warn("Tag with name '{}' already exists for institute {}, skipping auto-creation", 
                        original.getTagName(), instituteId);
                return null;
            }
            
            // Create a new tag for this institute based on the source tag
            Tag newTag = new Tag(
                original.getTagName(),
                instituteId,
                "Auto-created from existing tag: " + original.getTagName(),
                createdByUserId
            );
            
            return tagRepository.save(newTag);
        }
        
        // If no source tag found, create a basic tag with the ID as the name
        String tagName = "Tag-" + sourceTagId.substring(Math.max(0, sourceTagId.length() - 8));
        
        // Check if this generated name already exists
        if (tagRepository.existsByTagNameAndInstituteId(tagName, instituteId)) {
            tagName = tagName + "-" + System.currentTimeMillis();
        }
        
        Tag newTag = new Tag(
            tagName,
            instituteId,
            "Auto-created tag",
            createdByUserId
        );
        
        return tagRepository.save(newTag);
    }
    
    /**
     * Find existing tag by name or create a new one for the institute
     */
    private Tag findOrCreateTagByName(String tagName, String instituteId, String createdByUserId) {
        // First, check if tag already exists for this institute (including default tags)
        List<Tag> existingTags = tagRepository.findByTagNameAndInstituteId(tagName.trim(), instituteId, TagStatus.ACTIVE);
        
        if (!existingTags.isEmpty()) {
            // Return the first matching tag (prefer institute-specific over default)
            return existingTags.stream()
                    .sorted((t1, t2) -> {
                        // Institute-specific tags first, then default tags
                        if (t1.getInstituteId() != null && t2.getInstituteId() == null) return -1;
                        if (t1.getInstituteId() == null && t2.getInstituteId() != null) return 1;
                        return 0;
                    })
                    .findFirst()
                    .orElse(existingTags.get(0));
        }
        
        // Create new tag for this institute
        Tag newTag = new Tag(
            tagName.trim(),
            instituteId,
            "Auto-created tag",
            createdByUserId
        );
        
        Tag savedTag = tagRepository.save(newTag);
        log.info("Auto-created tag by name: '{}' for institute: {}", tagName, instituteId);
        
        return savedTag;
    }
}
