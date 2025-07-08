package vacademy.io.admin_core_service.features.live_session.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.live_session.dto.LiveSessionRequestDTO;
import vacademy.io.admin_core_service.features.live_session.dto.LiveSessionStep1RequestDTO;
import vacademy.io.admin_core_service.features.live_session.dto.LiveSessionStep2RequestDTO;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.admin_core_service.features.live_session.service.GetLiveSessionService;
import vacademy.io.admin_core_service.features.live_session.service.Step1Service;
import vacademy.io.admin_core_service.features.live_session.service.Step2Service;
import vacademy.io.admin_core_service.features.session.dto.SessionDTOWithDetails;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/live-sessions/v1")
@RequiredArgsConstructor
public class LiveSessionController {

    private final Step1Service step1Service;
    private final Step2Service step2Service;
    private final GetLiveSessionService getLiveSessionService;

    @PostMapping("create/step1")
    ResponseEntity< LiveSession> addLiveSessionStep1(@RequestBody LiveSessionStep1RequestDTO SessionRequest,
                                    @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(step1Service.step1AddService(SessionRequest , user));

    }

    @PostMapping("create/step2")
    ResponseEntity<Boolean> addLiveSessionStep2(@RequestBody LiveSessionStep2RequestDTO SessionRequest,
                                    @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(step2Service.step2AddService(SessionRequest , user));
    }

    @GetMapping("/delete")
    public void deleteLiveSession(@RequestParam("sessionId") String sessionId, @RequestParam("type") String type,
                                  @RequestAttribute("user") CustomUserDetails user){
        getLiveSessionService.deleteLiveSession(sessionId , type);
    }
}
