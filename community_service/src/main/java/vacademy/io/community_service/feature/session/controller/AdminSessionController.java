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
import java.util.concurrent.Executors;
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