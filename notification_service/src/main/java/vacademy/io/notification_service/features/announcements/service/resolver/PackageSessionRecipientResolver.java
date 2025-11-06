package vacademy.io.notification_service.features.announcements.service.resolver;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.notification_service.features.announcements.client.AdminCoreServiceClient;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Resolves PACKAGE_SESSION type recipients with pagination support
 * Handles large datasets by fetching students and faculty in batches
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PackageSessionRecipientResolver implements RecipientResolver {
    
    private final AdminCoreServiceClient adminCoreServiceClient;
    
    @Override
    public Set<String> resolve(String packageSessionId, String instituteId) {
        log.debug("Resolving package session: {} to users", packageSessionId);
        
        try {
            Set<String> userIds = new HashSet<>();
            
            // Get students enrolled in the package session (with pagination support)
            List<String> studentIds = adminCoreServiceClient.getStudentsByPackageSessions(List.of(packageSessionId));
            userIds.addAll(studentIds);
            log.debug("Found {} students for package session: {}", studentIds.size(), packageSessionId);
            
            // Get faculty assigned to the package session (with pagination support)
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
    
    @Override
    public boolean canResolve(String recipientType) {
        return "PACKAGE_SESSION".equals(recipientType);
    }
}

