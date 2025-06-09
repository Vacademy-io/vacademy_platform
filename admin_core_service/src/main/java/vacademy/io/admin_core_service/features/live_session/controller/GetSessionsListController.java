package vacademy.io.admin_core_service.features.live_session.controller;


import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.live_session.dto.GetSessionDetailsBySessionIdResponseDTO;
import vacademy.io.admin_core_service.features.live_session.dto.GroupedSessionsByDateDTO;
import vacademy.io.admin_core_service.features.live_session.dto.LiveSessionListDTO;
import vacademy.io.admin_core_service.features.live_session.service.GetLiveSessionService;
import vacademy.io.admin_core_service.features.live_session.service.GetSessionByIdService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/get-sessions")
@RequiredArgsConstructor
public class GetSessionsListController {

    private final GetLiveSessionService getLiveSessionService;
    private final GetSessionByIdService getSessionByIdService;

    @GetMapping("/live")
    ResponseEntity<List<LiveSessionListDTO>> getLiveSessions(@RequestParam("instituteId") String instituteId , @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok( getLiveSessionService.getLiveSession( instituteId , user));
    }

    @GetMapping("/upcoming")
    ResponseEntity<List<GroupedSessionsByDateDTO>> getUpcomingSessions(@RequestParam("instituteId") String instituteId , @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok( getLiveSessionService.getUpcomingSession( instituteId , user));
    }
    @GetMapping("/past")
    ResponseEntity<List<GroupedSessionsByDateDTO>> getPreviousSessions(@RequestParam("instituteId") String instituteId , @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok( getLiveSessionService.getPreviousSession( instituteId , user));
    }

    @GetMapping("/learner/live-and-upcoming")
    ResponseEntity<List<GroupedSessionsByDateDTO>> getLiveAndUpcomingSessions(@RequestParam("batchId") String batchId , @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok( getLiveSessionService.getLiveAndUpcomingSession( batchId , user));
    }

    @GetMapping("/by-session-id")
    ResponseEntity<GetSessionByIdService.SessionDetailsResponse> getSessionById(@RequestParam("sessionId") String sessionId , @RequestAttribute("user") CustomUserDetails user){
        return ResponseEntity.ok(getSessionByIdService.getFullSessionDetails(sessionId));
    }

    @GetMapping("/by-schedule-id")
    ResponseEntity<GetSessionDetailsBySessionIdResponseDTO> getSessionByScheduleId(@RequestParam("scheduleId") String scheduleId , @RequestAttribute("user") CustomUserDetails user){
        return ResponseEntity.ok(getSessionByIdService.getSessionByScheduleId(scheduleId));
    }
}
