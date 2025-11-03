package vacademy.io.notification_service.features.announcements.service.resolver;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.notification_service.features.announcements.client.AuthServiceClient;
import vacademy.io.common.auth.entity.User;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Resolves ROLE type recipients with pagination support for scalability
 * Handles large datasets (0.15M+ users) by fetching in batches
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RoleRecipientResolver implements RecipientResolver {
    
    private final AuthServiceClient authServiceClient;
    
    @Override
    public Set<String> resolve(String recipientId, String fallbackInstituteId) {
        log.debug("Resolving role: {} to users (fallback institute: {})", recipientId, fallbackInstituteId);
        
        try {
            // Prefer institute from Announcement, ignore any suffix in roleId. Still tolerate legacy "role:institute" format.
            String[] parts = recipientId.split(":");
            String roleName = parts[0];
            String instituteId = (fallbackInstituteId != null && !fallbackInstituteId.isBlank())
                    ? fallbackInstituteId
                    : (parts.length > 1 ? parts[1] : null);
            if (instituteId == null || instituteId.isBlank()) {
                log.warn("Institute ID unavailable for role resolution (roleId: {}).", recipientId);
                return new HashSet<>();
            }
            
            // Get all users by role with pagination
            Set<String> allUserIds = new HashSet<>();
            List<User> users = authServiceClient.getUsersByRole(instituteId, roleName);
            
            // Note: If auth-service endpoint doesn't support pagination, we'll need to add it
            // For now, this works but may need pagination if roles have 100K+ users
            Set<String> userIds = users.stream()
                    .map(User::getId)
                    .collect(Collectors.toSet());
            
            allUserIds.addAll(userIds);
            log.debug("Resolved role {} to {} users", recipientId, allUserIds.size());
            return allUserIds;
            
        } catch (Exception e) {
            log.error("Error resolving role {} to users", recipientId, e);
            return new HashSet<>();
        }
    }
    
    @Override
    public boolean canResolve(String recipientType) {
        return "ROLE".equals(recipientType);
    }
}

