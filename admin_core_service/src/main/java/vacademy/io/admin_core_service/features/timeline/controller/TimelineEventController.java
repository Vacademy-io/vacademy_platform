package vacademy.io.admin_core_service.features.timeline.controller;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.timeline.dto.StudentLatestNoteDTO;
import vacademy.io.admin_core_service.features.timeline.dto.TimelineEventDTO;
import vacademy.io.admin_core_service.features.timeline.dto.TimelineEventRequestDTO;
import vacademy.io.admin_core_service.features.timeline.service.TimelineEventService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;
import java.util.Map;

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

        /**
         * Toggle pin status on a timeline event (note).
         * PUT /admin-core-service/timeline/v1/event/{eventId}/pin
         */
        @PutMapping("/event/{eventId}/pin")
        public ResponseEntity<TimelineEventDTO> togglePin(@PathVariable String eventId) {
                TimelineEventDTO response = timelineEventService.togglePin(eventId);
                return ResponseEntity.ok(response);
        }

        /**
         * Get ALL timeline events for a student across all stages (enquiry → application → enrollment).
         * Pinned notes appear first.
         * GET /admin-core-service/timeline/v1/student/{studentUserId}
         */
        @GetMapping("/student/{studentUserId}")
        public ResponseEntity<Page<TimelineEventDTO>> getCrossStageTimeline(
                        @PathVariable String studentUserId,
                        @RequestParam(defaultValue = "0") int page,
                        @RequestParam(defaultValue = "20") int size) {

                Pageable pageable = PageRequest.of(page, size);
                Page<TimelineEventDTO> response = timelineEventService.getCrossStageTimeline(studentUserId, pageable);
                return ResponseEntity.ok(response);
        }

        /**
         * Batch fetch the latest cross-stage note + count per student.
         * POST /admin-core-service/timeline/v1/student/latest-notes-batch
         * Body: ["userId1", "userId2", ...]
         * Returns: { "userId1": { latest: {...}, count: 3 }, ... }
         */
        @PostMapping("/student/latest-notes-batch")
        public ResponseEntity<Map<String, StudentLatestNoteDTO>> getLatestNotesBatch(
                        @RequestBody List<String> studentUserIds) {
                return ResponseEntity.ok(timelineEventService.getLatestNotesForStudents(studentUserIds));
        }

        /**
         * Get timeline events with pinned notes first.
         * GET /admin-core-service/timeline/v1/events/pinned
         */
        @GetMapping("/events/pinned")
        public ResponseEntity<Page<TimelineEventDTO>> getTimelineEventsWithPinnedFirst(
                        @RequestParam String type,
                        @RequestParam String typeId,
                        @RequestParam(defaultValue = "0") int page,
                        @RequestParam(defaultValue = "20") int size) {

                Pageable pageable = PageRequest.of(page, size);
                Page<TimelineEventDTO> response = timelineEventService.getTimelineEventsWithPinnedFirst(type, typeId, pageable);
                return ResponseEntity.ok(response);
        }

        /**
         * Get JOURNEY events for a lead — lifecycle milestones only (status changes, submission, score updates).
         * GET /admin-core-service/timeline/v1/journey?type=AUDIENCE_RESPONSE&typeId=X
         */
        @GetMapping("/journey")
        public ResponseEntity<Page<TimelineEventDTO>> getJourneyEvents(
                        @RequestParam String type,
                        @RequestParam String typeId,
                        @RequestParam(defaultValue = "0") int page,
                        @RequestParam(defaultValue = "50") int size) {

                Pageable pageable = PageRequest.of(page, size);
                return ResponseEntity.ok(timelineEventService.getJourneyEvents(type, typeId, pageable));
        }

        /**
         * Get JOURNEY events for a student across all stages — the full lead lifecycle view.
         * GET /admin-core-service/timeline/v1/student/{studentUserId}/journey
         */
        @GetMapping("/student/{studentUserId}/journey")
        public ResponseEntity<Page<TimelineEventDTO>> getCrossStageJourney(
                        @PathVariable String studentUserId,
                        @RequestParam(defaultValue = "0") int page,
                        @RequestParam(defaultValue = "50") int size) {

                Pageable pageable = PageRequest.of(page, size);
                return ResponseEntity.ok(timelineEventService.getCrossStageJourney(studentUserId, pageable));
        }

        /**
         * Unified timeline: ALL events (JOURNEY + ACTIVITY) for a student, sorted by timestamp DESC.
         * Powers the lead journey panel that shows submission, score updates, notes, follow-ups,
         * counselor assignment and status changes in a single chronological stream.
         * GET /admin-core-service/timeline/v1/student/{studentUserId}/all
         */
        @GetMapping("/student/{studentUserId}/all")
        public ResponseEntity<Page<TimelineEventDTO>> getAllEventsForStudent(
                        @PathVariable String studentUserId,
                        @RequestParam(defaultValue = "0") int page,
                        @RequestParam(defaultValue = "50") int size) {

                Pageable pageable = PageRequest.of(page, size);
                return ResponseEntity.ok(timelineEventService.getAllEventsForStudent(studentUserId, pageable));
        }
}
