package vacademy.io.community_service.feature.session.controller;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import vacademy.io.community_service.feature.session.dto.admin.LiveSessionDto;
import vacademy.io.community_service.feature.session.dto.admin.ParticipantDto;

import vacademy.io.community_service.feature.session.dto.participant.MarkResponseRequestDto;
import vacademy.io.community_service.feature.session.manager.LiveSessionService;

import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/community-service/engage/learner")
public class ParticipantSessionController {

    @Autowired
    LiveSessionService liveSessionService;

    @PostMapping("/get-details/{inviteCode}")
    public ResponseEntity<LiveSessionDto> joinSession(@PathVariable String inviteCode, @RequestBody ParticipantDto participantDto) {
        LiveSessionDto session = liveSessionService.getDetailsSession(inviteCode, participantDto);
        return ResponseEntity.ok(session);
    }

    @GetMapping("/{sessionId}")
    public SseEmitter learnerStream(@PathVariable String sessionId, @RequestParam String username) {
        SseEmitter emitter = new SseEmitter(3L * 60 * 60 * 1000); // 3 hours, for example

        liveSessionService.addStudentEmitter(sessionId, emitter, username);

        final ScheduledExecutorService heartBeatExecutor = Executors.newSingleThreadScheduledExecutor();
        Runnable heartbeatTask = () -> {
            try {
                emitter.send(SseEmitter.event().name("learner_heartbeat").id(UUID.randomUUID().toString()).data("ping"));
            } catch (IOException e) {
                if (!heartBeatExecutor.isShutdown()) {
                    heartBeatExecutor.shutdown();
                }
            }
        };
        heartBeatExecutor.scheduleAtFixedRate(heartbeatTask, 0, 30, TimeUnit.SECONDS);

        emitter.onCompletion(() -> {
            if (!heartBeatExecutor.isShutdown()) heartBeatExecutor.shutdown();
            // Service's addStudentEmitter handles app logic cleanup
        });
        emitter.onTimeout(() -> {
            if (!heartBeatExecutor.isShutdown()) heartBeatExecutor.shutdown();
            // emitter.complete(); // SseEmitter infrastructure typically calls complete internally on timeout
        });
        emitter.onError(e -> {
            if (!heartBeatExecutor.isShutdown()) heartBeatExecutor.shutdown();
        });
        return emitter;
    }

    @PostMapping("/{sessionId}/heartbeat")
    public ResponseEntity<?> recordHeartbeat(
            @PathVariable String sessionId,
            @RequestParam String username) {
        liveSessionService.recordHeartbeat(sessionId, username);
        return ResponseEntity.ok().build();
    }

    // New endpoint for participants to submit responses
    @PostMapping("/{sessionId}/slide/{slideId}/respond")
    public ResponseEntity<?> recordResponse(
            @PathVariable String sessionId,
            @PathVariable String slideId,
            @Valid @RequestBody MarkResponseRequestDto responseRequest) {
        // Ensure username in request matches authenticated user if security is in place
        // For now, using username from request body as specified.
        liveSessionService.recordParticipantResponse(sessionId, slideId, responseRequest);
        return ResponseEntity.ok().build();
    }
}