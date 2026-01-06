package vacademy.io.admin_core_service.features.slide.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.slide.dto.ScormTrackingDTO;
import vacademy.io.admin_core_service.features.slide.service.ScormTrackingService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/scorm/tracking/v1")
@RequiredArgsConstructor
public class ScormTrackingController {

    private final ScormTrackingService scormTrackingService;

    @GetMapping("/{slideId}/initialize")
    public ResponseEntity<ScormTrackingDTO> initialize(@PathVariable String slideId,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(scormTrackingService.initializeSession(userDetails.getUserId(), slideId));
    }

    @PostMapping("/{slideId}/commit")
    public ResponseEntity<Void> commit(@PathVariable String slideId, @RequestBody ScormTrackingDTO trackingDTO,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        scormTrackingService.commitSession(userDetails.getUserId(), slideId, trackingDTO);
        return ResponseEntity.ok().build();
    }
}
