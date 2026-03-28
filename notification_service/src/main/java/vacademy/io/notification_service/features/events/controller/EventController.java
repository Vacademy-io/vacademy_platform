package vacademy.io.notification_service.features.events.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.notification_service.features.events.dto.NotificationEventRequest;
import vacademy.io.notification_service.features.events.dto.NotificationEventResponse;
import vacademy.io.notification_service.features.events.service.EventProcessorService;

/**
 * Internal endpoint for admin-core to fire notification events.
 * Admin-core resolves the event configs and passes pre-resolved sends.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("notification-service/internal/v1/events")
public class EventController {

    private final EventProcessorService eventProcessorService;

    @PostMapping
    public ResponseEntity<NotificationEventResponse> fireEvent(
            @RequestBody NotificationEventRequest request) {
        log.info("Received notification event: type={}, institute={}, sends={}",
                request.getEventType(), request.getInstituteId(),
                request.getSends() != null ? request.getSends().size() : 0);

        NotificationEventResponse response = eventProcessorService.processEvent(request);
        return ResponseEntity.ok(response);
    }
}
