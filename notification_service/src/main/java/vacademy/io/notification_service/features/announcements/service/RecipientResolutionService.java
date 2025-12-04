package vacademy.io.notification_service.features.announcements.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.features.announcements.client.AdminCoreServiceClient;
import vacademy.io.notification_service.features.announcements.entity.AnnouncementRecipient;
import vacademy.io.notification_service.features.announcements.enums.RecipientType;
import vacademy.io.notification_service.features.announcements.repository.AnnouncementRecipientRepository;
import vacademy.io.notification_service.features.announcements.repository.AnnouncementRepository;
import vacademy.io.notification_service.features.announcements.entity.Announcement;
import vacademy.io.notification_service.features.announcements.service.resolver.CustomFieldFilterRecipientResolver;
import vacademy.io.notification_service.features.announcements.service.resolver.RecipientResolver;
import vacademy.io.notification_service.features.announcements.service.resolver.RecipientResolverRegistry;

import java.util.*;
import java.util.stream.Collectors;
import vacademy.io.notification_service.features.announcements.dto.CentralizedRecipientResolutionRequest;
import vacademy.io.notification_service.features.announcements.dto.PaginatedUserIdResponse;

@Service
@RequiredArgsConstructor
@Slf4j
public class RecipientResolutionService {

    private final AnnouncementRecipientRepository recipientRepository;
    private final AdminCoreServiceClient adminCoreServiceClient;
    private final AnnouncementRepository announcementRepository;
    private final RecipientResolverRegistry resolverRegistry;
    private final CustomFieldFilterRecipientResolver customFieldFilterResolver;

    /**
     * Resolves announcement recipients (roles, users, package_sessions, tags) to actual user IDs
     * Ensures deduplication and handles exclusions (identified by "EXCLUDE:" prefix in recipientId)
     * Uses centralized API for better performance and scalability
     */
    public List<String> resolveRecipientsToUsers(String announcementId) {
        log.info("Resolving recipients for announcement: {}", announcementId);

        try {
            // Try to use centralized resolution first
            return resolveRecipientsToUsersCentralized(announcementId);
        } catch (Exception e) {
            log.warn("Centralized recipient resolution failed for announcement {}, falling back to legacy method", announcementId, e);
            // Fallback to legacy method
            return resolveRecipientsToUsersLegacy(announcementId);
        }
    }

    /**
     * New centralized resolution method - uses admin-core-service centralized API
     */
    private List<String> resolveRecipientsToUsersCentralized(String announcementId) {
        log.debug("Using centralized recipient resolution for announcement: {}", announcementId);

        // Fetch announcement to get institute ID
        Announcement announcement = announcementRepository.findById(announcementId)
            .orElseThrow(() -> new RuntimeException("Announcement not found: " + announcementId));

        // Fetch all recipients
        List<AnnouncementRecipient> allRecipients = recipientRepository.findByAnnouncementId(announcementId);

        // Build centralized request
        CentralizedRecipientResolutionRequest request = buildCentralizedRequest(announcement, allRecipients);

        // Call centralized API with pagination to get all users
        List<String> allUserIds = new ArrayList<>();
        int pageSize = 1000; // Match the default page size

        while (true) {
            request.setPageNumber(allUserIds.size() / pageSize);
            request.setPageSize(pageSize);

            PaginatedUserIdResponse response = adminCoreServiceClient.resolveRecipientsCentralized(request);

            if (response.getUserIds() != null) {
                allUserIds.addAll(response.getUserIds());
            }

            // Check if we have all pages
            if (!response.isHasNext() || response.getUserIds() == null || response.getUserIds().size() < pageSize) {
                break;
            }
        }

        log.info("Centralized resolution completed for announcement {}: {} unique users", announcementId, allUserIds.size());
        return allUserIds;
    }

