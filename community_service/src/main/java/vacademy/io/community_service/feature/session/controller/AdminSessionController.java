package vacademy.io.community_service.feature.session.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import vacademy.io.community_service.feature.session.dto.admin.CreateSessionDto;
import vacademy.io.community_service.feature.session.dto.admin.LiveSessionDto;
import vacademy.io.community_service.feature.session.dto.admin.StartPresentationDto;
import vacademy.io.community_service.feature.session.manager.LiveSessionService;

import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/community-service/engage/admin")
public class AdminSessionController {

    @Autowired
    LiveSessionService liveSessionService;

    @PostMapping("/create")
    public ResponseEntity<LiveSessionDto> createSession(@RequestBody CreateSessionDto createSessionDto) {
        LiveSessionDto inviteCode = liveSessionService.createSession(createSessionDto);
        return ResponseEntity.ok(inviteCode);
    }

    @GetMapping("/{sessionId}")
    public SseEmitter presenterStream(@PathVariable String sessionId) {
        // Timeout for the emitter itself (e.g., 1 hour)
        SseEmitter emitter = new SseEmitter(3600000L); // 1 hour

        // The service method will now handle sending initial state upon successful connection
        liveSessionService.setPresenterEmitter(sessionId, emitter, true);

        // Heartbeat mechanism to keep the connection alive and allow client to detect silent drops
        final ScheduledExecutorService heartBeatExecutor = Executors.newSingleThreadScheduledExecutor();
        Runnable heartbeatTask = () -> {
            try {
                // Send a distinct heartbeat event for the presenter
                emitter.send(SseEmitter.event().name("presenter_heartbeat").id(UUID.randomUUID().toString()).data("ping"));
            } catch (IOException e) {
                // This error means the connection is likely broken.
                // The emitter's onError or onCompletion will be triggered by the send failure.
                // We should ensure the heartbeat executor is shut down.
                if (!heartBeatExecutor.isShutdown()) {
                    heartBeatExecutor.shutdown();
                }
                // No need to call emitter.completeWithError(e) here, as the send failure itself will propagate.
            }
        };

        // Schedule the heartbeat
        heartBeatExecutor.scheduleAtFixedRate(heartbeatTask, 0, 30, TimeUnit.SECONDS);

        // Ensure executor shutdown when the SseEmitter is completed, times out, or errors.
        emitter.onCompletion(() -> {
            if (!heartBeatExecutor.isShutdown()) heartBeatExecutor.shutdown();
            // Service level onCompletion will handle clearing the emitter from the session
        });
        emitter.onTimeout(() -> {
            if (!heartBeatExecutor.isShutdown()) heartBeatExecutor.shutdown();
            // Service level onTimeout will handle clearing
            // Spring Boot SseEmitter infrastructure calls complete() internally on timeout.
        });
        emitter.onError(e -> {
            if (!heartBeatExecutor.isShutdown()) heartBeatExecutor.shutdown();
            // Service level onError will handle clearing
        });

        return emitter;
    }

    @PostMapping("/start")
    public ResponseEntity<LiveSessionDto> startSession(@RequestBody StartPresentationDto startPresentationDto) {
        LiveSessionDto liveSessionDto = liveSessionService.startSession(startPresentationDto);
        return ResponseEntity.ok(liveSessionDto);
    }

    @PostMapping("/move")
    public ResponseEntity<LiveSessionDto> moveTo(@RequestBody StartPresentationDto startPresentationDto) {
        LiveSessionDto liveSessionDto = liveSessionService.moveTo(startPresentationDto);
        return ResponseEntity.ok(liveSessionDto);
    }

    @PostMapping("/finish")
    public ResponseEntity<LiveSessionDto> finishSession(@RequestBody StartPresentationDto startPresentationDto) {
        LiveSessionDto liveSessionDto = liveSessionService.finishSession(startPresentationDto);
        return ResponseEntity.ok(liveSessionDto);
    }

}