package vacademy.io.notification_service.features.announcements.service.resolver;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/**
 * Registry for recipient resolvers
 * Follows SOLID principles: Dependency Inversion (depends on abstractions)
 */
@Component
@RequiredArgsConstructor
public class RecipientResolverRegistry {
    
    private final List<RecipientResolver> resolvers;
    
    /**
     * Get resolver for the given recipient type
     */
    public Optional<RecipientResolver> getResolver(String recipientType) {
        return resolvers.stream()
                .filter(resolver -> resolver.canResolve(recipientType))
                .findFirst();
    }
}

