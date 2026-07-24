package vacademy.io.admin_core_service.features.leaderboard.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.leaderboard.dto.BadgeStatDTO;
import vacademy.io.admin_core_service.features.leaderboard.dto.BadgeStatsResponseDTO;
import vacademy.io.admin_core_service.features.leaderboard.dto.LeaderboardBadgeDTO;
import vacademy.io.admin_core_service.features.leaderboard.dto.LeaderboardEntryDTO;
import vacademy.io.admin_core_service.features.leaderboard.dto.LeaderboardResponseDTO;
import vacademy.io.admin_core_service.features.leaderboard.dto.LearnerSummaryDTO;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.learner_badge.repository.LearnerBadgeRepository;
import vacademy.io.admin_core_service.features.learner_reports.dto.LearnerActivityDataProjection;
import vacademy.io.admin_core_service.features.learner_reports.dto.ReportFilterDTO;
import vacademy.io.admin_core_service.features.learner_reports.service.BatchReportService;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.dto.settings.InstituteSettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.SettingDto;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.admin_core_service.features.session.dto.BatchInstituteProjection;
import vacademy.io.common.auth.model.CustomUserDetails;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Builds a course/batch leaderboard by combining the existing activity-rank report
 * (engagement minutes, via {@link BatchReportService}) with each learner's awarded-badge
 * count. Exposes a learner-facing ANONYMIZED view (initials only, own row marked) and a
 * named admin view, plus institute-wide badge stats.
 */
@Service
@RequiredArgsConstructor
public class LeaderboardService {

    private static final int MAX_BADGES_PER_ENTRY = 6;
    private static final int MAX_BATCHES_FOR_RANK = 5;

    private final BatchReportService batchReportService;
    private final LearnerBadgeRepository learnerBadgeRepository;
    private final StudentSessionInstituteGroupMappingRepository ssigmRepository;
    private final PackageSessionRepository packageSessionRepository;
    private final InstituteRepository instituteRepository;
    private final ObjectMapper objectMapper;

    /**
     * Public, fully-anonymized course leaderboard for the shareable page (no auth).
     * Gated behind the institute's master badges/leaderboard toggle; adds the course name.
     */
    public LeaderboardResponseDTO buildPublicCourseLeaderboard(String packageSessionId, String instituteIdHint) {
        // Derive the institute from the batch so the public page works on ANY domain
        // (generic learner.vacademy.io included), not only the institute's white-label domain.
        BatchInstituteProjection ctx = packageSessionRepository
                .findBatchAndInstituteByPackageSessionId(packageSessionId).orElse(null);
        String instituteId = (ctx != null && ctx.getInstituteId() != null)
                ? ctx.getInstituteId() : instituteIdHint;
        if (instituteId == null || !isLeaderboardEnabled(instituteId)) {
            return new LeaderboardResponseDTO(0, List.of(), null, null, null, null, null, true);
        }
        boolean anonymize = !isPublicFullNames(instituteId);
        LeaderboardResponseDTO dto =
                buildCourseLeaderboard(packageSessionId, instituteId, null, anonymize, 50, null);
        if (ctx != null) {
            dto.setCourseName(ctx.getBatchName());
            dto.setInstituteName(ctx.getInstituteName());
            dto.setInstituteLogoFileId(ctx.getInstituteLogoFileId());
            dto.setInstituteThemeCode(ctx.getInstituteThemeCode());
        }
        return dto;
    }

    /** The institute's BADGES_REWARDS_SETTING data map, or null if unset/unparseable. */
    private Map<?, ?> badgesSettingData(String instituteId) {
        try {
            Institute institute = instituteRepository.findById(instituteId).orElse(null);
            if (institute == null || institute.getSetting() == null) return null;
            InstituteSettingDto settingDto =
                    objectMapper.readValue(institute.getSetting(), InstituteSettingDto.class);
            Map<String, SettingDto> settings = settingDto.getSetting();
            if (settings == null) return null;
            SettingDto s = settings.get("BADGES_REWARDS_SETTING");
            if (s == null || !(s.getData() instanceof Map)) return null;
            return (Map<?, ?>) s.getData();
        } catch (Exception e) {
            return null;
        }
    }

    /** Master toggle; defaults to OFF (opt-in). */
    private boolean isLeaderboardEnabled(String instituteId) {
        Map<?, ?> data = badgesSettingData(instituteId);
        return data != null && Boolean.TRUE.equals(data.get("enabled"));
    }

