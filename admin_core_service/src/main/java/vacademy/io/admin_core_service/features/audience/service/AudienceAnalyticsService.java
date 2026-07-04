package vacademy.io.admin_core_service.features.audience.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.audience.dto.CenterHeatmapDTO;
import vacademy.io.admin_core_service.features.audience.dto.CenterHeatmapResponseDTO;
import vacademy.io.admin_core_service.features.audience.repository.AudienceRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AudienceAnalyticsService {

    private final AudienceRepository audienceRepository;
    private final LeadReportSettingService leadReportSettingService;

    /**
     * Get center interaction heatmap showing audience campaign engagement
     * 
     * @param instituteId Institute ID
     * @param startDate Optional start date filter
     * @param endDate Optional end date filter
     * @param status Optional status filter (ACTIVE, PAUSED, COMPLETED, ARCHIVED)
     * @return Center heatmap response with campaign details and response counts
     */
    public CenterHeatmapResponseDTO getCenterHeatmap(
            String instituteId,
            Timestamp startDate,
            Timestamp endDate,
            String status) {
        
        log.info("Fetching center heatmap for institute: {}, startDate: {}, endDate: {}, status: {}",
                instituteId, startDate, endDate, status);

        // The incoming start/end are institute-local wall-clock (the FE sends a
        // tz-less yyyy-MM-dd'T'HH:mm:ss), but created_at is stored in UTC. Convert
        // the window to UTC using the institute's timezone so the date filter lines
        // up with how leads are reported locally (otherwise early-morning-local
        // leads fall on the previous day and drop off the window edge).
        ZoneId zone = leadReportSettingService.zoneOf(instituteId);
        String startDateStr = toUtcString(startDate, zone);
        String endDateStr = toUtcString(endDate, zone);
        String statusFilter = status != null ? status : "";

        List<Object[]> results = audienceRepository.getCenterHeatmapByInstitute(
                instituteId, startDateStr, endDateStr, statusFilter
        );

        List<CenterHeatmapDTO> heatmapData = results.stream()
                .map(this::mapToCenterHeatmapDTO)
                .collect(Collectors.toList());

        // Calculate aggregated statistics
        Long totalUniqueUsers = heatmapData.stream()
                .mapToLong(CenterHeatmapDTO::getUniqueUsers)
                .sum();

        Long totalResponses = heatmapData.stream()
                .mapToLong(CenterHeatmapDTO::getTotalResponses)
                .sum();

        log.info("Center heatmap generated: {} campaigns, {} unique users, {} total responses",
                heatmapData.size(), totalUniqueUsers, totalResponses);

        return CenterHeatmapResponseDTO.builder()
                .totalCampaigns(heatmapData.size())
                .totalUniqueUsers(totalUniqueUsers)
                .totalResponses(totalResponses)
                .centerHeatmap(heatmapData)
                .build();
    }

    /**
     * Reinterpret an institute-local wall-clock timestamp as UTC for comparison
     * against UTC-stored {@code created_at}. Returns "" when null (so the query's
     * COALESCE treats it as no bound).
     */
    private String toUtcString(Timestamp localWallClock, ZoneId zone) {
        if (localWallClock == null) return "";
        LocalDateTime local = localWallClock.toLocalDateTime();
        LocalDateTime utc = local.atZone(zone).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        return Timestamp.valueOf(utc).toString();
    }

    /**
     * Map database result row to CenterHeatmapDTO
     */
    private CenterHeatmapDTO mapToCenterHeatmapDTO(Object[] row) {
        String audienceId = (String) row[0];
        String campaignName = (String) row[1];
        String campaignType = (String) row[2];
        String description = (String) row[3];
        String campaignObjective = (String) row[4];
        String status = (String) row[5];
        Timestamp startDate = (Timestamp) row[6];
        Timestamp endDate = (Timestamp) row[7];
        Long uniqueUsers = row[8] != null ? ((Number) row[8]).longValue() : 0L;
        Long totalResponses = row[9] != null ? ((Number) row[9]).longValue() : 0L;
        Long optedOutUsers = row[10] != null ? ((Number) row[10]).longValue() : 0L;

        // Calculate average responses per user
        Double avgResponsesPerUser = 0.0;
        if (uniqueUsers > 0) {
            avgResponsesPerUser = BigDecimal.valueOf(totalResponses)
                    .divide(BigDecimal.valueOf(uniqueUsers), 2, RoundingMode.HALF_UP)
                    .doubleValue();
        }

        return CenterHeatmapDTO.builder()
                .audienceId(audienceId)
                .campaignName(campaignName)
                .campaignType(campaignType)
                .description(description)
                .campaignObjective(campaignObjective)
                .status(status)
                .startDate(startDate)
                .endDate(endDate)
                .uniqueUsers(uniqueUsers)
                .totalResponses(totalResponses)
                .avgResponsesPerUser(avgResponsesPerUser)
                .optedOutUsers(optedOutUsers)
                .build();
    }
}
