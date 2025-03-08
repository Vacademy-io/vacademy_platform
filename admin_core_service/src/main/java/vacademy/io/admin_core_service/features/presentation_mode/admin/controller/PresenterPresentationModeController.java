package vacademy.io.admin_core_service.features.presentation_mode.admin.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import vacademy.io.admin_core_service.features.presentation_mode.admin.dto.CreatePresentationDto;
import vacademy.io.admin_core_service.features.presentation_mode.admin.dto.StartPresentationDto;
import vacademy.io.admin_core_service.features.presentation_mode.learner.dto.LiveSessionDto;
import vacademy.io.admin_core_service.features.presentation_mode.manager.LiveSessionService;

import java.io.IOException;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/admin-core-service/live-presenter/v1")
public class PresenterPresentationModeController {

    @Autowired
    LiveSessionService liveSessionService;

    @PostMapping("/create")
    public ResponseEntity<LiveSessionDto> createSession(@RequestBody CreatePresentationDto createPresentationDto) {
        LiveSessionDto inviteCode = liveSessionService.createSession(createPresentationDto);
        return ResponseEntity.ok(inviteCode);
    }

    @PostMapping("/start")
    public ResponseEntity<LiveSessionDto> startSession(@RequestBody StartPresentationDto startPresentationDto) {
        LiveSessionDto inviteCode = liveSessionService.startSession(startPresentationDto);
        return ResponseEntity.ok(inviteCode);
    }

    @PostMapping("/move-to")
    public ResponseEntity<LiveSessionDto> moveTo(@RequestBody StartPresentationDto startPresentationDto) {
        LiveSessionDto inviteCode = liveSessionService.moveTo(startPresentationDto);
        return ResponseEntity.ok(inviteCode);
    }


    @PostMapping("/finish")
    public ResponseEntity<LiveSessionDto> finishSession(@RequestBody StartPresentationDto startPresentationDto) {
        LiveSessionDto inviteCode = liveSessionService.finishSession(startPresentationDto);
        return ResponseEntity.ok(inviteCode);
    }

    @GetMapping("/{sessionId}")
    public SseEmitter presenterStream(@PathVariable String sessionId) {
        SseEmitter emitter = new SseEmitter(3600000L);
        liveSessionService.setPresenterEmitter(sessionId, emitter);

        // Send periodic data or heartbeats to keep the connection alive
        Executors.newSingleThreadScheduledExecutor().scheduleAtFixedRate(() -> {
            try {
                emitter.send(SseEmitter.event().data("heartbeat"));
            } catch (IOException e) {
                emitter.completeWithError(e);
            }
        }, 0, 30, TimeUnit.SECONDS);
        return emitter;
    }
}
