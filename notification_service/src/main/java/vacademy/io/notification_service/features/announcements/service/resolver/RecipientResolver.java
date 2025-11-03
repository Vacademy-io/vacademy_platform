package vacademy.io.notification_service.features.announcements.service.resolver;

import java.util.Set;

/**
 * Interface for resolving recipients to user IDs
 * Follows SOLID principles: Interface Segregation and Dependency Inversion
 */
public interface RecipientResolver {
    
    /**
     * Resolve recipient to user IDs
     * @param recipientId The recipient identifier
     * @param instituteId The institute ID (may be null for some recipient types)
     * @return Set of user IDs matching the recipient
     */
    Set<String> resolve(String recipientId, String instituteId);
    
    /**
     * Check if this resolver can handle the given recipient type
     */
    boolean canResolve(String recipientType);
}