    /**
     * Legacy resolution method - kept as fallback
     */
    private List<String> resolveRecipientsToUsersLegacy(String announcementId) {
        log.debug("Using legacy recipient resolution for announcement: {}", announcementId);

        // Fetch all recipients and separate inclusions from exclusions based on prefix
        List<AnnouncementRecipient> allRecipients = recipientRepository.findByAnnouncementId(announcementId);
        List<AnnouncementRecipient> recipients = allRecipients.stream()
                .filter(r -> !r.isExclusion())
                .toList();
        List<AnnouncementRecipient> exclusions = allRecipients.stream()
                .filter(AnnouncementRecipient::isExclusion)
                .toList();

        Announcement announcement = null;
        String announcementInstituteId = null;
        try {
            announcement = announcementRepository.findById(announcementId)
                .orElse(null);
            if (announcement != null) {
                announcementInstituteId = announcement.getInstituteId();
            }
        } catch (Exception e) {
            log.warn("Failed to fetch announcement {} while resolving recipients", announcementId, e);
        }

        // Step 1: Resolve all included recipients
        Set<String> includedUserIds = resolveRecipientList(recipients, announcementInstituteId, "inclusions");
        log.info("Resolved {} inclusion recipients to {} unique users", recipients.size(), includedUserIds.size());

        // Step 2: Resolve all excluded recipients
        Set<String> excludedUserIds = new HashSet<>();
        if (!exclusions.isEmpty()) {
            excludedUserIds = resolveRecipientList(exclusions, announcementInstituteId, "exclusions");
            log.info("Resolved {} exclusion recipients to {} unique users", exclusions.size(), excludedUserIds.size());

            // Step 3: Remove excluded users from included users
            int beforeExclusion = includedUserIds.size();
            includedUserIds.removeAll(excludedUserIds);
            int afterExclusion = includedUserIds.size();
            log.info("Applied exclusions: {} users removed, {} users remaining",
                    (beforeExclusion - afterExclusion), afterExclusion);
        }

        List<String> finalUserList = new ArrayList<>(includedUserIds);
        log.info("Final resolved recipients for announcement {}: {} unique users", announcementId, finalUserList.size());

        return finalUserList;
    }

    /**
     * Build centralized request from announcement recipients
     * Now supports custom field filters and exclusions per recipient
     * Pre-resolves USER recipients (handles both user IDs and emails)
     */
    private CentralizedRecipientResolutionRequest buildCentralizedRequest(Announcement announcement, List<AnnouncementRecipient> allRecipients) {
        CentralizedRecipientResolutionRequest request = new CentralizedRecipientResolutionRequest();
        request.setInstituteId(announcement.getInstituteId());
        request.setPageNumber(0);
        request.setPageSize(1000);

        // Group recipients by their logical grouping - each recipient can now have custom field filters and exclusions
        List<CentralizedRecipientResolutionRequest.RecipientWithExclusions> recipientsWithExclusions = new ArrayList<>();

        // For now, we'll treat each announcement recipient as a separate centralized recipient
        // In the future, this could be optimized to group related recipients
        for (AnnouncementRecipient recipient : allRecipients) {
            if (!recipient.isExclusion()) {
                // This is an inclusion recipient
                CentralizedRecipientResolutionRequest.RecipientWithExclusions recipientWithExclusions =
                    new CentralizedRecipientResolutionRequest.RecipientWithExclusions();

                recipientWithExclusions.setRecipientType(recipient.getRecipientType().name());
                String actualRecipientId = recipient.getActualRecipientId();

                // Pre-resolve USER recipients (handles both user IDs and emails)
                if ("USER".equals(recipient.getRecipientType().name())) {
                    // Use the resolver to handle email -> user ID conversion
                    Optional<RecipientResolver> userResolverOpt = resolverRegistry.getResolver("USER");
                    if (userResolverOpt.isPresent()) {
                        try {
                            Set<String> resolvedUserIds = userResolverOpt.get().resolve(actualRecipientId, announcement.getInstituteId());
                            if (!resolvedUserIds.isEmpty()) {
                                // For USER type, we need to create separate recipients for each resolved user ID
                                for (String resolvedUserId : resolvedUserIds) {
                                    CentralizedRecipientResolutionRequest.RecipientWithExclusions userRecipient =
                                        new CentralizedRecipientResolutionRequest.RecipientWithExclusions();
                                    userRecipient.setRecipientType("USER");
                                    userRecipient.setRecipientId(resolvedUserId);
                                    // USER recipients don't support exclusions in the centralized system
                                    recipientsWithExclusions.add(userRecipient);
                                }
                                continue; // Skip adding the original recipient
                            }
                        } catch (Exception e) {
                            log.error("Error pre-resolving USER recipient {}: {}", actualRecipientId, e);
                            // Fall back to original ID
                        }
                    }
                }

                recipientWithExclusions.setRecipientId(actualRecipientId);

                // TODO: Add custom field filters from announcement payload (when available)
                // For now, we'll handle basic recipient types without custom field filters
                // recipientWithExclusions.setCustomFieldFilters(...);

                // Find exclusions for this recipient (if any) - legacy support
                List<AnnouncementRecipient> exclusionsForThisRecipient = allRecipients.stream()
                    .filter(r -> r.isExclusion() && r.getRecipientType() == recipient.getRecipientType())
                    .toList();

                if (!exclusionsForThisRecipient.isEmpty()) {
                    List<CentralizedRecipientResolutionRequest.RecipientWithExclusions.Exclusion> exclusions = new ArrayList<>();
                    for (AnnouncementRecipient exclusion : exclusionsForThisRecipient) {
                        CentralizedRecipientResolutionRequest.RecipientWithExclusions.Exclusion excl =
                            new CentralizedRecipientResolutionRequest.RecipientWithExclusions.Exclusion();
                        excl.setExclusionType(exclusion.getRecipientType().name());
                        excl.setExclusionId(exclusion.getActualRecipientId());
                        exclusions.add(excl);
                    }
                    recipientWithExclusions.setExclusions(exclusions);
                }

                recipientsWithExclusions.add(recipientWithExclusions);
            }
        }

        // If no inclusions found, add a default empty recipient to avoid empty list
        if (recipientsWithExclusions.isEmpty()) {
            CentralizedRecipientResolutionRequest.RecipientWithExclusions emptyRecipient =
                new CentralizedRecipientResolutionRequest.RecipientWithExclusions();
            emptyRecipient.setRecipientType("USER");
            emptyRecipient.setRecipientId("nonexistent");
            recipientsWithExclusions.add(emptyRecipient);
        }

        request.setRecipients(recipientsWithExclusions);
        return request;
    }
    
