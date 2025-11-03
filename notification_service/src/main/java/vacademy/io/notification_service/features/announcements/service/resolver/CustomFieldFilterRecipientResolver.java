package vacademy.io.notification_service.features.announcements.service.resolver;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.type.TypeFactory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.notification_service.features.announcements.client.AdminCoreServiceClient;
import vacademy.io.notification_service.features.announcements.dto.CreateAnnouncementRequest;
import vacademy.io.notification_service.features.announcements.entity.AnnouncementRecipient;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Resolves CUSTOM_FIELD_FILTER type recipients with pagination support
 * Handles large filtered datasets (0.15M+ users) by fetching in batches
 * Works for both inclusions and exclusions
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CustomFieldFilterRecipientResolver implements RecipientResolver {
    
    private final AdminCoreServiceClient adminCoreServiceClient;
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    /**
     * Resolve custom field filter recipient
     * @param recipientId Not used for CUSTOM_FIELD_FILTER - filters are in recipient metadata
     * @param instituteId Required for filtering
     * @return Set of user IDs matching the filters
     */
    @Override
    public Set<String> resolve(String recipientId, String instituteId) {
        // This method signature doesn't work well for CUSTOM_FIELD_FILTER
        // We need the actual recipient entity to extract filters
        // This is handled separately in RecipientResolutionService
        log.warn("CustomFieldFilterRecipientResolver.resolve() called without recipient entity - this shouldn't happen");
        return new HashSet<>();
    }
    
    /**
     * Resolve from recipient entity (includes filter metadata)
     */
    public Set<String> resolveFromRecipient(AnnouncementRecipient recipient, String instituteId) {
        log.debug("Resolving CUSTOM_FIELD_FILTER recipient for institute: {}", instituteId);
        
        if (instituteId == null || instituteId.isBlank()) {
            log.warn("Institute ID unavailable while resolving CUSTOM_FIELD_FILTER recipient; skipping");
            return new HashSet<>();
        }
        
        try {
            // Extract filters from recipientName (stored as JSON)
            String filtersJson = recipient.getRecipientName();
            log.debug("Filters JSON from recipient: {}", filtersJson);
            
            if (filtersJson == null || filtersJson.isBlank() || "ERROR".equals(filtersJson)) {
                log.warn("CUSTOM_FIELD_FILTER recipient has no filters stored (filtersJson: {})", filtersJson);
                return new HashSet<>();
            }
            
            TypeFactory typeFactory = objectMapper.getTypeFactory();
            List<CreateAnnouncementRequest.RecipientRequest.CustomFieldFilter> filters = 
                objectMapper.readValue(filtersJson, 
                    typeFactory.constructCollectionType(List.class, 
                        CreateAnnouncementRequest.RecipientRequest.CustomFieldFilter.class));
            
            log.debug("Deserialized {} filters for institute {}", filters.size(), instituteId);
            
            // Call admin-core-service to get users by custom field filters (with pagination)
            log.debug("Calling admin-core-service to get users by custom field filters...");
            List<String> filterUserIds = adminCoreServiceClient.getUsersByCustomFieldFilters(
                    instituteId, 
                    filters,
                    null // statuses - could be passed if needed
            );
            
            Set<String> userIdSet = new HashSet<>(filterUserIds);
            log.info("Resolved CUSTOM_FIELD_FILTER to {} users for institute {}", userIdSet.size(), instituteId);
            return userIdSet;
            
        } catch (Exception e) {
            log.error("Error resolving CUSTOM_FIELD_FILTER recipient for institute {}", instituteId, e);
            return new HashSet<>();
        }
    }
    
    @Override
    public boolean canResolve(String recipientType) {
        return "CUSTOM_FIELD_FILTER".equals(recipientType);
    }
}

