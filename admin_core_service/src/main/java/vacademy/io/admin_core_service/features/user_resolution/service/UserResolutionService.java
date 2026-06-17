package vacademy.io.admin_core_service.features.user_resolution.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;
import vacademy.io.admin_core_service.features.faculty.repository.FacultySubjectPackageSessionMappingRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserResolutionService {

    private static final List<String> LIVE_BATCH_STATUSES = List.of("ACTIVE", "HIDDEN");

    private final FacultySubjectPackageSessionMappingRepository facultyRepository;
    private final StudentSessionRepository studentRepository;
    private final PackageSessionRepository packageSessionRepository;

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

    /**
     * Resolve a human-readable display name for each package session (batch). The name mirrors the
     * platform's batch-list convention ("{Level} {Course}"), skipping a blank/DEFAULT level so a
     * level-less course just shows the course name. Used by notification-service to title batch-group
     * chats. Returns packageSessionId -> display name; ids with no resolvable name are simply absent.
     */
    @Cacheable(value = "batchNamesByPackageSessions", key = "#packageSessionIds.hashCode()")
    @Transactional(readOnly = true)
    public Map<String, String> getBatchNamesByPackageSessions(List<String> packageSessionIds) {
        if (packageSessionIds == null || packageSessionIds.isEmpty()) {
            return Map.of();
        }
        try {
            Map<String, String> names = new HashMap<>();
            for (PackageSessionRepository.BatchNameProjection p :
                    packageSessionRepository.findBatchNameComponentsByIds(packageSessionIds)) {
                String name = composeBatchName(p.getPackageName(), p.getLevelId(), p.getLevelName());
                if (!name.isEmpty()) {
                    names.put(p.getPackageSessionId(), name);
                }
            }
            log.debug("Resolved {} batch names across {} package sessions", names.size(), packageSessionIds.size());
            return names;
        } catch (Exception e) {
            log.error("Error getting batch names by package sessions", e);
            return Map.of();
        }
    }

    /**
     * Forward faculty mapping: the package-session (batch) ids this faculty user is mapped to within
     * the institute. Used to scope a teacher's chat batch list/search to their batches.
     */
    @Transactional(readOnly = true)
    public List<String> getFacultyPackageSessions(String userId, String instituteId) {
        if (userId == null || userId.isBlank() || instituteId == null || instituteId.isBlank()) {
            return List.of();
        }
        try {
            return facultyRepository.findAccessIdsByUserIdAndInstituteId(userId, instituteId, List.of("ACTIVE"));
        } catch (Exception e) {
            log.error("Error resolving faculty package sessions for user {} institute {}", userId, instituteId, e);
            return List.of();
        }
    }

    /**
     * Search an institute's live batches by name -> [{packageSessionId, name}]. Pass packageSessionIds
     * to limit to a teacher's mapped batches (null/empty = all institute batches). Powers the chat
     * "start a new batch conversation" picker.
     */
    @Transactional(readOnly = true)
    public List<Map<String, String>> searchBatches(String instituteId, String nameQuery,
                                                   List<String> packageSessionIds, Integer limit) {
        if (instituteId == null || instituteId.isBlank()) {
            return List.of();
        }
        // An id-scope was requested but resolved to nothing (e.g. a teacher with no mappings): return
        // empty rather than falling through to "all institute batches".
        if (packageSessionIds != null && packageSessionIds.isEmpty()) {
            return List.of();
        }
        try {
            String q = (nameQuery == null || nameQuery.isBlank()) ? null : nameQuery.trim();
            int size = (limit == null || limit <= 0) ? 30 : Math.min(limit, 100);
            PageRequest page = PageRequest.of(0, size);
            List<PackageSessionRepository.BatchNameProjection> rows = (packageSessionIds == null)
                    ? packageSessionRepository.searchBatchNameComponents(instituteId, q, LIVE_BATCH_STATUSES, page)
                    : packageSessionRepository.searchBatchNameComponentsScoped(
                            instituteId, q, packageSessionIds, LIVE_BATCH_STATUSES, page);
            List<Map<String, String>> out = new ArrayList<>();
            for (PackageSessionRepository.BatchNameProjection p : rows) {
                String name = composeBatchName(p.getPackageName(), p.getLevelId(), p.getLevelName());
                if (!name.isEmpty()) {
                    Map<String, String> m = new HashMap<>();
                    m.put("packageSessionId", p.getPackageSessionId());
                    m.put("name", name);
                    out.add(m);
                }
            }
            return out;
        } catch (Exception e) {
            log.error("Error searching batches for institute {}", instituteId, e);
            return List.of();
        }
    }

    /** "{Level} {Course}", dropping a blank or sentinel DEFAULT level (detected by id, then name). */
    private String composeBatchName(String packageName, String levelId, String levelName) {
        String pkg = packageName == null ? "" : packageName.trim();
        String level = levelName == null ? "" : levelName.trim();
        boolean isDefaultLevel = "DEFAULT".equalsIgnoreCase(levelId) || "DEFAULT".equalsIgnoreCase(level);
        boolean levelMeaningful = !level.isEmpty() && !isDefaultLevel;
        if (pkg.isEmpty()) {
            return levelMeaningful ? level : "";
        }
        if (!levelMeaningful) {
            return pkg;
        }
        // Avoid duplication like "Summer Sprint Summer Sprint 2.0 …" when the course name already
        // leads with the level name — just use the course name in that case.
        if (pkg.toLowerCase().startsWith(level.toLowerCase())) {
            return pkg;
        }
        return level + " " + pkg;
    }
}