    /**
     * Helper method to resolve a list of recipients (either inclusions or exclusions)
     * Refactored to use resolver pattern following SOLID principles
     */
    private Set<String> resolveRecipientList(List<AnnouncementRecipient> recipients, String instituteId, String type) {
        Set<String> resolvedUserIds = new HashSet<>();
        List<String> tagIdsToResolve = new ArrayList<>();
        List<AnnouncementRecipient> customFieldFilterRecipients = new ArrayList<>();
        
        // Group recipients by type for efficient processing
        for (AnnouncementRecipient recipient : recipients) {
            RecipientType recipientType = recipient.getRecipientType();
            String actualRecipientId = recipient.getActualRecipientId();
            
            // Handle TAG recipients - batch them for single API call
            if (recipientType == RecipientType.TAG) {
                if (actualRecipientId != null && !actualRecipientId.isBlank()) {
                    tagIdsToResolve.add(actualRecipientId);
                }
                continue;
            }
            
            // Handle CUSTOM_FIELD_FILTER recipients - need special handling
            if (recipientType == RecipientType.CUSTOM_FIELD_FILTER) {
                customFieldFilterRecipients.add(recipient);
                continue;
            }
            
            // Use resolver pattern for other types (USER, ROLE, PACKAGE_SESSION)
            Optional<RecipientResolver> resolverOpt = resolverRegistry.getResolver(recipientType.name());
            if (resolverOpt.isPresent()) {
                try {
                    RecipientResolver resolver = resolverOpt.get();
                    Set<String> userIds = resolver.resolve(actualRecipientId, instituteId);
                    resolvedUserIds.addAll(userIds);
                    log.debug("[{}] Resolved {} {} to {} users", type, recipientType, actualRecipientId, userIds.size());
                } catch (Exception e) {
                    log.error("[{}] Error resolving {} recipient {} for institute {}", 
                            type, recipientType, actualRecipientId, instituteId, e);
                }
            } else {
                log.warn("[{}] No resolver found for recipient type: {}", type, recipientType);
            }
        }
        
        // Resolve TAG recipients in one batched call (optimized for large datasets)
        if (!tagIdsToResolve.isEmpty()) {
            if (instituteId == null || instituteId.isBlank()) {
                log.warn("[{}] Institute ID unavailable while resolving TAG recipients; skipping tag resolution", type);
            } else {
                try {
                    // Get resolver for TAG type
                    Optional<RecipientResolver> tagResolverOpt = resolverRegistry.getResolver("TAG");
                    if (tagResolverOpt.isPresent()) {
                        // Resolve all tags - the resolver handles pagination internally if needed
                        for (String tagId : tagIdsToResolve) {
                            Set<String> tagUserIds = tagResolverOpt.get().resolve(tagId, instituteId);
                            resolvedUserIds.addAll(tagUserIds);
                        }
                        log.debug("[{}] Resolved {} users from {} tag(s)", type, tagIdsToResolve.size(), tagIdsToResolve.size());
                    }
                } catch (Exception e) {
                    log.error("[{}] Error resolving users by tags {} for institute {}", type, tagIdsToResolve, instituteId, e);
                }
            }
        }
        
        // Resolve CUSTOM_FIELD_FILTER recipients (works for both inclusions and exclusions)
        for (AnnouncementRecipient recipient : customFieldFilterRecipients) {
            try {
                log.debug("[{}] Processing CUSTOM_FIELD_FILTER recipient (ID: {}, Name: {})", 
                        type, recipient.getRecipientId(), recipient.getRecipientName());
                Set<String> filterUserIds = customFieldFilterResolver.resolveFromRecipient(recipient, instituteId);
                resolvedUserIds.addAll(filterUserIds);
                log.debug("[{}] Resolved CUSTOM_FIELD_FILTER to {} users", type, filterUserIds.size());
            } catch (Exception e) {
                log.error("[{}] Error resolving CUSTOM_FIELD_FILTER recipient for institute {}", 
                        type, instituteId, e);
            }
        }
        
        return resolvedUserIds;
    }


