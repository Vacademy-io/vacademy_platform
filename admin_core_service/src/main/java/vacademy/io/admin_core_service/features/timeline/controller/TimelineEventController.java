package vacademy.io.admin_core_service.features.timeline.controller;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.timeline.dto.TimelineEventDTO;
import vacademy.io.admin_core_service.features.timeline.dto.TimelineEventRequestDTO;
import vacademy.io.admin_core_service.features.timeline.service.TimelineEventService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/timeline/v1")
public class TimelineEventController {

        @Autowired
        private TimelineEventService timelineEventService;

        @GetMapping("/events")
        public ResponseEntity<Page<TimelineEventDTO>> getTimelineEvents(
                        @RequestParam String type,
                        @RequestParam String typeId,
                        @RequestParam(defaultValue = "0") int page,
                        @RequestParam(defaultValue = "20") int size) {

                Pageable pageable = PageRequest.of(page, size);
                Page<TimelineEventDTO> response = timelineEventService.getTimelineEvents(type, typeId, pageable);
                return ResponseEntity.ok(response);
        }

        @PostMapping("/event")
        public ResponseEntity<TimelineEventDTO> createManualEvent(
                        @Valid @RequestBody TimelineEventRequestDTO request,
                        @RequestAttribute("user") CustomUserDetails user) {

                TimelineEventDTO response = timelineEventService.createManualEvent(request, user);
                return ResponseEntity.ok(response);
        }
}
