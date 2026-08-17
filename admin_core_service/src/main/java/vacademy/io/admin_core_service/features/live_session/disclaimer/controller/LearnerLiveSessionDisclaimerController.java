package vacademy.io.admin_core_service.features.live_session.disclaimer.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.live_session.disclaimer.dto.LiveSessionDisclaimerDTO;
import vacademy.io.admin_core_service.features.live_session.disclaimer.service.LiveSessionDisclaimerService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * The disclaimer a learner watches before joining a class they have not attended.
 *
 * <p>Read-only: there is no "acknowledge" call because attendance already records
 * who has been in a class. Being marked present is what retires the disclaimer for
 * that class — and only for that class.</p>
 *
 * <p>The learner is taken from the JWT rather than a request parameter, so nobody
 * can ask on someone else's behalf.</p>
 */
@RestController
@RequestMapping("/admin-core-service/live-session/disclaimer/v1")
@RequiredArgsConstructor
public class LearnerLiveSessionDisclaimerController {

    private final LiveSessionDisclaimerService disclaimerService;

    /**
     * @param scheduleId the class being joined. Must be asked BEFORE attendance is
     *                   marked for it, otherwise the learner already counts as present
     *                   and the disclaimer is never required.
     */
    @GetMapping
    public ResponseEntity<LiveSessionDisclaimerDTO> get(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "scheduleId", required = false) String scheduleId) {
        return ResponseEntity.ok(
                disclaimerService.getFor(user.getUserId(), instituteId, scheduleId));
    }
}
