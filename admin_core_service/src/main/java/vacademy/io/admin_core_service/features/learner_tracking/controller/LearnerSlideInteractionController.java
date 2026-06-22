package vacademy.io.admin_core_service.features.learner_tracking.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_tracking.dto.SlideInteractionDTO;
import vacademy.io.admin_core_service.features.learner_tracking.service.LearnerSlideInteractionService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

/**
 * Learner interaction state (checklist / fill-in-the-blank / inline MCQ) for
 * document slides. Lives under the authenticated learner-tracking base path.
 *
 * - Learner endpoints take the userId from the token (a learner only ever
 *   reads/writes their own state).
 * - The /admin endpoint takes an explicit userId so the admin activity-log view
 *   can read a chosen learner's responses (same shape as the existing admin
 *   activity-log endpoints, which also accept a userId param).
 */
@RestController
@RequestMapping("/admin-core-service/learner-tracking/v1")
public class LearnerSlideInteractionController {

    private final LearnerSlideInteractionService service;

    public LearnerSlideInteractionController(LearnerSlideInteractionService service) {
        this.service = service;
    }

    @GetMapping("/slide-interaction")
    public ResponseEntity<List<SlideInteractionDTO>> getInteractions(
            @RequestParam String slideId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(service.getInteractions(user.getUserId(), slideId));
    }

    @PostMapping("/slide-interaction")
    public ResponseEntity<SlideInteractionDTO> saveInteraction(
            @RequestParam String slideId,
            @RequestBody SlideInteractionDTO body,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(service.saveInteraction(
                user.getUserId(), slideId, body.getElementKey(), body.getElementType(), body.getStateJson()));
    }

    @GetMapping("/slide-interaction/admin")
    public ResponseEntity<List<SlideInteractionDTO>> getInteractionsForLearner(
            @RequestParam String slideId,
            @RequestParam String userId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(service.getInteractions(userId, slideId));
    }
}
