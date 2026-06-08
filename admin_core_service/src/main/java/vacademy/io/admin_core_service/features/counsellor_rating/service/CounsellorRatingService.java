package vacademy.io.admin_core_service.features.counsellor_rating.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.counsellor_rating.dto.LeaderboardEntryDTO;
import vacademy.io.admin_core_service.features.counsellor_rating.dto.RatingDTO;
import vacademy.io.admin_core_service.features.counsellor_rating.enums.RatingStrategyType;
import vacademy.io.admin_core_service.features.counsellor_workbench.service.CounsellorScopeService;
import vacademy.io.admin_core_service.features.counsellor_workbench.service.LeadWorkbenchSettingService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Reads + manual-override writes for counsellor ratings. Both the strategy
 * config and the per-counsellor cached scores live inside the
 * institute_setting JSON via {@link LeadWorkbenchSettingService} — there is
 * no separate rating table. Default zero entries are layered on top for
 * unrated counsellors so badges always render with a valid score.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CounsellorRatingService {

    private final CounsellorRatingComputeService computeService;
    private final CounsellorScopeService scopeService;
    private final LeadWorkbenchSettingService settingService;
    private final AuthService authService;

    // ────────────────────────────────────────────────────────────────
    // Single + batch reads
    // ────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public RatingDTO getRating(String instituteId, String counsellorUserId) {
        return settingService.getCounsellorRating(instituteId, counsellorUserId)
                .orElseGet(() -> defaultRating(instituteId, counsellorUserId));
    }

    @Transactional(readOnly = true)
    public Map<String, RatingDTO> getRatingsBatch(String instituteId, Collection<String> counsellorUserIds) {
        if (counsellorUserIds == null || counsellorUserIds.isEmpty()) return Collections.emptyMap();
        Map<String, RatingDTO> stored = settingService.getCounsellorRatingsBatch(instituteId, counsellorUserIds);
        Map<String, RatingDTO> out = new HashMap<>(stored);
        // Default zeros for unrated counsellors so the badge can render
        // without an "unknown" state.
        for (String id : counsellorUserIds) {
            out.putIfAbsent(id, defaultRating(instituteId, id));
        }
        return out;
    }

    // ────────────────────────────────────────────────────────────────
    // Leaderboard
    // ────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<LeaderboardEntryDTO> leaderboard(String instituteId, String teamId, int limit) {
        Map<String, RatingDTO> all = settingService.getAllCounsellorRatings(instituteId);
        if (all.isEmpty()) return Collections.emptyList();

        Collection<String> userScope = null;
        if (teamId != null && !teamId.isBlank()) {
            List<String> teamIds = scopeService.allTeamIdsUnderLeadsRoot(instituteId);
            userScope = new HashSet<>(scopeService.usersInTeams(teamIds));
        }
        final Collection<String> scope = userScope;

        // Sort in-memory: settings JSON has no index so we hold the whole
        // map per institute. Fine while counsellor counts are <500 per
        // institute — switch to a proper table if that ever changes.
        List<RatingDTO> sorted = all.values().stream()
                .filter(r -> scope == null || scope.contains(r.getCounsellorUserId()))
                .filter(r -> r.getScore() != null)
                .sorted(Comparator.comparing(RatingDTO::getScore, Comparator.reverseOrder()))
                .toList();

        int n = Math.min(limit > 0 ? limit : 10, sorted.size());
        List<RatingDTO> top = sorted.subList(0, n);

        Set<String> ids = top.stream()
                .map(RatingDTO::getCounsellorUserId).collect(Collectors.toSet());
        Map<String, String> nameById = new HashMap<>();
        try {
            for (UserDTO u : authService.getUsersFromAuthServiceByUserIds(new ArrayList<>(ids))) {
                if (u != null) nameById.put(u.getId(), u.getFullName());
            }
        } catch (Exception e) {
            log.warn("Leaderboard name lookup failed: {}", e.getMessage());
        }

        List<LeaderboardEntryDTO> out = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            RatingDTO r = top.get(i);
            out.add(LeaderboardEntryDTO.builder()
                    .rank(i + 1)
                    .counsellorUserId(r.getCounsellorUserId())
                    .fullName(nameById.get(r.getCounsellorUserId()))
                    .score(r.getScore())
                    .conversionRatioScore(r.getConversionRatioScore())
                    .velocityScore(r.getVelocityScore())
                    .sampleSize(r.getSampleSize())
                    .strategyType(r.getStrategyType())
                    .build());
        }
        return out;
    }

    // ────────────────────────────────────────────────────────────────
    // Manual override (STATIC strategy)
    // ────────────────────────────────────────────────────────────────

    @Transactional
    public RatingDTO setManualOverride(String instituteId, String counsellorUserId, BigDecimal score) {
        if (score == null) throw new VacademyException("score is required");
        if (score.compareTo(BigDecimal.ZERO) < 0 || score.compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new VacademyException("score must be between 0 and 100");
        }
        RatingDTO r = settingService.getCounsellorRating(instituteId, counsellorUserId)
                .orElseGet(() -> RatingDTO.builder()
                        .counsellorUserId(counsellorUserId)
                        .instituteId(instituteId)
                        .strategyType(RatingStrategyType.STATIC.name())
                        .score(BigDecimal.ZERO)
                        .build());
        r.setManualOverride(score);
        // Manual override always wins for STATIC strategies; if the institute
        // is on STRATEGY_BASED, the override is remembered but doesn't
        // influence the live score until they switch back.
        String strategy = settingService.get(instituteId).getStrategyType();
        if (strategy == null || RatingStrategyType.STATIC.name().equals(strategy)) {
            r.setStrategyType(RatingStrategyType.STATIC.name());
            r.setScore(score);
            r.setConversionRatioScore(null);
            r.setVelocityScore(null);
        }
        r.setLastComputedAt(new Timestamp(System.currentTimeMillis()));
        return settingService.upsertCounsellorRating(instituteId, counsellorUserId, r);
    }

    // ────────────────────────────────────────────────────────────────
    // Recompute trigger
    // ────────────────────────────────────────────────────────────────

    @Transactional
    public RatingDTO recomputeOne(String instituteId, String counsellorUserId) {
        return computeService.recompute(instituteId, counsellorUserId);
    }

    @Transactional
    public int recomputeAll(String instituteId) {
        return computeService.recomputeAll(instituteId);
    }

    // ────────────────────────────────────────────────────────────────

    private RatingDTO defaultRating(String instituteId, String counsellorUserId) {
        return RatingDTO.builder()
                .counsellorUserId(counsellorUserId)
                .instituteId(instituteId)
                .strategyType(RatingStrategyType.STRATEGY_BASED.name())
                .score(BigDecimal.ZERO)
                .sampleSize(0)
                .build();
    }
}
