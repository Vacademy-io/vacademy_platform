package vacademy.io.notification_service.features.announcements.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.features.announcements.client.AdminCoreServiceClient;
import vacademy.io.notification_service.features.announcements.client.AuthServiceClient;
import vacademy.io.notification_service.features.announcements.entity.AnnouncementRecipient;
import vacademy.io.notification_service.features.announcements.enums.RecipientType;
import vacademy.io.notification_service.features.announcements.repository.AnnouncementRecipientRepository;
import vacademy.io.notification_service.features.announcements.repository.AnnouncementRepository;
import vacademy.io.notification_service.features.announcements.entity.Announcement;
import vacademy.io.common.auth.entity.User;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class RecipientResolutionService {

    private final AnnouncementRecipientRepository recipientRepository;
    private final AuthServiceClient authServiceClient;
    private final AdminCoreServiceClient adminCoreServiceClient;
    private final AnnouncementRepository announcementRepository;

    /**
     * Resolves announcement recipients (roles, users, package_sessions, tags) to actual user IDs
     * Ensures deduplication and handles exclusions (identified by "EXCLUDE:" prefix in recipientId)
     */
    public List<String> resolveRecipientsToUsers(String announcementId) {
        log.info("Resolving recipients for announcement: {}", announcementId);
        
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
     * Helper method to resolve a list of recipients (either inclusions or exclusions)
     */
    private Set<String> resolveRecipientList(List<AnnouncementRecipient> recipients, String instituteId, String type) {
        Set<String> resolvedUserIds = new HashSet<>();
        List<String> tagIdsToResolve = new ArrayList<>();
        
        for (AnnouncementRecipient recipient : recipients) {
            // Get actual recipient ID (removes "EXCLUDE:" prefix if present)
            String actualRecipientId = recipient.getActualRecipientId();
            
            switch (recipient.getRecipientType()) {
                case USER:
                    resolvedUserIds.add(actualRecipientId);
                    log.debug("[{}] Added direct user: {}", type, actualRecipientId);
                    break;
                    
                case ROLE:
                    Set<String> roleUsers = resolveRoleToUsers(actualRecipientId, instituteId);
                    resolvedUserIds.addAll(roleUsers);
                    log.debug("[{}] Resolved role {} to {} users", type, actualRecipientId, roleUsers.size());
                    break;
                    
                case PACKAGE_SESSION:
                    Set<String> sessionUsers = resolvePackageSessionToUsers(actualRecipientId);
                    resolvedUserIds.addAll(sessionUsers);
                    log.debug("[{}] Resolved package session {} to {} users", type, actualRecipientId, sessionUsers.size());
                    break;
                
                case TAG:
                    // Collect tag IDs to resolve in a single batched call
                    if (actualRecipientId != null && !actualRecipientId.isBlank()) {
                        tagIdsToResolve.add(actualRecipientId);
                    }
                    break;
                    
                default:
                    log.warn("[{}] Unknown recipient type: {}", type, recipient.getRecipientType());
            }
        }
        
        // Resolve TAG recipients in one admin-core call
        if (!tagIdsToResolve.isEmpty()) {
            if (instituteId == null || instituteId.isBlank()) {
                log.warn("[{}] Institute ID unavailable while resolving TAG recipients; skipping tag resolution", type);
            } else {
                try {
                    List<String> tagUserIds = adminCoreServiceClient.getUsersByTags(instituteId, tagIdsToResolve);
                    resolvedUserIds.addAll(tagUserIds);
                    log.debug("[{}] Resolved {} users from {} tag(s)", type, tagUserIds.size(), tagIdsToResolve.size());
                } catch (Exception e) {
                    log.error("[{}] Error resolving users by tags {} for institute {}", type, tagIdsToResolve, instituteId, e);
                }
            }
        }
        
        return resolvedUserIds;
    }

    /**
     * Resolves a role to list of user IDs by calling auth service
     */
    private Set<String> resolveRoleToUsers(String roleId, String fallbackInstituteId) {
        log.debug("Resolving role: {} to users (fallback institute: {})", roleId, fallbackInstituteId);
        
        try {
            // Prefer institute from Announcement, ignore any suffix in roleId. Still tolerate legacy "role:institute" format.
            String[] parts = roleId.split(":");
            String roleName = parts[0];
            String instituteId = (fallbackInstituteId != null && !fallbackInstituteId.isBlank())
                    ? fallbackInstituteId
                    : (parts.length > 1 ? parts[1] : null);
            if (instituteId == null || instituteId.isBlank()) {
                log.warn("Institute ID unavailable for role resolution (roleId: {}).", roleId);
                return new HashSet<>();
            }
            
            List<User> users = authServiceClient.getUsersByRole(instituteId, roleName);
            Set<String> userIds = users.stream()
                    .map(User::getId)
                    .collect(Collectors.toSet());
            
            log.debug("Resolved role {} to {} users", roleId, userIds.size());
            return userIds;
            
        } catch (Exception e) {
            log.error("Error resolving role {} to users", roleId, e);
            return new HashSet<>();
        }
    }

    /**
     * Resolves a package session to list of user IDs (students + teachers)
     * Calls admin_core_service to get both students and faculty
     */
    private Set<String> resolvePackageSessionToUsers(String packageSessionId) {
        log.debug("Resolving package session: {} to users", packageSessionId);
        
        try {
            Set<String> userIds = new HashSet<>();
            
            // Get students enrolled in the package session
            List<String> studentIds = adminCoreServiceClient.getStudentsByPackageSessions(List.of(packageSessionId));
            userIds.addAll(studentIds);
            log.debug("Found {} students for package session: {}", studentIds.size(), packageSessionId);
            
            // Get faculty assigned to the package session
            List<String> facultyIds = adminCoreServiceClient.getFacultyByPackageSessions(List.of(packageSessionId));
            userIds.addAll(facultyIds);
            log.debug("Found {} faculty for package session: {}", facultyIds.size(), packageSessionId);
            
            log.debug("Resolved package session {} to {} total users (students + faculty)", packageSessionId, userIds.size());
            return userIds;
            
        } catch (Exception e) {
            log.error("Error resolving package session {} to users", packageSessionId, e);
            return new HashSet<>();
        }
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