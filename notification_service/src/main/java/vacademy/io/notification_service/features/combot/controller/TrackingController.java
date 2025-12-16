package vacademy.io.notification_service.features.combot.controller;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.notification_service.features.combot.dto.TrackingRequest;
import vacademy.io.notification_service.features.combot.service.TrackingService;

@RestController
@RequestMapping("/notification-service/v1/tracking")
@RequiredArgsConstructor
@Slf4j
public class TrackingController {

    private final TrackingService trackingService;

    @PostMapping("/log")
    public ResponseEntity<String> logEvent(@RequestBody TrackingRequest request) {
        trackingService.logTrackingEvent(request);
        return ResponseEntity.ok("ok");
    }
}