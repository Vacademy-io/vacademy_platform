package vacademy.io.admin_core_service.features.live_session.controller;


import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.live_session.dto.GetSessionDetailsBySessionIdResponseDTO;
import vacademy.io.admin_core_service.features.live_session.dto.GroupedSessionsByDateDTO;
import vacademy.io.admin_core_service.features.live_session.dto.LiveSessionListDTO;
import vacademy.io.admin_core_service.features.live_session.dto.SessionSearchRequest;
import vacademy.io.admin_core_service.features.live_session.dto.SessionSearchResponse;
import vacademy.io.admin_core_service.features.live_session.service.GetLiveSessionService;
import vacademy.io.admin_core_service.features.live_session.service.GetSessionByIdService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.admin_core_service.config.cache.ClientCacheable;
import vacademy.io.admin_core_service.config.cache.CacheScope;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/get-sessions")
@RequiredArgsConstructor
public class GetSessionsListController {

    private final GetLiveSessionService getLiveSessionService;
    private final GetSessionByIdService getSessionByIdService;

    @GetMapping("/live")
    @ClientCacheable(maxAgeSeconds = 60, scope = CacheScope.PRIVATE, varyHeaders = {"X-Institute-Id", "X-User-Id"})
    ResponseEntity<List<LiveSessionListDTO>> getLiveSessions(@RequestParam("instituteId") String instituteId , @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok( getLiveSessionService.getLiveSession( instituteId , user));
    }

    @GetMapping("/upcoming")
    @ClientCacheable(maxAgeSeconds = 60, scope = CacheScope.PRIVATE, varyHeaders = {"X-Institute-Id", "X-User-Id"})
    ResponseEntity<List<GroupedSessionsByDateDTO>> getUpcomingSessions(@RequestParam("instituteId") String instituteId , @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok( getLiveSessionService.getUpcomingSession( instituteId , user));
    }
    @GetMapping("/past")
    @ClientCacheable(maxAgeSeconds = 60, scope = CacheScope.PRIVATE, varyHeaders = {"X-Institute-Id", "X-User-Id"})
    ResponseEntity<List<GroupedSessionsByDateDTO>> getPreviousSessions(@RequestParam("instituteId") String instituteId , @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok( getLiveSessionService.getPreviousSession( instituteId , user));
    }
    @GetMapping("/draft")
    @ClientCacheable(maxAgeSeconds = 60, scope = CacheScope.PRIVATE, varyHeaders = {"X-Institute-Id", "X-User-Id"})
    ResponseEntity<List<LiveSessionListDTO>> getDraftedSessions(@RequestParam("instituteId") String instituteId , @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok( getLiveSessionService.getDraftedSession( instituteId , user));
    }

    @GetMapping("/learner/live-and-upcoming")
    @ClientCacheable(maxAgeSeconds = 30, scope = CacheScope.PRIVATE, varyHeaders = {"X-User-Id"})
    ResponseEntity<List<GroupedSessionsByDateDTO>> getLiveAndUpcomingSessions(
            @RequestParam(required = false, name = "batchId") String batchId,
            @RequestParam(value = "userId", required = false) String userId,
            @RequestParam(value = "page", required = false, defaultValue = "0") int page,
            @RequestParam(value = "size", required = false) Integer size,
            @RequestParam(value = "startDate", required = false) String startDate,
            @RequestParam(value = "endDate", required = false) String endDate,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(getLiveSessionService.getLiveAndUpcomingSessionsForUserAndBatch(
                batchId, userId, page, size, startDate, endDate, user));
    }

    @GetMapping("/by-user-id")
    @ClientCacheable(maxAgeSeconds = 30, scope = CacheScope.PRIVATE, varyHeaders = {"X-User-Id"})
    ResponseEntity<List<GroupedSessionsByDateDTO>> getLiveAndUpcomingSessionsForUser(@RequestParam("userId") String userId , @RequestAttribute("user") CustomUserDetails user){
        return ResponseEntity.ok(getLiveSessionService.getLiveAndUpcomingSessionsForUser(userId,user));
    }

    @GetMapping("/by-session-id")
    @ClientCacheable(maxAgeSeconds = 60, scope = CacheScope.PRIVATE)
    ResponseEntity<GetSessionByIdService.SessionDetailsResponse> getSessionById(@RequestParam("sessionId") String sessionId , @RequestAttribute("user") CustomUserDetails user){
        return ResponseEntity.ok(getSessionByIdService.getFullSessionDetails(sessionId));
    }

    @GetMapping("/by-schedule-id")
    @ClientCacheable(maxAgeSeconds = 60, scope = CacheScope.PRIVATE)
    ResponseEntity<GetSessionDetailsBySessionIdResponseDTO> getSessionByScheduleId(@RequestParam("scheduleId") String scheduleId , @RequestAttribute("user") CustomUserDetails user){
        return ResponseEntity.ok(getSessionByIdService.getSessionByScheduleId(scheduleId));
    }

    @PostMapping("/search")
    @ClientCacheable(maxAgeSeconds = 30, scope = CacheScope.PRIVATE, varyHeaders = {"X-Institute-Id"})
    ResponseEntity<SessionSearchResponse> searchSessions(
            @Valid @RequestBody SessionSearchRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(getLiveSessionService.searchSessions(request, user));
    }
}
