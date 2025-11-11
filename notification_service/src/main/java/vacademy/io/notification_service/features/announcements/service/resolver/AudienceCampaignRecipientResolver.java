package vacademy.io.notification_service.features.announcements.service.resolver;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.notification_service.features.announcements.client.AdminCoreServiceClient;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Resolves AUDIENCE type recipients (campaign-based)
 * Fetches converted users from audience_response (leads that became users)
 * Works seamlessly with include/exclude logic
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AudienceCampaignRecipientResolver implements RecipientResolver {
    
    private final AdminCoreServiceClient adminCoreServiceClient;
    
    /**
     * Resolve AUDIENCE recipient to user IDs
     * 
     * @param audienceId Campaign/audience ID (recipientId from request)
     * @param instituteId Institute ID for security validation
     * @return Set of user IDs who were converted from this campaign
     */
    @Override
    public Set<String> resolve(String audienceId, String instituteId) {
        log.debug("Resolving AUDIENCE campaign: {} for institute: {}", audienceId, instituteId);
        
        if (instituteId == null || instituteId.isBlank()) {
            log.warn("Institute ID unavailable for audience resolution (audienceId: {}).", audienceId);
            return new HashSet<>();
        }
        
        if (audienceId == null || audienceId.isBlank()) {
            log.warn("Audience ID is missing for AUDIENCE recipient type");
            return new HashSet<>();
        }
        
        try {
            // Get converted users from admin-core-service
            List<String> userIds = adminCoreServiceClient.getConvertedUsersByCampaign(audienceId, instituteId);
            Set<String> userIdSet = new HashSet<>(userIds);
            
            log.info("Resolved AUDIENCE campaign {} to {} converted users for institute {}", 
                    audienceId, userIdSet.size(), instituteId);
            return userIdSet;
            
        } catch (Exception e) {
            log.error("Error resolving AUDIENCE campaign {} to users for institute {}", 
                    audienceId, instituteId, e);
            return new HashSet<>();
        }
    }
    
    @Override
    public boolean canResolve(String recipientType) {
        return "AUDIENCE".equals(recipientType);
    }
}

