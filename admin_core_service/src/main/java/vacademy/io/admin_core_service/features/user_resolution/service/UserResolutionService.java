package vacademy.io.admin_core_service.features.user_resolution.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.faculty.repository.FacultySubjectPackageSessionMappingRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserResolutionService {

    private final FacultySubjectPackageSessionMappingRepository facultyRepository;
    private final StudentSessionRepository studentRepository;

    /**
     * Get faculty user IDs for multiple package sessions - with caching
     */
    @Cacheable(value = "facultyByPackageSessions", key = "#packageSessionIds.hashCode()")
    @Transactional(readOnly = true)
    public List<String> getFacultyUserIdsByPackageSessions(List<String> packageSessionIds) {
        log.debug("Resolving faculty for {} package sessions", packageSessionIds.size());
        
        if (packageSessionIds == null || packageSessionIds.isEmpty()) {
            return List.of();
        }
        
        try {
            Set<String> userIds = new HashSet<>(); // Use Set to avoid duplicates
            
            // Get faculty for each package session
            for (String packageSessionId : packageSessionIds) {
                List<String> facultyIds = facultyRepository.findUserIdsByPackageSessionId(
                        packageSessionId, 
                        List.of("ACTIVE") // Active status
                );
                userIds.addAll(facultyIds);
            }
            
            List<String> result = List.copyOf(userIds);
            log.debug("Found {} unique faculty members across {} package sessions", result.size(), packageSessionIds.size());
            return result;
            
        } catch (Exception e) {
            log.error("Error getting faculty by package sessions", e);
            throw new RuntimeException("Failed to get faculty by package sessions: " + e.getMessage(), e);
        }
    }

    /**
     * Get student user IDs for multiple package sessions - with caching
     */
    @Cacheable(value = "studentsByPackageSessions", key = "#packageSessionIds.hashCode()")
    @Transactional(readOnly = true)
    public List<String> getStudentUserIdsByPackageSessions(List<String> packageSessionIds) {
        log.debug("Resolving students for {} package sessions", packageSessionIds.size());

        if (packageSessionIds == null || packageSessionIds.isEmpty()) {
            return List.of();
        }

        try {
            Set<String> userIds = new HashSet<>(); // Use Set to avoid duplicates

            // Get students for each package session
            for (String packageSessionId : packageSessionIds) {
                List<String> studentIds = studentRepository.findDistinctUserIdsByPackageSessionAndStatus(
                        packageSessionId,
                        List.of("ACTIVE") // Active status
                );
                userIds.addAll(studentIds);
            }

            List<String> result = List.copyOf(userIds);
            log.debug("Found {} unique students across {} package sessions", result.size(), packageSessionIds.size());
            return result;

        } catch (Exception e) {
            log.error("Error getting students by package sessions", e);
            throw new RuntimeException("Failed to get students by package sessions: " + e.getMessage(), e);
        }
    }

}