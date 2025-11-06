package vacademy.io.notification_service.features.announcements.service.resolver;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.notification_service.features.announcements.client.AdminCoreServiceClient;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Resolves TAG type recipients with pagination support
 * Handles large tag populations (0.15M+ users) by fetching in batches
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TagRecipientResolver implements RecipientResolver {
    
    private final AdminCoreServiceClient adminCoreServiceClient;
    
    @Override
    public Set<String> resolve(String tagId, String instituteId) {
        log.debug("Resolving tag: {} to users for institute: {}", tagId, instituteId);
        
        if (instituteId == null || instituteId.isBlank()) {
            log.warn("Institute ID unavailable for tag resolution (tagId: {}).", tagId);
            return new HashSet<>();
        }
        
        try {
            // Get users by tag with pagination support
            List<String> userIds = adminCoreServiceClient.getUsersByTags(instituteId, List.of(tagId));
            Set<String> userIdSet = new HashSet<>(userIds);
            
            log.debug("Resolved tag {} to {} users", tagId, userIdSet.size());
            return userIdSet;
            
        } catch (Exception e) {
            log.error("Error resolving tag {} to users for institute {}", tagId, instituteId, e);
            return new HashSet<>();
        }
    }
    
    @Override
    public boolean canResolve(String recipientType) {
        return "TAG".equals(recipientType);
    }
}

