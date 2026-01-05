package vacademy.io.auth_service.feature.user_resolution.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.auth.repository.UserRoleRepository;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserResolutionService {

    private final UserRoleRepository userRoleRepository;
    private final UserRepository userRepository;

    /**
     * Get users by institute and role - with caching for performance
     */
    @Cacheable(value = "usersByRole", key = "#instituteId + '_' + #roleName")
    @Transactional(readOnly = true)
    public List<User> getUsersByInstituteAndRole(String instituteId, String roleName) {
        log.debug("Resolving users for institute: {} and role: {}", instituteId, roleName);
        
        try {
            List<User> users = userRoleRepository.findUsersByInstituteIdAndRoleName(instituteId, roleName);
            log.debug("Found {} users with role: {} in institute: {}", users.size(), roleName, instituteId);
            return users;
            
        } catch (Exception e) {
            log.error("Error getting users by institute and role", e);
            throw new RuntimeException("Failed to get users by role: " + e.getMessage(), e);
        }
    }

    /**
     * Get users by list of IDs - with caching for contact information
     * Users are sanitized before caching to avoid circular reference serialization errors
     * (User -> UserRole -> User). Only essential fields are cached.
     */
    @Cacheable(value = "usersById", key = "#userIds.hashCode()")
    @Transactional(readOnly = true)
    public List<User> getUsersByIds(List<String> userIds) {
        log.debug("Resolving {} users by IDs", userIds.size());
        
        if (userIds == null || userIds.isEmpty()) {
            return List.of();
        }
        
        try {
            List<User> users = userRepository.findByIdIn(userIds);
            log.debug("Found {} users out of {} requested IDs", users.size(), userIds.size());
            
            if (users.size() < userIds.size()) {
                log.warn("Some user IDs were not found. Requested: {}, Found: {}", userIds.size(), users.size());
            }
            
            // Sanitize users before caching to avoid circular reference issues
            // This removes the roles collection which causes circular references
            List<User> sanitized = users.stream().map(this::sanitizeUser).toList();
            
            return sanitized;
            
        } catch (Exception e) {
            log.error("Error getting users by IDs", e);
            throw new RuntimeException("Failed to get users by IDs: " + e.getMessage(), e);
        }
    }
    
    /**
     * Sanitize User object by creating a shallow copy without circular references
     * This prevents serialization errors when caching to Redis
     */
    private User sanitizeUser(User user) {
        if (user == null) {
            return null;
        }
        
        User sanitized = new User();
        try {
            sanitized.setId(user.getId());
            sanitized.setEmail(user.getEmail());
            sanitized.setMobileNumber(user.getMobileNumber());
            sanitized.setFullName(user.getFullName());
            sanitized.setUsername(user.getUsername());
            // Explicitly do NOT set roles to avoid circular references
            // The roles field is not needed for contact information (email/phone)
        } catch (Exception e) {
            log.warn("Error sanitizing user {}: {}", user.getId(), e.getMessage());
            // Return minimal user with just ID if sanitization fails
            User minimal = new User();
            minimal.setId(user.getId());
            minimal.setEmail(user.getEmail());
            return minimal;
        }
        
        return sanitized;
    }
}