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
            
            return users;
            
        } catch (Exception e) {
            log.error("Error getting users by IDs", e);
            throw new RuntimeException("Failed to get users by IDs: " + e.getMessage(), e);
        }
    }
}