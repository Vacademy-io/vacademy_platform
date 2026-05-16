package vacademy.io.notification_service.features.hub.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.notification_service.features.hub.dto.HubOverviewDTO;
import vacademy.io.notification_service.features.hub.dto.HubRecentItemDTO;
import vacademy.io.notification_service.features.hub.service.NotificationHubService;

import java.util.List;

/**
 * Notification Hub aggregates stats + recent incoming activity for the admin dashboard.
 * Email + WhatsApp counts are scoped by the institute's configured channels.
 */
@Slf4j
@RestController
@RequestMapping("/notification-service/v1/hub")
@RequiredArgsConstructor
public class NotificationHubController {

    private final NotificationHubService hubService;

    @GetMapping("/overview")
    public ResponseEntity<HubOverviewDTO> getOverview(
            @RequestParam String instituteId,
            @RequestParam(defaultValue = "7") int windowDays) {
        int clamped = Math.max(1, Math.min(windowDays, 90));
        return ResponseEntity.ok(hubService.getOverview(instituteId, clamped));
    }

    @GetMapping("/recent")
    public ResponseEntity<List<HubRecentItemDTO>> getRecent(
            @RequestParam String instituteId,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        return ResponseEntity.ok(hubService.getRecentIncoming(instituteId, limit, offset));
    }
}
