package vacademy.io.admin_core_service.features.audience.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.audience.dto.CenterHeatmapRequestDTO;
import vacademy.io.admin_core_service.features.audience.dto.CenterHeatmapResponseDTO;
import vacademy.io.admin_core_service.features.audience.service.AudienceAnalyticsService;

import java.sql.Timestamp;

@RestController
@RequestMapping("admin-core-service/v1/audience")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Audience Analytics", description = "APIs for audience campaign analytics")
public class AudienceAnalyticsController {

    private final AudienceAnalyticsService audienceAnalyticsService;

    @PostMapping("/center-heatmap")
    @Operation(
        summary = "Get Center Interaction Heatmap",
        description = "Retrieves audience campaign engagement metrics showing unique users and response counts. " +
                      "Supports filtering by campaign status and date range."
    )
    public ResponseEntity<CenterHeatmapResponseDTO> getCenterHeatmap(
            @RequestBody @Valid CenterHeatmapRequestDTO request
    ) {
        log.info("GET /v1/audience/center-heatmap - Request: {}", request);

        // Convert LocalDateTime to Timestamp for repository
        Timestamp startTimestamp = request.getStartDate() != null 
                ? Timestamp.valueOf(request.getStartDate()) 
                : null;
        Timestamp endTimestamp = request.getEndDate() != null 
                ? Timestamp.valueOf(request.getEndDate()) 
                : null;

        CenterHeatmapResponseDTO response = audienceAnalyticsService.getCenterHeatmap(
                request.getInstituteId(), 
                startTimestamp,
                endTimestamp,
                request.getStatus()
        );

        return ResponseEntity.ok(response);
    }
}
