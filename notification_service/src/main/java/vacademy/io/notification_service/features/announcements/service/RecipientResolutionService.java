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
     * Resolves announcement recipients (roles, users, package_sessions) to actual user IDs
     * Ensures deduplication as mentioned in requirements
     */
    public List<String> resolveRecipientsToUsers(String announcementId) {
        log.info("Resolving recipients for announcement: {}", announcementId);
        
        List<AnnouncementRecipient> recipients = recipientRepository.findByAnnouncementId(announcementId);
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
        Set<String> resolvedUserIds = new HashSet<>(); // Using Set for automatic deduplication
        
        for (AnnouncementRecipient recipient : recipients) {
            switch (recipient.getRecipientType()) {
                case USER:
                    resolvedUserIds.add(recipient.getRecipientId());
                    log.debug("Added direct user: {}", recipient.getRecipientId());
                    break;
                    
                case ROLE:
                    Set<String> roleUsers = resolveRoleToUsers(recipient.getRecipientId(), announcementInstituteId);
                    resolvedUserIds.addAll(roleUsers);
                    log.debug("Resolved role {} to {} users", recipient.getRecipientId(), roleUsers.size());
                    break;
                    
                case PACKAGE_SESSION:
                    Set<String> sessionUsers = resolvePackageSessionToUsers(recipient.getRecipientId());
                    resolvedUserIds.addAll(sessionUsers);
                    log.debug("Resolved package session {} to {} users", recipient.getRecipientId(), sessionUsers.size());
                    break;
                    
                default:
                    log.warn("Unknown recipient type: {}", recipient.getRecipientType());
            }
        }
        
        List<String> finalUserList = new ArrayList<>(resolvedUserIds);
        log.info("Resolved {} recipients to {} unique users for announcement: {}", 
                recipients.size(), finalUserList.size(), announcementId);
        
        return finalUserList;
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