package vacademy.io.admin_core_service.features.audience.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.audience.dto.CounsellorAllocationSettingDTO;
import vacademy.io.admin_core_service.features.audience.entity.LeadAssignmentCounter;
import vacademy.io.admin_core_service.features.audience.repository.LeadAssignmentCounterRepository;
import vacademy.io.admin_core_service.features.enquiry.repository.LinkedUsersRepository;

import java.util.*;

/**
 * Intelligent lead distribution engine that replaces the old selectRandomCounselor().
 * Supports 5 strategies:
 * - RANDOM: Original behavior (backward compatible)
 * - ROUND_ROBIN: Strict rotation using persistent counter
 * - WEIGHTED_ROUND_ROBIN: Weighted rotation using counsellorWeights map
 * - PERFORMANCE_BASED: Routes to highest converter (configurable metric)
 * - LEAST_LOADED: Routes to counselor with fewest active leads
 */
@Service
public class LeadDistributionService {

    private static final Logger logger = LoggerFactory.getLogger(LeadDistributionService.class);

    @Autowired
    private LeadAssignmentCounterRepository counterRepository;

    @Autowired
    private LinkedUsersRepository linkedUsersRepository;

    /**
     * Select the best counselor based on the configured strategy.
     *
     * @param settings   Counselor allocation settings from audience or institute config
     * @param scopeType  "AUDIENCE" or "INSTITUTE" — determines counter scope
     * @param scopeId    The audience_id or institute_id
     * @param instituteId The institute ID (for cross-scope queries)
     * @return The selected counselor's user ID, or null if none available
     */
    @Transactional
    public String selectCounselor(CounsellorAllocationSettingDTO settings,
                                   String scopeType, String scopeId,
                                   String instituteId) {
        if (settings == null || settings.getCounsellorIds() == null
                || settings.getCounsellorIds().isEmpty()) {
            logger.warn("No counselor pool configured for scope {}:{}", scopeType, scopeId);
            return null;
        }

        List<String> pool = settings.getCounsellorIds();
        String strategy = settings.getAssignmentStrategy();
        if (strategy == null || strategy.isBlank()) {
            strategy = "RANDOM"; // backward compatible default
        }

        logger.info("Selecting counselor using strategy={} for scope {}:{}, pool size={}",
                strategy, scopeType, scopeId, pool.size());

        String selected = switch (strategy.toUpperCase()) {
            case "ROUND_ROBIN" -> roundRobin(pool, scopeType, scopeId);
            case "WEIGHTED_ROUND_ROBIN" -> weightedRoundRobin(settings, scopeType, scopeId);
            case "PERFORMANCE_BASED" -> performanceBased(pool, instituteId);
            case "LEAST_LOADED" -> leastLoaded(pool);
            default -> randomPick(pool);
        };

        // Apply max active leads cap if configured
        if (selected != null && settings.getMaxActiveLeadsPerCounselor() != null
                && settings.getMaxActiveLeadsPerCounselor() > 0) {
            long activeCount = countActiveLeads(selected);
            if (activeCount >= settings.getMaxActiveLeadsPerCounselor()) {
                logger.warn("Counselor {} has {} active leads (cap={}), trying next",
                        selected, activeCount, settings.getMaxActiveLeadsPerCounselor());
                // Find next available counselor in pool who is under the cap
                selected = findUnderCapCounselor(pool, settings.getMaxActiveLeadsPerCounselor(), selected);
            }
        }

        logger.info("Selected counselor: {} using strategy: {}", selected, strategy);
        return selected;
    }

    /**
     * RANDOM: Simple random pick from pool (original behavior).
     */
    private String randomPick(List<String> pool) {
        Random random = new Random();
        return pool.get(random.nextInt(pool.size()));
    }

    /**
     * ROUND_ROBIN: Strict rotation using persistent counter.
     * Uses atomic upsert to prevent race conditions.
     */
    private String roundRobin(List<String> pool, String scopeType, String scopeId) {
        // Atomically increment the counter
        counterRepository.incrementCounter(scopeType, scopeId);

        // Read the current value
        Optional<LeadAssignmentCounter> counterOpt = counterRepository.findByScopeTypeAndScopeId(scopeType, scopeId);
        if (counterOpt.isEmpty()) {
            logger.warn("Counter not found after increment for {}:{}, falling back to random", scopeType, scopeId);
            return randomPick(pool);
        }

        int index = counterOpt.get().getLastIndex() % pool.size();
        return pool.get(index);
    }

