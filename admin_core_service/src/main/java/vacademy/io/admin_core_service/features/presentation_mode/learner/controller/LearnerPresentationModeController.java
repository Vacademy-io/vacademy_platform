package vacademy.io.admin_core_service.features.presentation_mode.learner.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import vacademy.io.admin_core_service.features.presentation_mode.learner.dto.LiveSessionDto;
import vacademy.io.admin_core_service.features.presentation_mode.learner.dto.ParticipantDto;
import vacademy.io.admin_core_service.features.presentation_mode.manager.LiveSessionService;

import java.io.IOException;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/admin-core-service/live-learner/v1")
public class LearnerPresentationModeController {

    @Autowired
    LiveSessionService liveSessionService;

    @PostMapping("/get-details/{inviteCode}")
    public ResponseEntity<LiveSessionDto> joinSession(@PathVariable String inviteCode, @RequestBody ParticipantDto participantDto) {
        participantDto.setStatus("INIT");
        LiveSessionDto session = liveSessionService.getDetailsSession(inviteCode, participantDto);
        return ResponseEntity.ok(session);
    }

    @GetMapping("/{sessionId}")
    public SseEmitter learnerStream(@PathVariable String sessionId, @RequestParam String username) {
        SseEmitter emitter = new SseEmitter(3600000L);
        liveSessionService.addStudentEmitter(sessionId, emitter, username);

        // Send periodic data or heartbeats to keep the connection alive
        Executors.newSingleThreadScheduledExecutor().scheduleAtFixedRate(() -> {
            try {
                emitter.send(SseEmitter.event().name("heartbeat").data("ping"));
            } catch (IOException e) {
                emitter.completeWithError(e);
            }
        }, 0, 30, TimeUnit.SECONDS);
        return emitter;
    }

    @PostMapping("/{sessionId}/heartbeat")
    public ResponseEntity<?> recordHeartbeat(
            @PathVariable String sessionId,
            @RequestParam String username) {
        liveSessionService.recordHeartbeat(sessionId, username);
        return ResponseEntity.ok().build();
    }

}
