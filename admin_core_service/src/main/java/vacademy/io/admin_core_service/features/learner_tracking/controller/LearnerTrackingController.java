package vacademy.io.admin_core_service.features.learner_tracking.controller;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.service.LearnerTrackingService;
import vacademy.io.common.auth.config.PageConstants;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/learner-tracking/v1")
public class LearnerTrackingController {

        private final LearnerTrackingService learnerTrackingService;

        public LearnerTrackingController(LearnerTrackingService learnerTrackingService) {
                this.learnerTrackingService = learnerTrackingService;
        }

        @PostMapping("/add-or-update-document-activity")
        public ResponseEntity<ActivityLogDTO> addDocumentActivityLog(
                        @RequestBody ActivityLogDTO activityLogDTO,
                        @RequestParam String slideId,
                        @RequestParam String chapterId,
                        @RequestParam String packageSessionId,
                        @RequestParam String moduleId,
                        @RequestParam String subjectId,
                        @RequestAttribute("user") CustomUserDetails user) {
                return ResponseEntity.ok(learnerTrackingService.addOrUpdateDocumentActivityLog(
                                activityLogDTO,
                                slideId,
                                chapterId,
                                packageSessionId,
                                moduleId,
                                subjectId,
                                user));
        }

        @PostMapping("/add-or-update-video-activity")
        public ResponseEntity<ActivityLogDTO> addVideoActivityLog(
                        @RequestBody ActivityLogDTO activityLogDTO,
                        @RequestParam String slideId,
                        @RequestParam String chapterId,
                        @RequestParam String packageSessionId,
                        @RequestParam String moduleId,
                        @RequestParam String subjectId,
                        @RequestAttribute("user") CustomUserDetails user) {
                return ResponseEntity.ok(
                                learnerTrackingService.addOrUpdateVideoActivityLog(activityLogDTO, slideId, chapterId,
                                                moduleId, subjectId, packageSessionId, user));
        }

        /**
         * Explicit learner-driven completion for a slide (the "Mark as complete"
         * checkbox). Idempotent and reversible — pass completed=false to undo,
         * which recomputes the slide's real percentage from its activity logs
         * rather than zeroing it.
         */
        @PostMapping("/mark-slide-completion")
        public ResponseEntity<Boolean> markSlideCompletion(
                        @RequestParam String slideId,
                        @RequestParam String slideType,
                        @RequestParam(required = false) String chapterId,
                        @RequestParam(required = false) String moduleId,
                        @RequestParam(required = false) String subjectId,
                        @RequestParam(required = false) String packageSessionId,
                        @RequestParam(defaultValue = "true") boolean completed,
                        @RequestAttribute("user") CustomUserDetails user) {
                return ResponseEntity.ok(learnerTrackingService.markSlideCompletion(
                                slideId,
                                slideType,
                                chapterId,
                                moduleId,
                                subjectId,
                                packageSessionId,
                                completed,
                                user));
        }

        @GetMapping("/get-learner-document-activity-logs")
        public Page<ActivityLogDTO> getDocumentActivityLogs(
                        @RequestParam("userId") String userId,
                        @RequestParam("slideId") String slideId,
                        @RequestParam(value = "pageNo", defaultValue = PageConstants.DEFAULT_PAGE_NUMBER, required = false) int pageNo,
                        @RequestParam(value = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE, required = false) int pageSize,
                        @RequestAttribute("user") CustomUserDetails userDetails) {

                return learnerTrackingService.getDocumentActivityLogs(userId, slideId, PageRequest.of(pageNo, pageSize),
                                userDetails);
        }

        @GetMapping("/get-learner-video-activity-logs")
        public Page<ActivityLogDTO> getVideoActivityLogs(
                        @RequestParam("userId") String userId,
                        @RequestParam("slideId") String slideId,
                        @RequestParam(value = "pageNo", defaultValue = PageConstants.DEFAULT_PAGE_NUMBER, required = false) int pageNo,
                        @RequestParam(value = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE, required = false) int pageSize,
                        @RequestAttribute("user") CustomUserDetails userDetails) {

                return learnerTrackingService.getVideoActivityLogs(userId, slideId, PageRequest.of(pageNo, pageSize),
                                userDetails);
        }

        @PostMapping("/add-or-update-html-video-activity")
        public ResponseEntity<ActivityLogDTO> addHtmlVideoActivityLog(
                        @RequestBody ActivityLogDTO activityLogDTO,
                        @RequestParam String slideId,
                        @RequestParam String chapterId,
                        @RequestParam String packageSessionId,
                        @RequestParam String moduleId,
                        @RequestParam String subjectId,
                        @RequestAttribute("user") CustomUserDetails user) {
                return ResponseEntity.ok(learnerTrackingService.addOrUpdateHtmlVideoActivityLog(activityLogDTO, slideId,
                                chapterId, moduleId, subjectId, packageSessionId, user));
        }

        @GetMapping("/get-learner-html-video-activity-logs")
        public Page<ActivityLogDTO> getHtmlVideoActivityLogs(
                        @RequestParam("userId") String userId,
                        @RequestParam("slideId") String slideId,
                        @RequestParam(value = "pageNo", defaultValue = PageConstants.DEFAULT_PAGE_NUMBER, required = false) int pageNo,
                        @RequestParam(value = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE, required = false) int pageSize,
                        @RequestAttribute("user") CustomUserDetails userDetails) {

                return learnerTrackingService.getVideoActivityLogs(userId, slideId, PageRequest.of(pageNo, pageSize),
                                userDetails);
        }

        @PostMapping("/add-or-update-audio-activity")
        public ResponseEntity<ActivityLogDTO> addAudioActivityLog(
                        @RequestBody ActivityLogDTO activityLogDTO,
                        @RequestParam String slideId,
                        @RequestParam String chapterId,
                        @RequestParam String packageSessionId,
                        @RequestParam String moduleId,
                        @RequestParam String subjectId,
                        @RequestAttribute("user") CustomUserDetails user) {
                return ResponseEntity.ok(learnerTrackingService.addOrUpdateAudioActivityLog(activityLogDTO, slideId,
                                chapterId, moduleId, subjectId, packageSessionId, user));
        }

        @GetMapping("/get-learner-audio-activity-logs")
        public Page<ActivityLogDTO> getAudioActivityLogs(
                        @RequestParam("userId") String userId,
                        @RequestParam("slideId") String slideId,
                        @RequestParam(value = "pageNo", defaultValue = PageConstants.DEFAULT_PAGE_NUMBER, required = false) int pageNo,
                        @RequestParam(value = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE, required = false) int pageSize,
                        @RequestAttribute("user") CustomUserDetails userDetails) {

                return learnerTrackingService.getAudioActivityLogs(userId, slideId, PageRequest.of(pageNo, pageSize),
                                userDetails);
        }
}