    /** Whether the PUBLIC leaderboard shows full names (admin opt-in); defaults to anonymized. */
    private boolean isPublicFullNames(String instituteId) {
        Map<?, ?> data = badgesSettingData(instituteId);
        return data != null && Boolean.TRUE.equals(data.get("publicShowFullNames"));
    }

    /**
     * Whether this institute's leaderboards should show real names (admin opt-in via
     * the "show full names" toggle). Applies to BOTH the public shareable page and the
     * in-app learner view; defaults to anonymized (initials). The caller's own row is
     * always labelled "You" regardless.
     */
    public boolean showFullNames(String instituteId) {
        return isPublicFullNames(instituteId);
    }

    public LeaderboardResponseDTO buildCourseLeaderboard(String packageSessionId, String instituteId,
                                                         String currentUserId, boolean anonymize, int limit,
                                                         CustomUserDetails userDetails) {
        ReportFilterDTO filter = new ReportFilterDTO();
        filter.setPackageSessionId(packageSessionId);
        // All-time window — capture every activity record for this batch.
        filter.setStartDate(Date.valueOf(LocalDate.of(2000, 1, 1)));
        filter.setEndDate(Date.valueOf(LocalDate.now().plusDays(1)));

        List<LearnerActivityDataProjection> rows =
                batchReportService.getBatchActivityDataLeaderBoard(filter, userDetails);
        return buildFromActivityRows(rows, instituteId, currentUserId, anonymize, limit);
    }

    /** Institute-WIDE leaderboard: rank every learner across all their courses combined. */
    public LeaderboardResponseDTO buildInstituteLeaderboard(String instituteId, String currentUserId,
                                                            boolean anonymize, int limit) {
        List<LearnerActivityDataProjection> rows = batchReportService.getInstituteActivityDataLeaderBoard(
                instituteId,
                Date.valueOf(LocalDate.of(2000, 1, 1)),
                Date.valueOf(LocalDate.now().plusDays(1)));
        return buildFromActivityRows(rows, instituteId, currentUserId, anonymize, limit);
    }

    /** Public, fully-anonymized institute-wide leaderboard (no auth); gated by the master toggle. */
    public LeaderboardResponseDTO buildPublicInstituteLeaderboard(String instituteId) {
        if (!isLeaderboardEnabled(instituteId)) {
            return new LeaderboardResponseDTO(0, List.of(), null, null, null, null, null, true);
        }
        boolean anonymize = !isPublicFullNames(instituteId);
        LeaderboardResponseDTO dto = buildInstituteLeaderboard(instituteId, null, anonymize, 50);
        // Institute branding so the public page renders on ANY domain.
        instituteRepository.findById(instituteId).ifPresent(inst -> {
            dto.setInstituteName(inst.getInstituteName());
            dto.setInstituteLogoFileId(inst.getLogoFileId());
            dto.setInstituteThemeCode(inst.getInstituteThemeCode());
        });
        return dto;
    }

