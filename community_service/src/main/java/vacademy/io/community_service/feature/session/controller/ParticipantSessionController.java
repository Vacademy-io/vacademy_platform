// vacademy.io.community_service.feature.session.controller.ParticipantSessionController

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import vacademy.io.community_service.feature.session.dto.admin.LiveSessionDto;
import vacademy.io.community_service.feature.session.dto.admin.ParticipantDto;
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

    // joinSession (get-details) remains largely the same, relies on service logic
    @PostMapping("/get-details/{inviteCode}")
    public ResponseEntity<LiveSessionDto> joinSession(@PathVariable String inviteCode, @RequestBody ParticipantDto participantDto) {
        // Service method handles logic for new vs rejoining participant based on username and current status
        LiveSessionDto session = liveSessionService.getDetailsSession(inviteCode, participantDto);
        return ResponseEntity.ok(session);
    }

    @GetMapping("/{sessionId}")
    public SseEmitter learnerStream(@PathVariable String sessionId, @RequestParam String username) {
        SseEmitter emitter = new SseEmitter(3600000L); // 1-hour timeout for the emitter

        // The service method handles adding the emitter, sending initial state, and setting up app-level cleanup
        liveSessionService.addStudentEmitter(sessionId, emitter, username);

        // Heartbeat from server to client to keep connection alive / detect silent drops by client
        final ScheduledExecutorService heartBeatExecutor = Executors.newSingleThreadScheduledExecutor();
        Runnable heartbeatTask = () -> {
            try {
                emitter.send(SseEmitter.event().name("learner_heartbeat").id(UUID.randomUUID().toString()).data("ping"));
            } catch (IOException e) {
                // Connection likely broken, emitter's onError/onCompletion will be triggered by the send failure.
                if (!heartBeatExecutor.isShutdown()) {
                    heartBeatExecutor.shutdown();
                }
            }
        };
        heartBeatExecutor.scheduleAtFixedRate(heartbeatTask, 0, 30, TimeUnit.SECONDS);

        // Ensure heartbeat executor is shut down when the emitter's lifecycle ends.
        // The service's addStudentEmitter sets its own onCompletion/onError/onTimeout for application logic.
        // This controller adds its own for the heartbeat executor cleanup specific to this emitter instance.
        emitter.onCompletion(() -> {
            if (!heartBeatExecutor.isShutdown()) heartBeatExecutor.shutdown();
            // The service's addStudentEmitter.onCompletion will handle app logic like INACTIVE status
        });
        emitter.onTimeout(() -> {
            if (!heartBeatExecutor.isShutdown()) heartBeatExecutor.shutdown();
            emitter.complete(); // Ensure emitter itself is completed
        });
        emitter.onError(e -> {
            if (!heartBeatExecutor.isShutdown()) heartBeatExecutor.shutdown();
        });
        return emitter;
    }

    // recordHeartbeat (client to server) remains the same
    @PostMapping("/{sessionId}/heartbeat")
    public ResponseEntity<?> recordHeartbeat(
            @PathVariable String sessionId,
            @RequestParam String username) {
        liveSessionService.recordHeartbeat(sessionId, username);
        return ResponseEntity.ok().build();
    }
}