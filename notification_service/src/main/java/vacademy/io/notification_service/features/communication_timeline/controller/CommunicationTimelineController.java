package vacademy.io.notification_service.features.communication_timeline.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.notification_service.features.communication_timeline.dto.CommunicationTimelineRequest;
import vacademy.io.notification_service.features.communication_timeline.dto.UnifiedCommunicationDTO;
import vacademy.io.notification_service.features.communication_timeline.service.CommunicationTimelineService;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/notification-service/v1/communications")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class CommunicationTimelineController {

    private final CommunicationTimelineService communicationTimelineService;

    /**
     * Get unified communication timeline for a user.
     * Merges email tracking, WhatsApp messages (in+out), and push notifications.
     *
     * GET /notification-service/v1/communications/user/{userId}?page=0&size=20&channels=EMAIL,WHATSAPP&direction=ALL
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<Page<UnifiedCommunicationDTO>> getUserCommunications(
            @PathVariable String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) List<String> channels,
            @RequestParam(required = false, defaultValue = "ALL") String direction,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate) {

        try {
            log.info("Fetching communication timeline for userId: {}, page: {}, size: {}, channels: {}, direction: {}",
                    userId, page, size, channels, direction);

            CommunicationTimelineRequest request = CommunicationTimelineRequest.builder()
                    .userId(userId)
                    .page(page)
                    .size(size)
                    .channels(channels)
                    .direction(direction)
                    .fromDate(fromDate != null ? LocalDateTime.parse(fromDate) : null)
                    .toDate(toDate != null ? LocalDateTime.parse(toDate) : null)
                    .build();

            Page<UnifiedCommunicationDTO> response = communicationTimelineService.getUserCommunications(request);
            return ResponseEntity.ok(response);

        } catch (IllegalArgumentException e) {
            log.error("Invalid request for user {}: {}", userId, e.getMessage());
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            log.error("Error fetching communication timeline for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }
}