    /**
     * Get recipient summary for an announcement
     */
    public RecipientSummary getRecipientSummary(String announcementId) {
        List<AnnouncementRecipient> recipients = recipientRepository.findByAnnouncementId(announcementId);
        
        Map<RecipientType, Long> recipientCounts = recipients.stream()
                .collect(Collectors.groupingBy(
                        AnnouncementRecipient::getRecipientType,
                        Collectors.counting()
                ));
        
        List<String> resolvedUsers = resolveRecipientsToUsers(announcementId);
        
        return new RecipientSummary(
                recipientCounts.getOrDefault(RecipientType.USER, 0L),
                recipientCounts.getOrDefault(RecipientType.ROLE, 0L),
                recipientCounts.getOrDefault(RecipientType.PACKAGE_SESSION, 0L),
                (long) resolvedUsers.size(),
                resolvedUsers
        );
    }

    /**
     * Validate if recipients are valid before creating announcement
     */
    public ValidationResult validateRecipients(List<String> recipientIds, RecipientType recipientType) {
        // TODO: Implement validation logic
        // This should validate that the recipient IDs exist in the system
        
        log.debug("Validating {} recipients of type: {}", recipientIds.size(), recipientType);
        
        List<String> invalidIds = new ArrayList<>();
        List<String> validIds = new ArrayList<>(recipientIds);
        
        // Placeholder validation - in real implementation:
        // 1. For USER type: Check if user exists in auth service
        // 2. For ROLE type: Check if role exists and has users
        // 3. For PACKAGE_SESSION type: Check if package session exists and has enrolled users
        
        return new ValidationResult(validIds, invalidIds, invalidIds.isEmpty());
    }

    // Helper classes
    public static class RecipientSummary {
        private final Long directUsers;
        private final Long roles;
        private final Long packageSessions;
        private final Long totalResolvedUsers;
        private final List<String> resolvedUserIds;
        
        public RecipientSummary(Long directUsers, Long roles, Long packageSessions, 
                               Long totalResolvedUsers, List<String> resolvedUserIds) {
            this.directUsers = directUsers;
            this.roles = roles;
            this.packageSessions = packageSessions;
            this.totalResolvedUsers = totalResolvedUsers;
            this.resolvedUserIds = resolvedUserIds;
        }
        
        // Getters
        public Long getDirectUsers() { return directUsers; }
        public Long getRoles() { return roles; }
        public Long getPackageSessions() { return packageSessions; }
        public Long getTotalResolvedUsers() { return totalResolvedUsers; }
        public List<String> getResolvedUserIds() { return resolvedUserIds; }
    }
    
    public static class ValidationResult {
        private final List<String> validIds;
        private final List<String> invalidIds;
        private final boolean isValid;
        
        public ValidationResult(List<String> validIds, List<String> invalidIds, boolean isValid) {
            this.validIds = validIds;
            this.invalidIds = invalidIds;
            this.isValid = isValid;
        }
        
        // Getters
        public List<String> getValidIds() { return validIds; }
        public List<String> getInvalidIds() { return invalidIds; }
        public boolean isValid() { return isValid; }
    }
}