    /** Shared: turn ranked activity rows + institute badge counts into a leaderboard DTO. */
    private LeaderboardResponseDTO buildFromActivityRows(List<LearnerActivityDataProjection> rows,
                                                         String instituteId, String currentUserId,
                                                         boolean anonymize, int limit) {
        if (rows == null) rows = List.of();

        List<String> userIds = rows.stream()
                .map(LearnerActivityDataProjection::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        Map<String, Long> badgeCounts = new HashMap<>();
        Map<String, List<LeaderboardBadgeDTO>> badgesByUser = new HashMap<>();
        if (!userIds.isEmpty() && instituteId != null) {
            for (Object[] r : learnerBadgeRepository.findActiveBadgesByUsers(instituteId, userIds)) {
                String uid = (String) r[0];
                badgeCounts.merge(uid, 1L, Long::sum);
                List<LeaderboardBadgeDTO> list = badgesByUser.computeIfAbsent(uid, k -> new ArrayList<>());
                if (list.size() < MAX_BADGES_PER_ENTRY) {
                    list.add(new LeaderboardBadgeDTO((String) r[1], (String) r[2]));
                }
            }
        }

        List<LeaderboardEntryDTO> all = rows.stream()
                .sorted(Comparator.comparingInt(p -> p.getRank() == null ? Integer.MAX_VALUE : p.getRank()))
                .map(p -> {
                    boolean isMe = p.getUserId() != null && p.getUserId().equals(currentUserId);
                    // The caller's own row is always "You"; peers are initials (anonymized) or full names.
                    String displayName;
                    if (isMe) {
                        displayName = "You";
                    } else if (anonymize) {
                        displayName = toInitials(p.getFullName());
                    } else {
                        displayName = p.getFullName();
                    }
                    long points = p.getTotalTime() == null ? 0L : Math.round(p.getTotalTime());
                    // In anonymized mode only the caller's own userId is exposed.
                    String exposedUserId = anonymize ? (isMe ? p.getUserId() : null) : p.getUserId();
                    return new LeaderboardEntryDTO(
                            p.getRank(), exposedUserId, displayName, points,
                            badgeCounts.getOrDefault(p.getUserId(), 0L),
                            badgesByUser.getOrDefault(p.getUserId(), List.of()),
                            isMe);
                })
                .collect(Collectors.toList());

        LeaderboardEntryDTO me = all.stream().filter(LeaderboardEntryDTO::isCurrentUser).findFirst().orElse(null);
        List<LeaderboardEntryDTO> top = all.stream().limit(Math.max(1, limit)).collect(Collectors.toList());

        return new LeaderboardResponseDTO(all.size(), top, me, null, null, null, null, anonymize);
    }

    public BadgeStatsResponseDTO buildBadgeStats(String instituteId) {
        List<BadgeStatDTO> badges = new ArrayList<>();
        long total = 0;
        for (Object[] r : learnerBadgeRepository.getBadgeStats(instituteId)) {
            long count = ((Number) r[3]).longValue();
            badges.add(new BadgeStatDTO((String) r[0], (String) r[1], (String) r[2], count));
            total += count;
        }
        long learners = learnerBadgeRepository.countDistinctLearnersWithActiveBadge(instituteId);
        return new BadgeStatsResponseDTO(total, learners, badges);
    }

    /** The learner's own profile summary: total badges, badge list, and best rank across enrolled courses. */
    public LearnerSummaryDTO buildLearnerSummary(String instituteId, String userId, CustomUserDetails userDetails) {
        List<LeaderboardBadgeDTO> badges = new ArrayList<>();
        long totalBadges = 0;
        for (Object[] r : learnerBadgeRepository.findActiveBadgesByUsers(instituteId, List.of(userId))) {
            totalBadges++;
            if (badges.size() < MAX_BADGES_PER_ENTRY) {
                badges.add(new LeaderboardBadgeDTO((String) r[1], (String) r[2]));
            }
        }

        // Best (lowest) rank across the learner's enrolled batches — capped to bound profile-load cost.
        Integer bestRank = null;
        List<String> packageSessionIds =
                ssigmRepository.findPackageSessionIdsByUserIdAndInstituteId(userId, instituteId);
        int checked = 0;
        for (String psId : packageSessionIds) {
            if (checked >= MAX_BATCHES_FOR_RANK) break;
            checked++;
            ReportFilterDTO filter = new ReportFilterDTO();
            filter.setPackageSessionId(psId);
            filter.setStartDate(Date.valueOf(LocalDate.of(2000, 1, 1)));
            filter.setEndDate(Date.valueOf(LocalDate.now().plusDays(1)));
            List<LearnerActivityDataProjection> rows =
                    batchReportService.getBatchActivityDataLeaderBoard(filter, userDetails);
            if (rows == null) continue;
            for (LearnerActivityDataProjection p : rows) {
                if (userId.equals(p.getUserId()) && p.getRank() != null) {
                    if (bestRank == null || p.getRank() < bestRank) bestRank = p.getRank();
                    break;
                }
            }
        }

        return new LearnerSummaryDTO(totalBadges, bestRank, badges);
    }

    /** "Anna Smith" → "A.S."; single name → first letter; blank → "?". */
    private String toInitials(String fullName) {
        if (fullName == null || fullName.isBlank()) return "?";
        String[] parts = fullName.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < parts.length && i < 2; i++) {
            if (!parts[i].isEmpty()) {
                sb.append(Character.toUpperCase(parts[i].charAt(0)));
                sb.append('.');
            }
        }
        return sb.length() == 0 ? "?" : sb.toString();
    }
}
