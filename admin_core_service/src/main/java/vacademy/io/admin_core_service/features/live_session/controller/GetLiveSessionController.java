package vacademy.io.admin_core_service.features.live_session.controller;


import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.live_session.dto.LiveSessionListDTO;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.admin_core_service.features.live_session.service.GetLiveSessionService;
import vacademy.io.admin_core_service.features.live_session.service.Step1Service;
import vacademy.io.admin_core_service.features.live_session.service.Step2Service;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/get-sessions")
@RequiredArgsConstructor
public class GetLiveSessionController {

    private final Step1Service step1Service;
    private final Step2Service step2Service;
    private final GetLiveSessionService getLiveSessionService;

    @GetMapping("/live")
    ResponseEntity<List<LiveSessionListDTO>> addLiveSessionStep1(@RequestParam("instituteId") String instituteId , @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok( getLiveSessionService.getLiveSession( instituteId , user));

    }
}