    /**
     * WEIGHTED_ROUND_ROBIN: Expand pool by weights, then round-robin.
     * Example: weights = {A: 3, B: 2} → expanded pool = [A, A, A, B, B]
     */
    private String weightedRoundRobin(CounsellorAllocationSettingDTO settings,
                                       String scopeType, String scopeId) {
        List<String> expandedPool = buildWeightedPool(settings);
        if (expandedPool.isEmpty()) {
            logger.warn("Weighted pool is empty, falling back to random from original pool");
            return randomPick(settings.getCounsellorIds());
        }
        return roundRobin(expandedPool, scopeType, scopeId);
    }

    /**
     * PERFORMANCE_BASED: Route to the counselor with highest conversion rate.
     * Conversion = enquiries where status moved beyond initial.
     */
    private String performanceBased(List<String> pool, String instituteId) {
        if (pool.size() == 1) return pool.get(0);

        // Build assignment counts map for performance proxy
        Map<String, Long> assignmentCounts = new HashMap<>();
        for (String counselorId : pool) {
            assignmentCounts.put(counselorId, countActiveLeads(counselorId));
        }

        // For bootstrapping (< 10 assignments each), fall back to round-robin-like behavior
        boolean allLowData = assignmentCounts.values().stream().allMatch(c -> c < 10);
        if (allLowData) {
            logger.info("Performance data insufficient (< 10 assignments each), using least_loaded instead");
            return leastLoaded(pool);
        }

        // Pick the counselor with the highest count (most experienced = highest converter assumption)
        // TODO: Replace with actual conversion rate query when conversion tracking is mature
        return assignmentCounts.entrySet().stream()
                .max(Comparator.comparingLong(Map.Entry::getValue))
                .map(Map.Entry::getKey)
                .orElse(randomPick(pool));
    }

    /**
     * LEAST_LOADED: Route to the counselor with fewest active leads.
     */
    private String leastLoaded(List<String> pool) {
        if (pool.size() == 1) return pool.get(0);

        Map<String, Long> loadMap = new HashMap<>();
        for (String counselorId : pool) {
            loadMap.put(counselorId, countActiveLeads(counselorId));
        }

        logger.debug("Counselor load map: {}", loadMap);

        return loadMap.entrySet().stream()
                .min(Comparator.comparingLong(Map.Entry::getValue))
                .map(Map.Entry::getKey)
                .orElse(randomPick(pool));
    }

    /**
     * Count active leads assigned to a counselor via LinkedUsers.
     */
    private long countActiveLeads(String counselorId) {
        return linkedUsersRepository.countBySourceAndUserId("ENQUIRY", counselorId);
    }

    /**
     * Find a counselor in the pool who is under the max active leads cap.
     */
    private String findUnderCapCounselor(List<String> pool, int maxActive, String excludeId) {
        for (String counselorId : pool) {
            if (counselorId.equals(excludeId)) continue;
            long count = countActiveLeads(counselorId);
            if (count < maxActive) {
                logger.info("Found under-cap counselor: {} (active={})", counselorId, count);
                return counselorId;
            }
        }
        // All at cap — assign anyway to the least loaded
        logger.warn("All counselors at or above cap ({}), assigning to least loaded", maxActive);
        return leastLoaded(pool);
    }

    /**
     * Build an expanded pool based on weights.
     * Example: ids=[A,B], weights={A:3, B:2} → [A, A, A, B, B]
     */
    private List<String> buildWeightedPool(CounsellorAllocationSettingDTO settings) {
        List<String> expanded = new ArrayList<>();
        Map<String, Integer> weights = settings.getCounsellorWeights();

        if (weights == null || weights.isEmpty()) {
            // No weights configured — treat all as equal weight (same as ROUND_ROBIN)
            return new ArrayList<>(settings.getCounsellorIds());
        }

        for (String counselorId : settings.getCounsellorIds()) {
            int weight = weights.getOrDefault(counselorId, 1);
            for (int i = 0; i < weight; i++) {
                expanded.add(counselorId);
            }
        }

        return expanded;
    }
}
