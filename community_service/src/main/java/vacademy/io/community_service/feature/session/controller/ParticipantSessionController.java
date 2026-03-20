package vacademy.io.community_service.feature.session.controller;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import vacademy.io.community_service.feature.session.dto.admin.LeaderboardEntryDto;
import vacademy.io.community_service.feature.session.dto.admin.LiveSessionDto;
import vacademy.io.community_service.feature.session.dto.admin.ParticipantDto;

import vacademy.io.community_service.feature.session.dto.participant.MarkResponseRequestDto;
import vacademy.io.community_service.feature.session.manager.LiveSessionService;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/community-service/engage/learner")
public class ParticipantSessionController {

    @Autowired
    LiveSessionService liveSessionService;

    // Shared pool — replaces per-connection Executors.newSingleThreadScheduledExecutor()
    // which created one daemon thread per student (1000 students = 1000 threads).
    @Autowired
    @Qualifier("sseHeartbeatScheduler")
    private ScheduledExecutorService sseHeartbeatScheduler;

    @PostMapping("/get-details/{inviteCode}")
    public ResponseEntity<LiveSessionDto> joinSession(@PathVariable String inviteCode,
            @RequestBody ParticipantDto participantDto) {
        LiveSessionDto session = liveSessionService.getDetailsSession(inviteCode, participantDto);
        return ResponseEntity.ok(session);
    }

    @GetMapping("/get-updated-details/{sessionId}")
    public ResponseEntity<LiveSessionDto> getUpdatedSession(@PathVariable String sessionId) {
        LiveSessionDto session = liveSessionService.getUpdatedSession(sessionId);
        return ResponseEntity.ok(session);
    }

    @GetMapping("/{sessionId}")
    public SseEmitter learnerStream(@PathVariable String sessionId, @RequestParam String username) {
        SseEmitter emitter = new SseEmitter(3L * 60 * 60 * 1000); // 3 hours

        liveSessionService.addStudentEmitter(sessionId, emitter, username);

        // Schedule heartbeat on the shared pool; store the future so we can cancel it
        // (not shut down the whole pool) when this specific emitter closes.
        Runnable heartbeatTask = () -> {
            try {
                emitter.send(
                        SseEmitter.event().name("learner_heartbeat").id(UUID.randomUUID().toString()).data("ping"));
            } catch (IOException | IllegalStateException ignored) {
                // Emitter is already closed; the onCompletion/onTimeout/onError handler
                // below will cancel this future.
            }
        };
        ScheduledFuture<?> heartbeatFuture =
                sseHeartbeatScheduler.scheduleAtFixedRate(heartbeatTask, 0, 30, TimeUnit.SECONDS);

        emitter.onCompletion(() -> heartbeatFuture.cancel(false));
        emitter.onTimeout(() -> heartbeatFuture.cancel(false));
        emitter.onError(e -> heartbeatFuture.cancel(false));

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
        liveSessionService.recordParticipantResponse(sessionId, slideId, responseRequest);
        return ResponseEntity.ok().build();
    }

    // Leaderboard endpoint for participants
    @GetMapping("/{sessionId}/leaderboard")
    public ResponseEntity<List<LeaderboardEntryDto>> getParticipantLeaderboard(
            @PathVariable String sessionId) {
        List<LeaderboardEntryDto> leaderboard = liveSessionService.computeLeaderboard(sessionId);
        return ResponseEntity.ok(leaderboard);
    }
}
