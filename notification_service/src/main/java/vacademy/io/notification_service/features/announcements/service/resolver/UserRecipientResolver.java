package vacademy.io.notification_service.features.announcements.service.resolver;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.notification_service.features.announcements.client.AuthServiceClient;
import vacademy.io.common.auth.entity.User;

import java.util.HashSet;
import java.util.Set;

/**
 * Resolves USER type recipients
 * Handles both user IDs and email addresses
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class UserRecipientResolver implements RecipientResolver {
    
    private final AuthServiceClient authServiceClient;
    
    @Override
    public Set<String> resolve(String recipientId, String instituteId) {
        Set<String> userIds = new HashSet<>();
        
        // Check if it's an email address or user ID
        if (recipientId.contains("@")) {
            // Resolve email to user ID
            User user = authServiceClient.getUserByEmail(recipientId);
            if (user != null) {
                userIds.add(user.getId());
                log.debug("Resolved email {} to user ID: {}", recipientId, user.getId());
            } else {
                log.warn("Could not resolve email to user ID: {}", recipientId);
            }
        } else {
            // It's already a user ID
            userIds.add(recipientId);
            log.debug("Added direct user ID: {}", recipientId);
        }
        
        return userIds;
    }
    
    @Override
    public boolean canResolve(String recipientType) {
        return "USER".equals(recipientType);
    }
}

