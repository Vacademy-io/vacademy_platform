package vacademy.io.community_service.feature.session.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import vacademy.io.community_service.feature.session.dto.admin.AdminSlideResponseViewDto;
import vacademy.io.community_service.feature.session.dto.admin.CreateSessionDto;
import vacademy.io.community_service.feature.session.dto.admin.LiveSessionDto;
import vacademy.io.community_service.feature.session.dto.admin.StartPresentationDto;
import vacademy.io.community_service.feature.session.manager.LiveSessionService;

import java.io.IOException;
import java.util.List;
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
        LiveSessionDto sessionDto = liveSessionService.createSession(createSessionDto);
        return ResponseEntity.ok(sessionDto);
    }

    @GetMapping("/{sessionId}/stream") // Renamed for clarity, or keep as /{sessionId} if preferred
    public SseEmitter presenterStream(@PathVariable String sessionId) {
        SseEmitter emitter = new SseEmitter(3L * 60 * 60 * 1000); // 3 hours, for example

        liveSessionService.setPresenterEmitter(sessionId, emitter, true); // Send initial state

        final ScheduledExecutorService heartBeatExecutor = Executors.newSingleThreadScheduledExecutor();
        Runnable heartbeatTask = () -> {
            try {
                emitter.send(SseEmitter.event().name("presenter_heartbeat").id(UUID.randomUUID().toString()).data("ping"));
            } catch (IOException e) {
                if (!heartBeatExecutor.isShutdown()) {
                    heartBeatExecutor.shutdown();
                }
            }
        };
        heartBeatExecutor.scheduleAtFixedRate(heartbeatTask, 0, 30, TimeUnit.SECONDS);

        emitter.onCompletion(() -> {
            if (!heartBeatExecutor.isShutdown()) heartBeatExecutor.shutdown();
            // Service handles clearing the emitter from the session.
        });
        emitter.onTimeout(() -> {
            if (!heartBeatExecutor.isShutdown()) heartBeatExecutor.shutdown();
            // Service handles clearing the emitter from the session.
        });
        emitter.onError(e -> {
            if (!heartBeatExecutor.isShutdown()) heartBeatExecutor.shutdown();
            // Service handles clearing the emitter from the session.
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

    // New endpoint to get slide responses
    @GetMapping("/{sessionId}/slide/{slideId}/responses")
    public ResponseEntity<List<AdminSlideResponseViewDto>> getSlideResponses(
            @PathVariable String sessionId,
            @PathVariable String slideId) {
        List<AdminSlideResponseViewDto> responses = liveSessionService.getSlideResponses(sessionId, slideId);
        return ResponseEntity.ok(responses);
    }
}